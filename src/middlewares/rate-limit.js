'use strict';

function createRateLimiter(config) {
  const counters = new Map();

  function keyOf(input) {
    return `${input.roomId}:${input.userId}`;
  }

  function hit(input) {
    if (!config.enabled) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const key = keyOf(input);
    const item = counters.get(key) || { windowStart: now, count: 0 };

    if (now - item.windowStart >= config.windowMs) {
      item.windowStart = now;
      item.count = 0;
    }

    item.count += 1;
    counters.set(key, item);

    const remaining = Math.max(config.maxEvents - item.count, 0);
    return {
      allowed: item.count <= config.maxEvents,
      remaining,
      retryAfterMs: item.count > config.maxEvents ? config.windowMs - (now - item.windowStart) : 0,
    };
  }

  return {
    hit,
  };
}

module.exports = {
  createRateLimiter,
};
