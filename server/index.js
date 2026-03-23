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
  console.error('FATAL: No API keys set');
  process.exit(1);
}

const hasGroq = !!process.env.GROQ_API_KEY;
const hasGemini = !!process.env.GEMINI_API_KEY;

console.log(`\n🔑 Groq:   ${hasGroq   ? 'SET ✓' : 'NOT SET ✗'}`);
console.log(`🔑 Gemini: ${hasGemini ? 'SET ✓' : 'NOT SET ✗'}\n`);

// ── Initialize clients ────────────────────────────────
const groq   = hasGroq   ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI  = hasGemini ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const app = express();
const server = http.createServer(app);

// ── CORS & Socket.io ──────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: "*", // Universal CORS for reliable handshake across all network variations
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket'], // Robust Hybrid Handshake: Polling-first ensures a successful link
  allowEIO3: true,
  pingTimeout: 20000, 
  pingInterval: 10000
});

// ── Interrupt Map ─────────────────────────────────────
// critical for instantly killing AI generation on barge-in
const activeStreams = new Map();

// ── Middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: originConfig, preflightContinue: false, optionsSuccessStatus: 204 }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false
}));

// Placeholder Billing Webhook (Part 12)
app.post('/api/billing/webhook', stripeWebhookPlaceholder);

// ── Provider config ───────────────────────────────────
const PROVIDERS = {
  groq:   { name: 'Groq',   model: 'llama-3.3-70b-versatile', available: hasGroq,   speed: 'Fastest', badge: '⚡' },
  gemini: { name: 'Gemini', model: 'gemini-2.0-flash',        available: hasGemini, speed: 'Fast',    badge: '✨' }
};

app.get('/api/providers', (req, res) => {
  res.json({
    available: Object.entries(PROVIDERS).filter(([, p]) => p.available).map(([id, p]) => ({ id, ...p })),
    default: hasGroq ? 'groq' : 'gemini'
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const validateRequest = (body) => {
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) return 'messages array required';
  if (body.messages.length > 25) return 'too many messages (max 25)';
  for (const msg of body.messages) {
    if (!msg.role || !msg.content) return 'each message needs role and content';
    if (!['user','assistant'].includes(msg.role)) return 'invalid role';
  }
  return null;
};

// ── STREAM HANDLERS ───────────────────────────────────

const streamGroq = async (messages, system, maxTokens, emitFn, controller, onFirstToken) => {
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: system });
  msgs.push(...messages.slice(-12));

  let tokenCount = 0;
  let signaledFirst = false;

  let stream;
  try {
    stream = await groq.chat.completions.create({
      model: PROVIDERS.groq.model,
      messages: msgs,
      max_tokens: Math.min(parseInt(maxTokens) || 1200, 8192),
      temperature: 0.7,
      stream: true
    }, { signal: controller.signal });
  } catch (error) {
    console.error(`[Groq] SDK Error during create():`, error);
    throw error;
  }

  for await (const chunk of stream) {
    if (controller.signal.aborted) break;
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) {
      if (!signaledFirst) {
        signaledFirst = true;
        onFirstToken();
      }
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

  const history = messages.slice(0, -1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const lastMessage = messages[messages.length - 1];
  
  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage.content, { signal: controller.signal });

  let tokenCount = 0;
  let signaledFirst = false;

  for await (const chunk of result.stream) {
    if (controller.signal.aborted) break;
    const text = chunk.text();
    if (text) {
      if (!signaledFirst) {
        signaledFirst = true;
        onFirstToken();
      }
      // Gemini tokens are estimated 4 chars per token roughly
      tokenCount += Math.ceil(text.length / 4);
      emitFn({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
    }
  }
  return tokenCount;
};

// ── SOCKET.IO CORE ────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Client Connected: ${socket.id}`);

  // The Primary Voice Stream Endpoint
  socket.on('chat_stream', async (payload) => {
    const error = validateRequest(payload);
    if (error) {
      return socket.emit('stream_error', { error });
    }

    const { messages, system, max_tokens, provider = 'groq', userId = 'anonymous' } = payload;
    const streamId = uuidv4();
    
    // Check local billing/usage
    const activeProvider = (provider === 'groq' && hasGroq) ? 'groq' : (provider === 'gemini' && hasGemini) ? 'gemini' : hasGroq ? 'groq' : 'gemini';

    // Register AbortController to support barge-in stopping
    const controller = new AbortController();
    activeStreams.set(streamId, controller);

    socket.emit('stream_start', { streamId, provider: activeProvider, model: PROVIDERS[activeProvider].model });

    const emitFn = (chunk) => socket.emit('stream_token', { streamId, chunk });

    let fallbackTriggered = false;
    let fallbackTimer = null;

    const executeStream = async (targetProvider, isFallback = false) => {
      try {
        let tokensUsed = 0;
        const onFirstToken = () => {
          if (fallbackTimer) clearTimeout(fallbackTimer);
        };

        // TTFT Timeout Logic (5 seconds per benchmark requirement)
        if (!isFallback) {
          fallbackTimer = setTimeout(() => {
            console.warn(`[${targetProvider}] TTFT threshold (5s) exceeded. Triggering fallback...`);
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
          }, 5000);
        }

        if (targetProvider === 'groq') {
          tokensUsed = await streamGroq(messages, system, max_tokens, emitFn, controller, onFirstToken);
        } else {
          tokensUsed = await streamGemini(messages, system, max_tokens, emitFn, controller, onFirstToken);
        }

        if (fallbackTimer) clearTimeout(fallbackTimer);

        if (!controller.signal.aborted) {
          socket.emit('stream_end', { streamId });
          // Log metrics to DB
          await trackUsage(userId, tokensUsed, 0);
        }
      } catch (err) {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        
        if (err.name === 'AbortError') {
          console.log(`[socket] Stream ${streamId} safely aborted/interrupted.`);
          return;
        }

        console.error(`❌ [${targetProvider}] Stream Critical Failure:`, err.message || err);

        // Standard Error Fallback
        if (!isFallback && !fallbackTriggered) {
          const nextProvider = targetProvider === 'groq' ? 'gemini' : 'groq';
          const nextAvailable = nextProvider === 'groq' ? hasGroq : hasGemini;
          
          if (nextAvailable) {
            console.warn(`[socket] Swapping to fallback provider (${nextProvider}) due to primary failure.`);
            socket.emit('stream_fallback', { streamId, from: targetProvider, to: nextProvider, reason: 'error' });
            return executeStream(nextProvider, true);
          }
        }
        
        console.error('🔥 [socket] Fatal: Both providers failed or no fallback available.');
        socket.emit('stream_error', { streamId, error: 'AI provider failed. Check API balance/limits.' });
      } finally {
        if (activeStreams.get(streamId) === controller) {
           activeStreams.delete(streamId);
        }
      }
    };

    executeStream(activeProvider);
  });

  // Barge-In / Interrupt Target
  socket.on('cancel_stream', (payload) => {
    const { streamId } = payload;
    if (streamId && activeStreams.has(streamId)) {
      console.log(`[barge-in] Hard stopping stream: ${streamId}`);
      activeStreams.get(streamId).abort();
      activeStreams.delete(streamId);
    }
  });



  socket.on('disconnect', () => {
    console.log(`Client Disconnected`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => { // Explicitly bind to all interfaces (IPv4)
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  ARIA v3.2 — Universal Stability Active  ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`🚀 Port:     ${PORT}`);
  console.log(`⚡ Groq:     Llama-3.3-70b-Versatile ✓`);
  console.log(`✨ Gemini:   Gemini-2.0-Flash ✓`);
  console.log('🔗 Handshake: Hybrid (Polling -> WebSocket)');
  console.log('──────────────────────────────────────────\n');
});


process.on('uncaughtException', (err) => console.error('CRITICAL:', err));
process.on('unhandledRejection', (reason) => console.error('CRITICAL:', reason));
