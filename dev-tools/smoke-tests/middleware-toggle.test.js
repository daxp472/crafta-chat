'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { chat } = require('../../src');

test('middleware-toggle.test: disabled features behave as no-op', async () => {
  const app = chat({
    features: {
      rateLimit: false,
      auditLogs: false,
      realtime: false,
    },
  });

  await app.createRoom('r1', ['u1']);

  for (let i = 0; i < 50; i += 1) {
    const sent = await app.sendMessage({ roomId: 'r1', userId: 'u1', text: `msg-${i}` });
    assert.equal(typeof sent.id, 'string');
  }

  assert.deepEqual(app.joinChannel('r1', { userId: 'u1' }), { joined: false, reason: 'realtime_disabled' });
  assert.equal(app.getAuditLogs().length, 0);
  app.close();
});
