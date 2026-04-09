'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { chat, ApiError } = require('../../src');

test('persistence-cursor.test: pagination boundaries and cursor invalidation', async () => {
  const app = chat({
    limits: { pageSize: 2 },
  });

  await app.createRoom('cursor', ['u1']);

  await app.sendMessage({ roomId: 'cursor', userId: 'u1', text: 'm1' });
  await app.sendMessage({ roomId: 'cursor', userId: 'u1', text: 'm2' });
  const m3 = await app.sendMessage({ roomId: 'cursor', userId: 'u1', text: 'm3' });

  const p1 = await app.readMessages({ roomId: 'cursor', limit: 2 });
  assert.equal(p1.items.length, 2);
  assert.equal(typeof p1.nextCursor, 'string');

  const p2 = await app.readMessages({ roomId: 'cursor', limit: 2, cursor: p1.nextCursor });
  assert.equal(p2.items.length, 1);

  await app.deleteMessage({ roomId: 'cursor', messageId: m3.id });
  await assert.rejects(() => app.readMessages({ roomId: 'cursor', cursor: m3.id }), ApiError);

  app.close();
});
