# 🏃 ARIA — Running Notes & Deployment Guide (v3.3)

Follow these steps to launch the ARIA AI Interview Copilot with the latest master fixes (PDF parsing, stable transport, and high-performance UI).

---

### 1. 📦 Dependency Installation
The latest version includes `pdf-parse` and `multer` for resume processing. You **must** run install in both directories.

**Backend Setup:**
```bash
cd server
npm install
```

**Frontend Setup:**
```bash
# From project root
npm install
```

---

### 2. 🔑 Environment Configuration
Create `.env` files based on the provided `.env.example` templates.

**Server (`server/.env`):**
```env
GROQ_API_KEY=your_key
GEMINI_API_KEY=your_key
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend (`.env`):**
```env
REACT_APP_SERVER_URL=http://localhost:3001
REACT_APP_API_URL=http://localhost:3001/api
```

---

### 3. 🚀 Launching the Engine
Use the unified start command to boot both server and client.

```bash
cd server
npm run start:both
```

---

### 4. 🧪 Featured Fixes (v3.3)
- **PDF Resume Upload:** In the Setup screen, click the upload button to automatically extract text from your resume.
- **Manual Mic Control:** Use the `🎙️ Mic ON / 🔇 Mic OFF` button in the Live Copilot header for direct control.
- **Hybrid Transport:** The app now starts with Polling and upgrades to WSS automatically, preventing disconnections.
- **Stealth Mode Stability:** Layout fixes ensure the "Meeting Notes" mode is perfectly aligned with no duplicate CSS conflicts.

---

### 5. 🛠 Troubleshooting
- **Socket Disconnected:** Ensure the `ALLOWED_ORIGINS` in `server/.env` matches your frontend URL.
- **Mic Access:** Ensure browser permissions are granted. If it stays RED, click the Mic toggle button twice.
- **PDF Parsing Error:** Ensure you ran `npm install` in the `server` folder to initialize the `pdf-parse` binary.

**ARIA v3.3: Master State. Zero Latency. Full Control.** 🎤🔥🚀
