'use strict';

class ApiError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode || 400;
    this.code = code || 'CHAT_ERROR';
  }
}

module.exports = {
  ApiError,
};
