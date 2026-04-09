'use strict';

const DEFAULT_REDACT_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie'];

function redactSensitive(input, extraKeys) {
  const keys = new Set(DEFAULT_REDACT_KEYS.concat(extraKeys || []).map((key) => String(key).toLowerCase()));

  function walk(value) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(walk);
    }

    const out = {};
    for (const [key, current] of Object.entries(value)) {
      if (keys.has(key.toLowerCase())) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = walk(current);
      }
    }
    return out;
  }

  return walk(input);
}

module.exports = {
  redactSensitive,
  DEFAULT_REDACT_KEYS,
};
