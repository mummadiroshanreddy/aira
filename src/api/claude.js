// ════════════════════════════════
// FILE: src/api/claude.js (v4.0 MASTER)
// ════════════════════════════════

import { socket } from './socket';

let currentStreamId = null;

export const cancelActiveStream = () => {
  if (currentStreamId) {
    socket.emit('cancel_stream', { streamId: currentStreamId });
    currentStreamId = null;
  }
};

const buildPayload = (systemPrompt, messages, userId) => ({
  userId: userId || 'anonymous',
  system: systemPrompt,
  messages: messages.map(m => ({ role: m.role, content: m.content })).slice(-10),
});

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
    const messages = [...history];
    if (userMessage) messages.push({ role: 'user', content: userMessage });

    const payload = buildPayload(systemPrompt, messages, userId);

    if (!socket.connected) {
      if (onError) onError(new Error('Socket disconnected'));
      return reject();
    }

    let fullText = '';
    
    // Cleanup listeners
    const cleanup = () => {
      socket.off('chunk', handleChunk);
      socket.off('provider', handleProvider);
      socket.off('fallback', handleFallback);
      socket.off('done', handleDone);
      socket.off('error', handleError);
    };

    const handleChunk = ({ data }) => {
      fullText += data;
      if (onChunk) onChunk(data);
    };

    const handleProvider = ({ name, id }) => {
      if (onProviderInfo) onProviderInfo(name, id);
    };

    const handleFallback = ({ from, to }) => {
      if (onProviderSwitch) onProviderSwitch(from, to);
    };

    const handleDone = () => {
      if (onDone) onDone(fullText);
      cleanup();
      resolve(fullText);
    };

    const handleError = ({ message }) => {
      if (onError) onError(new Error(message));
      cleanup();
      reject(new Error(message));
    };

    socket.on('chunk', handleChunk);
    socket.on('provider', handleProvider);
    socket.on('fallback', handleFallback);
    socket.on('done', handleDone);
    socket.on('error', handleError);

    socket.emit('chat_stream', payload);
  });
};

export const callClaude = async (systemPrompt, userMessage, history = [], userId) => {
  let fullText = '';
  return new Promise((resolve, reject) => {
    streamClaude(
      systemPrompt,
      userMessage,
      history,
      userId || 'anonymous',
      (chunk) => { fullText += chunk; },
      () => resolve(fullText),
      (err) => reject(err)
    ).catch(reject);
  });
};

export default {
  streamClaude,
  cancelActiveStream,
  callClaude
};
