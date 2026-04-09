'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { chat, ApiError } = require('../../src');

test('message-validation.test: rejects empty and oversized messages', async () => {
  const app = chat({
    limits: {
      maxMessageLength: 5,
    },
  });

  await app.createRoom('room-validate', ['u1']);

  await assert.rejects(() => app.sendMessage({ roomId: 'room-validate', userId: 'u1', text: '   ' }), ApiError);
  await assert.rejects(() => app.sendMessage({ roomId: 'room-validate', userId: 'u1', text: '123456' }), ApiError);

  const ok = await app.sendMessage({ roomId: 'room-validate', userId: 'u1', text: 'hello' });
  assert.equal(ok.text, 'hello');

  app.close();
});
