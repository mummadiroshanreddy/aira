require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { trackUsage } = require('./db');
const { checkBillingTier, stripeWebhookPlaceholder } = require('./billing');

// ── Validate keys on startup ──────────────────────────
if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error('FATAL: No API keys set. Add GROQ_API_KEY or GEMINI_API_KEY to server/.env');
  process.exit(1);
}

const hasGroq = !!process.env.GROQ_API_KEY;
const hasGemini = !!process.env.GEMINI_API_KEY;

console.log(`\n🔑 Groq:   ${hasGroq   ? 'SET ✓' : 'NOT SET ✗'}`);
console.log(`🔑 Gemini: ${hasGemini ? 'SET ✓' : 'NOT SET ✗'}\n`);

// ── Initialize AI clients ─────────────────────────────
const groq  = hasGroq   ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = hasGemini ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// ── Provider Warmup (reduces TTFT by pre-initializing connections) ──
const warmupProviders = async () => {
  if (groq) {
    try {
      // Single-token warmup keeps the connection alive
      const warm = await groq.chat.completions.create({
        model: PROVIDERS.groq.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false
      });
      console.log('⚡ Groq warmed up ✓');
    } catch (e) { 
      console.warn('Groq warmup failed (non-fatal):', e.message);
      if (e.message.includes('API key')) console.error('CRITICAL: Groq API Key invalid!');
    }
  }
  if (genAI) {
    try {
      // Pre-initialize the model object (no API call, just warms the client)
      genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✨ Gemini warmed up ✓');
    } catch (e) { console.warn('Gemini warmup failed (non-fatal):', e.message); }
  }
};

const app = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 30000,
  pingInterval: 10000
});

// ── Active stream interrupt map ───────────────────────
const activeStreams = new Map();

// ── CORS Config ───────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

const originConfig = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error(`CORS blocked: ${origin}`));
};

// ── Middleware ────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: originConfig, preflightContinue: false, optionsSuccessStatus: 204, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  message: { error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false
}));

// ── Billing webhook placeholder ───────────────────────
app.post('/api/billing/webhook', stripeWebhookPlaceholder);

// ── Provider config ───────────────────────────────────
const PROVIDERS = {
  groq:   { name: 'Groq',   model: 'llama-3.1-8b-instant', available: hasGroq,   speed: 'Fastest', badge: '⚡' },
  gemini: { name: 'Gemini', model: 'gemini-2.0-flash',       available: hasGemini, speed: 'Fast',    badge: '✨' }
};

app.get('/api/providers', (req, res) => {
  res.json({
    available: Object.entries(PROVIDERS)
      .filter(([, p]) => p.available)
      .map(([id, p]) => ({ id, ...p })),
    default: hasGroq ? 'groq' : 'gemini'
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Resume File Parser ────────────────────────────────
let multer, pdfParse, mammoth;
try {
  multer = require('multer');
  pdfParse = require('pdf-parse');
  mammoth = require('mammoth');
} catch (_) {
  console.warn('⚠️  Dependencies not installed. Run: npm install multer pdf-parse mammoth');
}

if (multer && pdfParse && mammoth) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowed = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowed.includes(file.mimetype) || file.originalname.match(/\.(txt|pdf|docx)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF/TXT/DOCX files are supported'), false);
      }
    }
  });

  app.post('/api/parse-resume', upload.single('resume'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      let text = '';
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      
      if (ext === 'pdf' || req.file.mimetype === 'application/pdf') {
        const data = await pdfParse(req.file.buffer);
        text = data.text;
      } else if (ext === 'docx' || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = result.value;
      } else {
        text = req.file.buffer.toString('utf-8');
      }

      // Cleanup text: remove excessive whitespace, null bytes, etc.
      text = text.replace(/\n{3,}/g, '\n\n')
                 .replace(/[ \t]{2,}/g, ' ')
                 .replace(/\x00/g, '') 
                 .trim();

      res.json({ 
        text, 
        filename: req.file.originalname, 
        chars: text.length,
        summary: text.slice(0, 500) + (text.length > 500 ? '...' : '')
      });
    } catch (err) {
      console.error('[parse-resume]', err.message);
      res.status(500).json({ error: 'Failed to parse file. Please use TXT or paste manually.' });
    }
  });
}

// ── Request Validator ─────────────────────────────────
const validateRequest = (body) => {
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) return 'messages array required';
  if (body.messages.length > 25) return 'too many messages (max 25)';
  for (const msg of body.messages) {
    if (!msg.role || !msg.content) return 'each message needs role and content';
    if (!['user', 'assistant'].includes(msg.role)) return 'invalid role';
  }
  return null;
};

// ── Stream Handlers ───────────────────────────────────
const streamGroq = async (messages, system, maxTokens, emitFn, controller, onFirstToken) => {
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: system });
  msgs.push(...messages.slice(-12));

  let tokenCount = 0;
  let signaledFirst = false;

  const stream = await groq.chat.completions.create({
    model: PROVIDERS.groq.model,
    messages: msgs,
    max_tokens: Math.min(parseInt(maxTokens) || 1200, 8192),
    temperature: 0.7,
    stream: true
  }, { signal: controller.signal });

  for await (const chunk of stream) {
    if (controller.signal.aborted) break;
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) {
      if (!signaledFirst) { signaledFirst = true; onFirstToken(); }
      tokenCount++;
      emitFn({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
    }
  }
  return tokenCount;
};

const streamGemini = async (messages, system, maxTokens, emitFn, controller, onFirstToken) => {
  const model = genAI.getGenerativeModel({
    model: PROVIDERS.gemini.model,
    systemInstruction: system || '',
    generationConfig: { maxOutputTokens: Math.min(parseInt(maxTokens) || 1200, 8192), temperature: 0.7 }
  });

  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const lastMessage = messages[messages.length - 1];
  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage.content, { signal: controller.signal });

  let tokenCount = 0;
  let signaledFirst = false;

  for await (const chunk of result.stream) {
    if (controller.signal.aborted) break;
    const text = chunk.text();
    if (text) {
      if (!signaledFirst) { signaledFirst = true; onFirstToken(); }
      tokenCount += Math.ceil(text.length / 4);
      emitFn({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
    }
  }
  return tokenCount;
};

// ── Socket.io Core ────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on('chat_stream', async (payload) => {
    console.log(`[socket] chat_stream event | user: ${payload.userId} | provider: ${payload.provider}`);
    const validationError = validateRequest(payload);
    if (validationError) {
      console.error(`[socket] Validation failed: ${validationError}`);
      return socket.emit('stream_error', { error: validationError });
    }

    const { messages, system, max_tokens, provider = 'groq', userId = 'anonymous' } = payload;
    const streamId = uuidv4();
    console.log(`[socket] Stream started: ${streamId}`);

    const activeProvider = (provider === 'groq' && hasGroq) ? 'groq'
      : (provider === 'gemini' && hasGemini) ? 'gemini'
      : hasGroq ? 'groq' : 'gemini';

    const controller = new AbortController();
    activeStreams.set(streamId, controller);

    socket.emit('stream_start', { streamId, provider: activeProvider, model: PROVIDERS[activeProvider].model });

    const emitFn = (chunk) => socket.emit('stream_token', { streamId, chunk });

    let fallbackTriggered = false;
    let fallbackTimer = null;

    const executeStream = async (targetProvider, isFallback = false) => {
      try {
        console.log(`[socket] Executing ${targetProvider} | isFallback: ${isFallback}`);
        let tokensUsed = 0;
        const onFirstToken = () => { if (fallbackTimer) clearTimeout(fallbackTimer); };

        if (!isFallback) {
          fallbackTimer = setTimeout(() => {
            console.warn(`[${targetProvider}] TTFT >2s — triggering fallback`);
            fallbackTriggered = true;
            controller.abort();
            const nextProvider = targetProvider === 'groq' ? 'gemini' : 'groq';
            const nextAvailable = nextProvider === 'groq' ? hasGroq : hasGemini;
            if (nextAvailable) {
              socket.emit('stream_fallback', { streamId, from: targetProvider, to: nextProvider, reason: 'ttft_timeout' });
              executeStream(nextProvider, true);
            } else {
              socket.emit('stream_error', { streamId, error: 'Provider timeout and no fallback available.' });
            }
          }, 2000); // 2s TTFT threshold for ultra-low latency
        }

        if (targetProvider === 'groq') {
          tokensUsed = await streamGroq(messages, system, max_tokens, emitFn, controller, onFirstToken);
        } else {
          tokensUsed = await streamGemini(messages, system, max_tokens, emitFn, controller, onFirstToken);
        }

        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (!controller.signal.aborted) {
          socket.emit('stream_end', { streamId });
          await trackUsage(userId, tokensUsed, 0);
        }
      } catch (err) {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (err.name === 'AbortError') { console.log(`[socket] Stream ${streamId} aborted.`); return; }
        console.error(`❌ [${targetProvider}]`, err.message);
        if (!isFallback && !fallbackTriggered) {
          const nextProvider = targetProvider === 'groq' ? 'gemini' : 'groq';
          if (nextProvider === 'groq' ? hasGroq : hasGemini) {
            socket.emit('stream_fallback', { streamId, from: targetProvider, to: nextProvider, reason: 'error' });
            return executeStream(nextProvider, true);
          }
        }
        socket.emit('stream_error', { streamId, error: 'AI provider failed. Check API keys/balance.' });
      } finally {
        if (activeStreams.get(streamId) === controller) activeStreams.delete(streamId);
      }
    };

    executeStream(activeProvider);
  });

  socket.on('cancel_stream', ({ streamId }) => {
    if (streamId && activeStreams.has(streamId)) {
      console.log(`[barge-in] Stopping stream: ${streamId}`);
      activeStreams.get(streamId).abort();
      activeStreams.delete(streamId);
    }
  });

  socket.on('disconnect', () => console.log(`Socket Disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   ARIA v4.5 — Elite Voice AI Engine Up   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`🚀 Port:     ${PORT}`);
  console.log(`⚡ Groq:     ${hasGroq ? 'Llama-3.3-70b ✓' : 'NOT SET'}`);
  console.log(`✨ Gemini:   ${hasGemini ? 'Gemini-2.0-Flash ✓' : 'NOT SET'}`);
  console.log('🔗 Handshake: Polling → WebSocket');
  console.log('⏱️  TTFT Threshold: 2s (auto-fallback)\n');
  // Warm up providers 3s after start (let ports bind first)
  setTimeout(warmupProviders, 3000);
});

process.on('uncaughtException', (err) => console.error('CRITICAL:', err));
process.on('unhandledRejection', (reason) => console.error('CRITICAL:', reason));
