# ARIA v4.2 — Running Notes
> Last updated: 2026-03-23

---

## ⚡ QUICK START (30 seconds)

### Step 1 — Install everything
```powershell
# From the project root: c:\Users\rosha\Downloads\aira
npm install

# Then install server deps
Set-Location server; npm install; Set-Location ..
```

### Step 2 — Add your API keys
Create `server/.env` (if it doesn't exist):
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxx
PORT=3001
```
> You only need ONE key. Groq is free and fastest. Get it at: https://console.groq.com

### Step 3 — Launch
```powershell
# From the server folder:
Set-Location server
npx kill-port 3000; npx kill-port 3001; npm run start:both
```

### Step 4 — Open browser
```
http://localhost:3000
```

---

## 📂 PROJECT STRUCTURE

```
aira/
├── src/                        ← React frontend
│   ├── api/
│   │   ├── claude.js           ← streamClaude() + callClaude() wrappers
│   │   └── socket.js           ← Socket.io client (auto-detects HTTP/HTTPS)
│   ├── components/
│   │   ├── Modes/
│   │   │   ├── LiveCopilot.jsx ← Main interview mode (voice + streaming)
│   │   │   ├── ConfidenceScorer.jsx
│   │   │   ├── RapidFire.jsx
│   │   │   ├── SalaryWarRoom.jsx
│   │   │   ├── CompanyIntel.jsx
│   │   │   ├── QuestionPredictor.jsx
│   │   │   └── PostInterview.jsx
│   │   └── Setup/
│   │       └── SetupScreen.jsx ← Onboarding (file upload + localStorage)
│   └── hooks/
│       ├── useSpeech.js        ← Web Speech API (mic input + silence detection)
│       └── useTTS.js           ← Text-to-speech output
└── server/
    ├── index.js                ← Express + Socket.io + Groq + Gemini
    ├── db.js                   ← Usage tracking (local SQLite or placeholder)
    ├── billing.js              ← Stripe placeholder
    └── .env                    ← YOUR API KEYS GO HERE
```

---

## 🔑 Environment Variables

### `server/.env`
| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ (or Gemini) | Groq API key — free at console.groq.com |
| `GEMINI_API_KEY` | ✅ (or Groq) | Google Gemini key — free at aistudio.google.com |
| `PORT` | No (default: 3001) | Server port |
| `ALLOWED_ORIGINS` | No | Comma-separated origins for CORS |

### `src/.env` (optional)
| Variable | Description |
|---|---|
| `REACT_APP_SERVER_URL` | Override server URL for cloud deploys |

---

## 🎮 HOW TO USE ARIA

### Live Copilot Mode
1. Click **Live Copilot** in sidebar
2. Grant microphone permission when prompted
3. **Speak** the interview question — ARIA auto-detects silence and responds
4. OR **type** the question and press `Ctrl+Enter`
5. ARIA streams the answer in real-time with 4 sections: HOOK → CORE MESSAGE → PROOF POINT → POWER CLOSE
6. **Speak over ARIA** at any time to interrupt (barge-in)
7. Click **🕶️ Stealth** to hide the ARIA UI (looks like a note-taking app)

### Other Modes
| Mode | What it does |
|---|---|
| **Question Predictor** | Predicts 15 questions you'll be asked based on JD |
| **Confidence Scorer** | Paste an answer → get score + rewrite |
| **Rapid Fire Drill** | High-pressure timed Q&A reps |
| **Company Intel** | Paste JD → classified briefing |
| **Salary War Room** | Negotiation strategy + call script + email |
| **Post-Interview** | Thank you emails + rejection recovery |

---

## ⚠️ TROUBLESHOOTING

### "npm run start:both" — Missing script error
You ran it from the **wrong folder**. Always run from `server/`:
```powershell
# CORRECT:
Set-Location server; npm run start:both

# WRONG (from root aira folder):
npm run start:both   # → error: missing script
```

### Voice not working
1. Check mic permission: browser URL bar → lock icon → allow microphone
2. Click **🔇 Mic OFF** button to toggle mic back on
3. HTTPS required for mic on deployed sites (localhost is fine)

### Stream errors / "AI provider failed"
1. Check `server/.env` has valid API keys
2. Verify Groq key at: https://console.groq.com/keys
3. Check server terminal for the exact error line

### Port already in use
```powershell
npx kill-port 3000; npx kill-port 3001
```

### App won't load (localhost refused)
The server may have crashed. Check the terminal running `npm run start:both` for error messages.

---

## 🚀 PROVIDER FALLBACK CHAIN

```
Question received
      ↓
  ⚡ Groq (primary — fastest, ~200ms TTFT)
      ↓ fails or >5s TTFT
  ✨ Gemini (secondary — reliable)
      ↓ fails
  Error displayed (check API keys)
```

---

## 📦 PUSH TO GITHUB

```powershell
# From root aira folder:
git add .
git commit -m "your message here"
git push origin main
```

---

## 🛑 STOP THE SERVER

Close the terminal running `npm run start:both`, or press `Ctrl+C` in it.
