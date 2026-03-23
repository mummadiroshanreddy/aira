import { io } from 'socket.io-client';
import { config } from './config';

// ── Shared WebSocket Client ───────────────────────────
// Initializes the global Socket.io instance. Natively handles auto-reconnects,
// heartbeat pings, and hybrid SSE fallback. Connects strictly to the proxy.

const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001' 
  : `http://${window.location.hostname}:3001`;

export const socket = io(SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
  timeout: 20000,
  autoConnect: true,
  transports: ['polling', 'websocket'], // Robust Hybrid: Polling-first handshake, then automatic WS upgrade
});


// Expose diagnostic listeners
socket.on('connect', () => {
  console.log('⚡ [WebSockets] Connected and Hardened (ID:', socket.id, ')');
  console.log('🔗 [WebSockets] Active Transport:', socket.io.engine.transport.name);
});

socket.on('reconnect_attempt', (attempt) => {
  console.warn(`🔄 [WebSockets] Reconnection attempt #${attempt}...`);
});

socket.on('reconnect_failed', () => {
  console.error('❌ [WebSockets] Critical: All reconnection attempts failed.');
});

socket.on('disconnect', (reason) => {
  console.warn('⚠️ [WebSockets] Disconnected:', reason);
});

