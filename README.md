# ARIA — AI Interview Copilot

ARIA is an elite, multi-modal AI interview copilot designed to give candidates an unfair advantage in high-stakes interviews. Built with React and powered by Google's Gemini 2.0 Flash.

## Security Architecture

ARIA uses a strict two-proxy approach to ensure that your Google Gemini API key is NEVER exposed to the frontend, browser console, or source code.
- **Development**: React → Express Server (`localhost:3001`) → Gemini
- **Production**: React → PHP Proxy (`Hostinger`) → Gemini

The API key is securely isolated on the server and is never included in any `REACT_APP_` environment variables.

## Environment Setup

### Step 1 — Clone and Install
```bash
npm install
cd server && npm install
```

### Step 2 — Configure Development Environment
```bash
cp .env.example .env.development
cp server/.env.example server/.env
```
Edit `server/.env` and add your `GEMINI_API_KEY`. Get it at [aistudio.google.com](https://aistudio.google.com).

### Step 3 — Run in Development
Terminal 1: Start proxy server
```bash
cd server && npm run dev
```

Terminal 2: Start React app
```bash
npm start
```
App runs at [http://localhost:3000](http://localhost:3000)
Proxy runs at [http://localhost:3001](http://localhost:3001)

### Step 4 — Build for Production
```bash
npm run build
```

### Step 5 — Deploy to Hostinger
1. Upload contents of `/build` to `public_html`.
2. Upload `public/proxy.php` to `public_html/api/proxy.php`.
3. Upload `public/api/.htaccess` to `public_html/api/.htaccess`.
4. Upload `public/.htaccess` to `public_html/.htaccess`.
5. Create `public_html/.env.php` with your API key:
   ```php
   <?php
   define('GEMINI_API_KEY', 'your_gemini_api_key_here');
   define('ALLOWED_ORIGIN', 'https://yourdomain.com');
   ?>
   ```
6. Enable SSL in Hostinger hPanel.
7. Test your live deployment at `https://yourdomain.com`.

## Pricing 

Gemini 2.0 Flash is FREE up to:
- 1,500 requests per day
- 1 million tokens per minute
Perfect for personal use — no credit card needed

## Environment Variables Reference

### React Variables (Safe for Browser)
| Variable | Description | Default |
| --- | --- | --- |
| `REACT_APP_ENV` | Environment tracker (`development` or `production`) | `development` |
| `REACT_APP_API_URL` | Base URL pointing to local proxy or live proxy | `http://localhost:3001/api` |
| `REACT_APP_APP_NAME` | Name of application | `ARIA Copilot` |
| `REACT_APP_VERSION` | Application Version | `1.0.0` |
| `REACT_APP_MAX_TOKENS` | Response limit constraint passed via payload | `1200` |
| `REACT_APP_MODEL` | The Gemini LLM to run | `gemini-2.0-flash` |
| `REACT_APP_RATE_LIMIT`| Soft frontend warning for rate limiting | `100` |
| `REACT_APP_SESSION_TIMEOUT` | Max idle timer (in ms) before clearing cache | `7200000` |

### Server Variables (NEVER expose to React)
| Variable | Location | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | `server/.env` / `public/.env.php` | Main LLM processing key |
| `PORT` | `server/.env` | Express listen port |
| `ALLOWED_ORIGIN` | `server/.env` / `public/.env.php` | CORS lock URL |
| `RATE_LIMIT_WINDOW_MS` | `server/.env` / `public/.env.php` | Milliseconds per IP limit window |
| `RATE_LIMIT_MAX_REQUESTS` | `server/.env` / `public/.env.php` | Maximum requests permitted per window |

## Security Checklist
- [ ] API key only in `server/.env` (dev) or `.env.php` (prod)
- [ ] `.gitignore` covers all `.env` files
- [ ] CORS locked to your domain only
- [ ] Rate limiting active (100 req/hour/IP)
- [ ] HTTPS enforced via `.htaccess`
- [ ] `.env.php` blocked from direct browser access
- [ ] No API key in any `REACT_APP_` variable
- [ ] No API key in browser network tab
- [ ] No API key in page source

## All Keyboard Shortcuts
ARIA is designed to be fully navigable without a mouse during an active interview.

| Shortcut | Action |
| --- | --- |
| `Ctrl+Enter` | Submit current input |
| `Ctrl+S` | Save current transcript/answer to Vault |
| `Ctrl+Shift+F` | Open Follow Up Radar |
| `Ctrl+Shift+H` | Toggle Keyboard Help Overlay |
| `Esc` | Close overlays (Teleprompter, Vault Modals, etc) |

**Stealth Macros**
| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+M` | Toggle MiniBar Stealth GUI |
| `Ctrl+Shift+T` | Toggle Teleprompter Web Stealth |
| `Ctrl+Shift+O` | Force Trigger "Google Docs" Stealth Canvas |

**Quick Modes**
| Shortcut | Action |
| --- | --- |
| `1` - `8` | Fast switch between the 8 main tools |

## Troubleshooting

**Problem: API key missing error on frontend.**
*Fix: Ensure `server/.env` exists locally or `.env.php` exists on Hostinger. React API components are blocked from owning keys.*

**Problem: 502 Bad Gateway / Proxy Down.**
*Fix: Express server is dead. Run `cd server && npm run dev`.*

**Problem: Hostinger proxy returns 405 Method Not Allowed.**
*Fix: You're trying to send a GET request or visit the proxy via URL. Only POSTs are allowed. Use the frontend app to interact with the LLM.*

**Problem: Rate limit kicks in too fast.**
*Fix: Check the integer thresholds in `server/.env` or `.env.php`. Default is 100/hour.*

---
*Developed for elite performance under extreme pressure.*
