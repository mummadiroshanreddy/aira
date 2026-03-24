// ════════════════════════════════
// FILE: src/api/config.js (v4.4 — no spurious warnings)
// ════════════════════════════════

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const apiUrl = process.env.REACT_APP_SERVER_URL
  ? `${process.env.REACT_APP_SERVER_URL}/api`
  : isLocal
    ? 'http://localhost:3001/api'
    : `${window.location.protocol}//${window.location.hostname}:3001/api`;

export const config = Object.freeze({
  env: process.env.REACT_APP_ENV || 'development',
  apiUrl,
  appName: process.env.REACT_APP_APP_NAME || 'ARIA Copilot',
  version: process.env.REACT_APP_VERSION || '4.4.0',
  model: process.env.REACT_APP_MODEL || 'llama-3.3-70b-versatile',
  maxTokens: parseInt(process.env.REACT_APP_MAX_TOKENS) || 1200,
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  chatEndpoint: `${apiUrl}/chat`,
  streamEndpoint: `${apiUrl}/chat/stream`,
  healthEndpoint: `${apiUrl}/health`,
});

export default config;
