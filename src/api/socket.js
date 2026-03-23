import { io } from 'socket.io-client';

// ── Shared WebSocket Client ───────────────────────────
// Handles localhost dev and production deployments (HTTP & HTTPS).

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// In production, the server and client are typically on the same host.
// In dev, the server runs on port 3001 separately.
let SERVER_URL;
if (isLocal) {
  SERVER_URL = 'http://localhost:3001';
} else if (process.env.REACT_APP_SERVER_URL) {
  SERVER_URL = process.env.REACT_APP_SERVER_URL;
} else {
  // Same host, different port (e.g., VPS deploy with server on 3001)
  const protocol = window.location.protocol; // https: or http:
  SERVER_URL = `${protocol}//${window.location.hostname}:3001`;
}

export const socket = io(SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
  timeout: 20000,
  autoConnect: true,
  transports: ['polling', 'websocket'], // Polling-first ensures reliable handshake, then auto-upgrade
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
