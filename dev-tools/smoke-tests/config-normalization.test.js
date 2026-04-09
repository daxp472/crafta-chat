'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeConfig } = require('../../src');

test('config-normalization.test: supports legacy flags and deep merges', () => {
  const result = normalizeConfig({
    emailVerification: true,
    enableCSRF: true,
    features: {
      rateLimit: false,
    },
    limits: {
      rateLimit: {
        maxEvents: 2,
      },
    },
  });

  assert.equal(result.config.features.emailVerification, true);
  assert.equal(result.config.features.csrf, true);
  assert.equal(result.config.features.rateLimit, false);
  assert.equal(result.config.features.realtime, true);
  assert.equal(result.config.limits.rateLimit.maxEvents, 2);
  assert.equal(result.config.limits.rateLimit.windowMs > 0, true);
  assert.equal(result.config.realtime.enabled, true);
});
