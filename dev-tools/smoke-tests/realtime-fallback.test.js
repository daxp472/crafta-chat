'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { chat } = require('../../src');

test('realtime-fallback.test: reconnect ordering, dedupe signal, ack timeout handling', async () => {
  const app = chat({
    realtime: {
      ackTimeoutMs: 20,
    },
  });

  await app.createRoom('rt', ['u1']);

  let timeoutSeen = false;
  let presenceSeen = false;
  const unsubscribe = app.on('ack-timeout', () => {
    timeoutSeen = true;
  });
  const unPresence = app.on('presence', () => {
    presenceSeen = true;
  });

  assert.deepEqual(app.joinChannel('rt', { userId: 'u1' }), { joined: true });
  app.setUserOnline({ userId: 'u1', roomId: 'rt', sessionId: 's1' });

  const m1 = await app.sendMessage({ roomId: 'rt', userId: 'u1', text: 'first', dedupeKey: 'k1' });
  await app.sendMessage({ roomId: 'rt', userId: 'u1', text: 'second', dedupeKey: 'k1' });

  const replay = app.reconnect('session-1', [
    { id: 'b', roomId: 'rt', userId: 'u1', text: 'later', metadata: {}, createdAt: 2 },
    { id: 'a', roomId: 'rt', userId: 'u1', text: 'earlier', metadata: {}, createdAt: 1 },
  ]);

  assert.equal(replay[0].id, 'a');
  assert.equal(replay[1].id, 'b');

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(timeoutSeen, true);
  assert.equal(presenceSeen, true);

  assert.equal(app.acknowledge(m1.id), false);
  assert.equal(app.getUserStatus('u1').status, 'online');
  app.setUserOffline({ userId: 'u1', roomId: 'rt', sessionId: 's1' });
  assert.equal(app.getUserStatus('u1').status, 'offline');

  unsubscribe();
  unPresence();
  app.close();
});
