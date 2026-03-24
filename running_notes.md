# 🏃 ARIA — Master State v4.0 "Elite Stabilization"

ARIA v4.0 is now a production-grade, fault-tolerant AI Interview Copilot with triple-provider redundancy.

---

### 🚀 Launch Sequence (Master v4.0)

1. **📦 Dependencies**
   Ensure you have the latest packages in both directories:
   ```bash
   cd server && npm install
   cd .. && npm install
   ```

2. **🖥️ Local AI (Ollama)**
   Ollama is required for the zero-limit fallback.
   ```bash
   ollama run llama3
   ```

3. **🔑 Keys (.env)**
   Ensure `GROQ_API_KEY` and `GEMINI_API_KEY` are set in `server/.env`.

4. **⚡ Start**
   ```bash
   cd server
   npm run start:both
   ```

---

### 🔥 New Elite Features (v4.0)

- **Triple-Tier Fallback:** ⚡ Groq (Fastest) ➜ 🧠 Gemini (Intelligent) ➜ 🖥️ Local Ollama (Unstoppable).
- **DOCX & PDF Parsing:** Upload real resume files; ARIA now uses `mammoth` and `pdf-parse`.
- **Auto-Summarization:** ARIA summarizes your resume on upload to inject high-density context into response generation.
- **WebSocket Heartbeat:** 100% stable connection with active 10s ping intervals.
- **Provider UI:** Real-time indicator shows exactly which AI is answering.

---

### 🛠 Troubleshooting (Elite Tier)

- **Local Fallback Triggered:** If Groq or Gemini are slow (>10s), ARIA will automatically hot-swap to the next provider mid-session.
- **Ollama Refused Connection:** Ensure Ollama is running (`ollama serve`) and the model `llama3` is pulled.
- **Audio Lag:** ARIA now purges audio buffers instantly on barge-in. If audio hangs, toggle the **Mic ON/OFF** button.

**ARIA v4.0: The Unstoppable Copilot.** 🎤🛡️🚀
