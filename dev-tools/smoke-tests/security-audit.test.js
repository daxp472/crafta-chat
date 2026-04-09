'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { chat, AUDIT_ACTIONS } = require('../../src');

test('security-audit.test: enums are used and sensitive fields are redacted', async () => {
  const app = chat({
    policy: {
      redactKeys: ['token'],
    },
  });

  await app.createRoom('audit', ['u1']);
  const first = await app.sendMessage({
    roomId: 'audit',
    userId: 'u1',
    text: 'secure',
    metadata: {
      token: 'abc123',
      safe: 'ok',
    },
  });

  const second = await app.sendMessage({
    roomId: 'audit',
    userId: 'u1',
    text: 'reply message',
    replyTo: first.id,
  });

  await app.addReaction({ roomId: 'audit', messageId: second.id, userId: 'u1', reaction: 'like' });
  await app.markSeen({ roomId: 'audit', messageId: second.id, userId: 'u1' });

  const logs = app.getAuditLogs();
  assert.ok(logs.some((entry) => entry.action === AUDIT_ACTIONS.MESSAGE_SENT));
  assert.ok(logs.some((entry) => entry.action === AUDIT_ACTIONS.MESSAGE_REPLIED));
  assert.ok(logs.some((entry) => entry.action === AUDIT_ACTIONS.MESSAGE_REACTION_ADDED));
  assert.ok(logs.some((entry) => entry.action === AUDIT_ACTIONS.MESSAGE_SEEN));

  const sentLog = logs.find((entry) => entry.action === AUDIT_ACTIONS.MESSAGE_SENT);
  assert.equal(sentLog.context.metadata.token, '[REDACTED]');
  assert.equal(sentLog.context.metadata.safe, 'ok');

  app.close();
});
