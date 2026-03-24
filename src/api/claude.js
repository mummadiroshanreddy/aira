// ════════════════════════════════
// FILE: src/api/claude.js (v4.3)
// Server emits: stream_start, stream_token, stream_end, stream_error, stream_fallback
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
      const err = new Error('Socket not connected. Is the server running on port 3001?');
      if (onError) onError(err);
      return reject(err);
    }

    // Build messages — FILTER OUT empty content to prevent server validation failure
    const messages = history
      .map(m => ({ role: m.role, content: m.content }))
      .filter(m => m.role && m.content && m.content.trim() !== '');

    if (userMessage && userMessage.trim()) {
      messages.push({ role: 'user', content: userMessage.trim() });
    }

    if (messages.length === 0) {
      const err = new Error('No valid messages to send');
      if (onError) onError(err);
      return reject(err);
    }

    const payload = {
      userId: userId || 'anonymous',
      system: systemPrompt,
      messages: messages.slice(-12), // keep last 12 turns
    };

    let fullText = '';
    let streamId = null;

    const handleStart = ({ streamId: id, provider }) => {
      streamId = id;
      currentStreamId = id;
      if (onProviderInfo) {
        onProviderInfo(provider === 'groq' ? '⚡ Groq' : provider === 'gemini' ? '✨ Gemini' : '🦙 Ollama', provider);
      }
    };

    const handleToken = ({ streamId: id, chunk }) => {
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
        const name = to === 'groq' ? '⚡ Groq' : to === 'gemini' ? '✨ Gemini' : '🦙 Ollama';
        onProviderInfo(name, to);
      }
    };

    const cleanup = () => {
      socket.off('stream_start', handleStart);
      socket.off('stream_token', handleToken);
      socket.off('stream_end', handleEnd);
      socket.off('stream_error', handleError);
      socket.off('stream_fallback', handleFallback);
    };

    socket.on('stream_start', handleStart);
    socket.on('stream_token', handleToken);
    socket.on('stream_end', handleEnd);
    socket.on('stream_error', handleError);
    socket.on('stream_fallback', handleFallback);

    socket.emit('chat_stream', payload);
  });
};

// Promise-based wrapper (used by non-streaming components)
export const callClaude = (systemPrompt, userMessage, history = [], userId) => {
  return streamClaude(systemPrompt, userMessage, history, userId,
    () => {}, (full) => full, null, null, null
  );
};

export default { streamClaude, cancelActiveStream, callClaude };
