// ════════════════════════════════
// FIXED FILE: src/api/config.js
// BUGS FIXED: BUG-001
// ════════════════════════════════

const required = [
  'REACT_APP_API_URL',
  'REACT_APP_MODEL', 
  'REACT_APP_MAX_TOKENS'
];

required.forEach(req => {
  if (!process.env[req]) {
    if (process.env.NODE_ENV === 'production' || process.env.REACT_APP_ENV === 'production') {
      throw new Error(`CRITICAL: Missing environment variable ${req}`);
    } else {
      console.warn(`WARNING: Missing environment variable ${req}`);
    }
  }
});

const isPhpProxy = process.env.REACT_APP_API_URL?.endsWith('.php');

const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const config = Object.freeze({
  env: process.env.REACT_APP_ENV || 'development',
  apiUrl: apiUrl,
  appName: process.env.REACT_APP_APP_NAME || 'ARIA Copilot',
  version: process.env.REACT_APP_VERSION || '1.0.0',
  model: process.env.REACT_APP_MODEL || 'gemini-2.0-flash',
  maxTokens: parseInt(process.env.REACT_APP_MAX_TOKENS) || 1200,
  rateLimit: parseInt(process.env.REACT_APP_RATE_LIMIT) || 100,
  sessionTimeout: parseInt(process.env.REACT_APP_SESSION_TIMEOUT) || 7200000,
  isDev: process.env.REACT_APP_ENV === 'development',
  isProd: process.env.REACT_APP_ENV === 'production',
  chatEndpoint: isPhpProxy ? apiUrl : `${apiUrl}/chat`,
  streamEndpoint: isPhpProxy ? apiUrl : `${apiUrl}/chat/stream`,
  healthEndpoint: isPhpProxy ? apiUrl : `${apiUrl}/health`,
});

console.log('ARIA API URL:', config.apiUrl);

export default config;
