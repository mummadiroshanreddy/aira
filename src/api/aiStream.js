// ════════════════════════════════
// FILE: src/api/aiStream.js (v4.6 — Elite AI Streaming Engine)
// Standard interface: streamAI(prompt, callbacks)
// ════════════════════════════════

import { socket } from './socket';

let currentStreamId = null;

/**
 * Standard AI Streaming Interface
 * @param {string} prompt - The user message
 * @param {object} callbacks - { onChunk, onDone, onError, onProviderInfo, onProviderSwitch, system, history, userId }
 */
export const streamAI = (prompt, callbacks = {}) => {
  const {
    onChunk,
    onDone,
    onError,
    onProviderInfo,
    onProviderSwitch,
    system = "You are a helpful AI assistant.",
    history = [],
    userId = localStorage.getItem('aria_user_id') || 'anonymous',
    providerOverride = localStorage.getItem('aria_provider') || 'groq'
  } = callbacks;

  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      const err = new Error('Socket not connected. Ensure the server is running.');
      if (onError) onError(err);
      return reject(err);
    }

    // Prepare messages
    const messages = history
      .map(m => ({ role: m.role, content: m.content }))
      .filter(m => m.role && m.content && m.content.trim() !== '');

    if (prompt && prompt.trim()) {
      messages.push({ role: 'user', content: prompt.trim() });
    }

    const payload = {
      userId,
      system,
      messages: messages.slice(-15),
      provider: providerOverride,
    };

    let fullText = '';
    let streamId = null;
    let chunkTimeout = null;

    const resetTimeout = () => {
      if (chunkTimeout) clearTimeout(chunkTimeout);
      chunkTimeout = setTimeout(() => {
        const error = "Socket timeout: No chunk received in 5s. Check connection.";
        handleError({ streamId, error });
      }, 5000);
    };

    const handleStart = ({ streamId: id, provider: serverProvider }) => {
      streamId = id;
      currentStreamId = id;
      resetTimeout();
      if (onProviderInfo) {
        const display = serverProvider === 'groq' ? '⚡ Groq' : serverProvider === 'gemini' ? '✨ Gemini' : '🦙 Ollama';
        onProviderInfo(display, serverProvider);
      }
    };

    const handleToken = ({ streamId: id, chunk }) => {
      if (streamId && id !== streamId) return;
      resetTimeout();
      const text = chunk?.delta?.text ?? chunk?.text ?? '';
      if (text) {
        fullText += text;
        if (onChunk) onChunk(text);
      }
    };

    const handleEnd = ({ streamId: id }) => {
      if (streamId && id !== streamId) return;
      cleanup();
      if (onDone) onDone(fullText);
      resolve(fullText);
    };

    const handleError = ({ streamId: id, error }) => {
      if (streamId && id && id !== streamId) return;
      cleanup();
      const err = new Error(error || 'AI Stream Failed');
      if (onError) onError(err);
      reject(err);
    };

    const handleFallback = ({ streamId: id, from, to }) => {
      if (streamId && id !== streamId) return;
      if (onProviderSwitch) onProviderSwitch(from, to);
    };

    const cleanup = () => {
      if (chunkTimeout) clearTimeout(chunkTimeout);
      socket.off('stream_start', handleStart);
      socket.off('stream_token', handleToken);
      socket.off('stream_end', handleEnd);
      socket.off('stream_error', handleError);
      socket.off('stream_fallback', handleFallback);
      if (currentStreamId === streamId) currentStreamId = null;
    };

    socket.on('stream_start', handleStart);
    socket.on('stream_token', handleToken);
    socket.on('stream_end', handleEnd);
    socket.on('stream_error', handleError);
    socket.on('stream_fallback', handleFallback);

    socket.emit('chat_stream', payload);
  });
};

export const cancelStream = () => {
  if (currentStreamId) {
    socket.emit('cancel_stream', { streamId: currentStreamId });
    currentStreamId = null;
  }
};

/**
 * Legacy wrapper for callClaude style
 */
export const callAI = (prompt, system = "", history = []) => {
  return streamAI(prompt, { system, history });
};
