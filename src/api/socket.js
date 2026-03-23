import { io } from 'socket.io-client';
import { config } from './config';

// ── Shared WebSocket Client ───────────────────────────
// Initializes the global Socket.io instance. Natively handles auto-reconnects,
// heartbeat pings, and hybrid SSE fallback. Connects strictly to the proxy.

const SERVER_URL = config.apiUrl ? config.apiUrl.replace('/api', '') : 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  autoConnect: true,
  transports: ['websocket', 'polling'] // Prioritizes websocket -> falls back to SSE
});

// Expose diagnostic listeners
socket.on('connect', () => {
  console.log('⚡ [WebSockets] Connected to ARIA Proxy Server (ID:', socket.id, ')');
});

socket.on('disconnect', (reason) => {
  console.warn('⚠️ [WebSockets] Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ [WebSockets] Connection Error:', error.message);
});
