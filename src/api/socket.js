import { io } from 'socket.io-client';

// ── Shared WebSocket Client ───────────────────────────
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

let SERVER_URL;
if (isLocal) {
  SERVER_URL = 'http://localhost:3001';
} else if (process.env.REACT_APP_SERVER_URL) {
  SERVER_URL = process.env.REACT_APP_SERVER_URL;
} else {
  const protocol = window.location.protocol; // https: → wss:// automatically
  SERVER_URL = `${protocol}//${window.location.hostname}:3001`;
}

export const socket = io(SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
  timeout: 20000,
  autoConnect: true,
  transports: ['polling', 'websocket'], // Polling-first for reliable handshake, auto-upgrades to WS
});

socket.on('connect', () => {
  console.log('⚡ [Socket] Connected:', socket.id, '| Transport:', socket.io.engine.transport.name);
});

socket.on('reconnect_attempt', (attempt) => {
  console.warn(`🔄 [Socket] Reconnect attempt #${attempt}...`);
});

socket.on('reconnect_failed', () => {
  console.error('❌ [Socket] All reconnection attempts failed.');
});

socket.on('disconnect', (reason) => {
  console.warn('⚠️ [Socket] Disconnected:', reason);
});
