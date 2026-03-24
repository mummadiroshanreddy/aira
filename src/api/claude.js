// ════════════════════════════════
// FILE: src/api/claude.js (v4.2 — event names match server)
// ════════════════════════════════
// Server emits: stream_start, stream_token, stream_end, stream_error, stream_fallback
// This file listens to those exact event names.
// ════════════════════════════════

import { socket } from './socket';

let currentStreamId = null;

export const cancelActiveStream = () => {
  if (currentStreamId) {
    socket.emit('cancel_stream', { streamId: currentStreamId });
    currentStreamId = null;
  }
};

export const streamClaude = (
  systemPrompt,
  userMessage,
  history = [],
  userId,
  onChunk,
  onDone,
  onError,
  onProviderInfo,
  onProviderSwitch
) => {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      const err = new Error('Socket not connected. Check server is running on port 3001.');
      if (onError) onError(err);
      return reject(err);
    }

    // Build message array
    const messages = [...history.map(m => ({ role: m.role, content: m.content }))];
    if (userMessage) messages.push({ role: 'user', content: userMessage });

    const payload = {
      userId: userId || 'anonymous',
      system: systemPrompt,
      messages: messages.slice(-12), // cap context window
    };

    let fullText = '';
    let streamId = null;

    // ── Event Handlers (matching server event names exactly) ──
    const handleStart = ({ streamId: id, provider }) => {
      streamId = id;
      currentStreamId = id;
      if (onProviderInfo) {
        const displayName = provider === 'groq' ? '⚡ Groq' : '✨ Gemini';
        onProviderInfo(displayName, provider);
      }
    };

    const handleToken = ({ streamId: id, chunk }) => {
      // chunk is an object: { type, delta: { type, text } }
      if (streamId && id !== streamId) return;
      const text = chunk?.delta?.text ?? chunk?.text ?? '';
      if (text) {
        fullText += text;
        if (onChunk) onChunk(text);
      }
    };

    const handleEnd = ({ streamId: id }) => {
      if (streamId && id !== streamId) return;
      cleanup();
      currentStreamId = null;
      if (onDone) onDone(fullText);
      resolve(fullText);
    };

    const handleError = ({ streamId: id, error }) => {
      if (streamId && id && id !== streamId) return;
      cleanup();
      currentStreamId = null;
      const err = new Error(error || 'Stream failed');
      if (onError) onError(err);
      reject(err);
    };

    const handleFallback = ({ streamId: id, from, to }) => {
      if (streamId && id !== streamId) return;
      if (onProviderSwitch) onProviderSwitch(from, to);
      if (onProviderInfo) {
        const displayName = to === 'groq' ? '⚡ Groq' : '✨ Gemini';
        onProviderInfo(displayName, to);
      }
    };

    const cleanup = () => {
      socket.off('stream_start', handleStart);
      socket.off('stream_token', handleToken);
      socket.off('stream_end', handleEnd);
      socket.off('stream_error', handleError);
      socket.off('stream_fallback', handleFallback);
    };

    // Register listeners
    socket.on('stream_start', handleStart);
    socket.on('stream_token', handleToken);
    socket.on('stream_end', handleEnd);
    socket.on('stream_error', handleError);
    socket.on('stream_fallback', handleFallback);

    // Fire the request
    socket.emit('chat_stream', payload);
  });
};

// Promise-based wrapper for non-streaming components (ConfidenceScorer etc.)
export const callClaude = (systemPrompt, userMessage, history = [], userId) => {
  return streamClaude(systemPrompt, userMessage, history, userId,
    () => {}, // onChunk — ignore
    (full) => full, // onDone
    null, null, null
  );
};

export default { streamClaude, cancelActiveStream, callClaude };
