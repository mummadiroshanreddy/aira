// ════════════════════════════════
// FILE: src/api/aiProvider.js (v4.6 — Elite AI Provider)
// RENAMED FROM: claude.js (Misleading name)
// ════════════════════════════════

import { streamAI, cancelStream } from './aiStream';

/**
 * Standard AI Streaming Interface (v4.6)
 */
export const streamClaude = (system, user, history, userId, onChunk, onDone, onError, onProviderInfo, onProviderSwitch) => {
  return streamAI(user, {
    system,
    history,
    userId,
    onChunk,
    onDone,
    onError,
    onProviderInfo,
    onProviderSwitch
  });
};

export const cancelActiveStream = cancelStream;

/**
 * Legacy Promise Wrapper
 */
export const callClaude = async (system, user, history, userId) => {
  let res = "";
  await streamClaude(system, user, history, userId, (c) => res += c);
  return res;
};

export { streamAI, cancelStream };
export default { streamAI, cancelStream, streamClaude, cancelActiveStream, callClaude };
