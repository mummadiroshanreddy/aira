const fs = require('fs');
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
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');

// ── Environment Verification ──────────────────────────
const hasGroq = !!process.env.GROQ_API_KEY;
const hasGemini = !!process.env.GEMINI_API_KEY;

console.log(`\n🔑 Groq:   ${hasGroq   ? 'SET ✓' : 'NOT SET ✗'}`);
console.log(`🔑 Gemini: ${hasGemini ? 'SET ✓' : 'NOT SET ✗'}\n`);

// ── Initialize Clients ────────────────────────────────
const groq = hasGroq ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = hasGemini ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const app = express();
const server = http.createServer(app);

// ── WebSocket Heartbeat logic ─────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 30000, 
  pingInterval: 10000
});

// ── Resume Store (Simple in-memory) ───────────────────
const resumeSummaries = new Map();

// ── Middleware ────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ── Provider Config ───────────────────────────────────
const PROVIDERS = {
  groq: { name: "⚡ Groq", model: "llama-3.3-70b-versatile", available: hasGroq },
  gemini: { name: "🧠 Gemini", model: "gemini-2.0-flash", available: hasGemini },
  ollama: { name: "🖥️ Local (Ollama)", model: "llama3", available: true }
};

// ── Helper: Provider Summary Generator ────────────────
const generateResumeSummary = async (text) => {
  try {
    const prompt = `Summarize this resume for an AI interview copilot. 
    Focus on key skills, years of experience, and top 3 achievements. 
    Keep it under 500 tokens. 
    Text: ${text.substring(0, 8000)}`;

    if (hasGroq) {
      const chat = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: "You are a recruitment assistant." }, { role: "user", content: prompt }],
        max_tokens: 500
      });
      return chat.choices[0].message.content;
    } else if (hasGemini) {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
    return text.substring(0, 1500); // Fallback to raw truncation
  } catch (err) {
    console.warn("Summary generation failed, using truncation.");
    return text.substring(0, 1500);
  }
};

// ── Routes ────────────────────────────────────────────
app.post('/api/parse-resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    let text = '';
    const ext = req.file.originalname.split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } else if (ext === 'docx') {
      const data = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = data.value;
    } else {
      text = req.file.buffer.toString('utf-8');
    }

    const summary = await generateResumeSummary(text);
    const userId = req.body.userId || 'anonymous';
    resumeSummaries.set(userId, summary);

    res.json({ success: true, summary, filename: req.file.originalname });
  } catch (err) {
    console.error("Parse Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Provider Streaming Handlers ───────────────────────

const streamGroq = async (fullPrompt, messages, socket) => {
  const stream = await groq.chat.completions.create({
    model: PROVIDERS.groq.model,
    messages: [
      { role: "system", content: fullPrompt },
      ...messages.slice(-8)
    ],
    stream: true
  });
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) socket.emit('chunk', { data: content });
  }
};

const streamGemini = async (fullPrompt, messages, socket) => {
  const model = genAI.getGenerativeModel({ 
    model: PROVIDERS.gemini.model,
    systemInstruction: fullPrompt
  });
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const chat = model.startChat({ history });
  const lastMsg = messages[messages.length - 1]?.content || "Hello";
  const result = await chat.sendMessageStream(lastMsg);
  for await (const chunk of result.stream) {
    const content = chunk.text();
    if (content) socket.emit('chunk', { data: content });
  }
};

const streamOllama = async (fullPrompt, messages, socket) => {
  const response = await axios.post("http://localhost:11434/api/generate", {
    model: PROVIDERS.ollama.model,
    system: fullPrompt,
    prompt: messages[messages.length - 1]?.content || "",
    stream: true
  }, { responseType: 'stream' });

  return new Promise((resolve, reject) => {
    response.data.on('data', chunk => {
      const lines = chunk.toString().split('\n');
      lines.forEach(line => {
        if (!line.trim()) return;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) socket.emit('chunk', { data: parsed.response });
          if (parsed.done) resolve();
        } catch (e) { /* partial chunk */ }
      });
    });
    response.data.on('error', reject);
    response.data.on('end', resolve);
  });
};

// ── The Master Provider Manager ───────────────────────

async function executeStreamWithFallback(socket, payload) {
  const { messages, userId = 'anonymous' } = payload;
  const resumeSummary = resumeSummaries.get(userId) || "No resume content provided.";
  
  const fullPrompt = `Resume Summary:\n${resumeSummary}\n\nObjective: You are ARIA, an interview copilot. Provide strategic, concise guidance based on the resume and context below.`;
  
  const providersToTry = ['groq', 'gemini', 'ollama'];
  let currentProviderIndex = 0;
  let success = false;

  while (currentProviderIndex < providersToTry.length && !success) {
    const pId = providersToTry[currentProviderIndex];
    const pInfo = PROVIDERS[pId];

    if (!pInfo.available && pId !== 'ollama') {
      currentProviderIndex++;
      continue;
    }

    try {
      socket.emit('provider', { name: pInfo.name, id: pId });
      
      // Timeout guard: 10s for first token
      const timeoutPromise = new Promise((_, rej) => 
        setTimeout(() => rej(new Error('TIMEOUT')), 10000)
      );

      if (pId === 'groq') await streamGroq(fullPrompt, messages, socket);
      else if (pId === 'gemini') await streamGemini(fullPrompt, messages, socket);
      else if (pId === 'ollama') await streamOllama(fullPrompt, messages, socket);

      success = true;
      socket.emit('done');
    } catch (err) {
      console.error(`❌ Provider ${pId} failed:`, err.message);
      fs.appendFileSync('error.log', `[${new Date().toISOString()}] ${pId} Fail: ${err.message}\n`);
      
      currentProviderIndex++;
      if (currentProviderIndex < providersToTry.length) {
        const nextP = PROVIDERS[providersToTry[currentProviderIndex]];
        socket.emit('fallback', { from: pInfo.name, to: nextP.name });
      } else {
        socket.emit('error', { message: "All providers exhausted." });
      }
    }
  }
}

// ── Socket Events ─────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on('chat_stream', (payload) => {
    executeStreamWithFallback(socket, payload).catch(err => {
      console.error("Internal execute error:", err);
      socket.emit('error', { message: "Critical System Error" });
    });
  });

  socket.on('cancel_stream', () => {
    // Handling barge-in: currently we just let the next event overtake
    console.log("Client cancelled stream/asked new question.");
  });

  socket.on('disconnect', () => console.log("Socket Disconnected"));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║      ARIA v4.0 — ELITE STABILIZATION     ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🛠 Providers: Groq -> Gemini -> Ollama`);
  console.log(`──────────────────────────────────────────\n`);
});
