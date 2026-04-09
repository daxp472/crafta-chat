'use strict';

const { ApiError } = require('../utils/api-error');

function validateMessagePayload(payload, limits) {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('Payload is required', 400, 'INVALID_PAYLOAD');
  }

  if (!payload.roomId || !payload.userId) {
    throw new ApiError('roomId and userId are required', 400, 'INVALID_PAYLOAD');
  }

  if (typeof payload.text !== 'string') {
    throw new ApiError('Message text must be string', 400, 'INVALID_MESSAGE');
  }

  const text = payload.text.trim();
  if (!text) {
    throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE');
  }

  if (text.length > limits.maxMessageLength) {
    throw new ApiError('Message exceeds max length', 413, 'MESSAGE_TOO_LARGE');
  }

  return {
    roomId: String(payload.roomId),
    userId: String(payload.userId),
    text,
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
  };
}

module.exports = {
  validateMessagePayload,
};
