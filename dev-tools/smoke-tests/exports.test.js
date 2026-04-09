'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const mod = require('../../src');

test('exports.test: runtime exports are present', () => {
  const keys = Object.keys(mod).sort();
  assert.deepEqual(keys, ['AUDIT_ACTIONS', 'ApiError', 'DEFAULT_CONFIG', 'chat', 'createMongoPersistenceAdapter', 'normalizeConfig'].sort());
  assert.equal(typeof mod.chat, 'function');
  assert.equal(typeof mod.normalizeConfig, 'function');
  assert.equal(typeof mod.createMongoPersistenceAdapter, 'function');
});
