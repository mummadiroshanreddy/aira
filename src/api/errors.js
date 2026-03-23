// ════════════════════════════════
// FILE: src/api/errors.js
// ════════════════════════════════

export class ARIAError extends Error {
  constructor(message, code, retryAfter = null) {
    super(message);
    this.name = 'ARIAError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export class RateLimitError extends ARIAError {
  constructor(message, retryAfter) {
    super(message, ERROR_CODES.RATE_LIMITED, retryAfter);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends ARIAError {
  constructor(message) {
    super(message, ERROR_CODES.NETWORK_FAILED);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends ARIAError {
  constructor(message) {
    super(message, ERROR_CODES.INVALID_RESPONSE);
    this.name = 'ValidationError';
  }
}

export class ServerError extends ARIAError {
  constructor(message) {
    super(message, ERROR_CODES.SERVER_ERROR);
    this.name = 'ServerError';
  }
}

export const ERROR_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_FAILED: 'NETWORK_FAILED',
  SERVER_ERROR: 'SERVER_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  TIMEOUT: 'TIMEOUT',
  PROXY_DOWN: 'PROXY_DOWN',
};

export const parseAPIError = (status, data) => {
  const message = data?.error || 'Unknown API Error';
  
  if (status === 429) {
    return new RateLimitError(message, data?.retryAfter || 60);
  }
  if (status >= 500) {
    return new ServerError(message);
  }
  if (status === 0 || status === 'NETWORK_ERROR') {
    return new NetworkError('Network connection failed');
  }
  
  return new ARIAError(message, data?.code || ERROR_CODES.INVALID_RESPONSE);
};

export const getErrorMessage = (error) => {
  if (error instanceof RateLimitError) {
    return `Too many requests. Try again in ${error.retryAfter || 60} seconds.`;
  }
  if (error instanceof NetworkError) {
    return "Connection failed. Check your internet.";
  }
  if (error instanceof ServerError) {
    if (error.message.includes('PROXY_DOWN')) {
      return "Secure proxy server is unreachable. Please verify server is online.";
    }
    return "Server error. Try again in a moment.";
  }
  if (error instanceof ValidationError) {
    return "Invalid request formatting.";
  }
  if (error.code === ERROR_CODES.TIMEOUT) {
    return "Request timed out. Please try again.";
  }
  return error.message || "Something went wrong. Please try again.";
};
