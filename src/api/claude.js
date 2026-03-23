// ════════════════════════════════
// FILE: src/api/claude.js
// ════════════════════════════════

import { config } from './config';
import { socket } from './socket';
import { 
  NetworkError,
  ARIAError,
  ERROR_CODES
} from './errors';

// ── Shared active state for Barge-in Interruption ────
let currentStreamId = null;

export const cancelActiveStream = () => {
  if (currentStreamId) {
    socket.emit('cancel_stream', { streamId: currentStreamId });
    console.log('[API] Barge-in! Cancelled active stream:', currentStreamId);
    currentStreamId = null;
  }
};

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const buildPayload = (systemPrompt, messages, stream = false) => ({
  model: config.model,
  max_tokens: config.maxTokens,
  system: systemPrompt,
  messages: messages,
  stream: stream
});

const buildMessages = (history = [], userMessage) => {
  const messages = [...history];
  
  // If userMessage is provided, only append it if the last message isn't already this exact user prompt
  if (userMessage && (messages.length === 0 || messages[messages.length - 1].content !== userMessage)) {
    messages.push({ role: 'user', content: userMessage });
  }

  return messages
    .filter(msg => msg && msg.role && msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0)
    .slice(-12)
    .map(msg => ({ role: msg.role, content: msg.content }));
};

export const checkProxyHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(config.healthEndpoint, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok ? { online: true, latency: 0 } : { online: false };
  } catch (error) {
    return { online: false };
  }
};

export const callClaude = async (systemPrompt, userMessage, history = [], provider) => {
  const messages = buildMessages(history, userMessage);
  const payload = buildPayload(systemPrompt, messages, false);
  payload.provider = provider || 'groq';
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(config.chatEndpoint, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
        let errorData = {};
        try { errorData = await response.json(); } catch(e) {}
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.content && data.content.length > 0) return data.content[0].text;
    throw new ARIAError('Invalid response format', ERROR_CODES.INVALID_RESPONSE);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new ARIAError('Request timed out', ERROR_CODES.TIMEOUT);
    if (!error.code && !error.status) throw new NetworkError('Cannot connect to proxy API.');
    throw error;
  }
};

export const streamClaude = (
  systemPrompt, 
  userMessage, 
  history = [],
  provider,
  onChunk,
  onDone,
  onError,
  onProviderInfo,
  onProviderSwitch
) => {
  return new Promise((resolve, reject) => {
    const messages = buildMessages(history, userMessage);
    const payload = buildPayload(systemPrompt, messages, true);
    payload.provider = provider || 'groq';

    if (!socket.connected) {
      const err = new NetworkError('Socket is disconnected. Attempting to reconnect...');
      if (onError) onError(err);
      return reject(err);
    }

    let fullText = '';
    let hasResolved = false;

    const cleanup = () => {
      socket.off('stream_start', handleStreamStart);
      socket.off('stream_token', handleToken);
      socket.off('stream_fallback', handleFallback);
      socket.off('stream_error', handleError);
      socket.off('stream_end', handleEnd);
    };

    const flush = () => {
      if (!hasResolved) {
        hasResolved = true;
        cleanup();
        currentStreamId = null;
        resolve();
      }
    };

    const handleStreamStart = ({ streamId, provider: p }) => {
      currentStreamId = streamId;
      if (onProviderInfo) onProviderInfo(p);
    };

    const handleToken = ({ streamId, chunk }) => {
      if (streamId !== currentStreamId) return;
      if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
        fullText += chunk.delta.text;
        if (onChunk) onChunk(chunk.delta.text);
      }
    };

    const handleFallback = ({ streamId, from, to }) => {
      if (streamId !== currentStreamId) return;
      if (onProviderSwitch) onProviderSwitch(from, to);
    };

    const handleError = ({ streamId, error }) => {
      if (streamId && streamId !== currentStreamId) return;
      const err = new ARIAError(error || 'Socket stream failed', ERROR_CODES.SERVER_ERROR);
      if (onError) onError(err);
      reject(err);
      flush();
    };

    const handleEnd = ({ streamId }) => {
      if (streamId !== currentStreamId) return;
      if (onDone) onDone(fullText);
      flush();
    };

    socket.on('stream_start', handleStreamStart);
    socket.on('stream_token', handleToken);
    socket.on('stream_fallback', handleFallback);
    socket.on('stream_error', handleError);
    socket.on('stream_end', handleEnd);

    socket.emit('chat_stream', payload);
  });
};

export const buildSystemPrompt = (template, setupData) => {
  let prompt = template;
  prompt = prompt.replace(/{{NAME}}/g, setupData?.name || 'Candidate');
  prompt = prompt.replace(/{{ROLE}}/g, setupData?.role || 'Applicant');
  prompt = prompt.replace(/{{COMPANY}}/g, setupData?.company || 'the company');
  prompt = prompt.replace(/{{LEVEL}}/g, setupData?.level || 'Mid-Level');
  prompt = prompt.replace(/{{TYPE}}/g, setupData?.interviewType || 'General');
  prompt = prompt.replace(/{{STYLE}}/g, setupData?.answerStyle || 'Direct');
  prompt = prompt.replace(/{{RESUME}}/g, setupData?.resume || 'No resume provided');
  prompt = prompt.replace(/{{JD}}/g, setupData?.jobDescription || 'No job description provided');
  return prompt;
};

export default {
  callClaude,
  streamClaude,
  buildSystemPrompt,
  checkProxyHealth,
  cancelActiveStream
};
