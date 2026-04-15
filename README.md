# @dax-crafta/chat

[![npm version](https://img.shields.io/npm/v/%40dax-crafta%2Fchat.svg)](https://www.npmjs.com/package/@dax-crafta/chat)
[![npm downloads/month](https://img.shields.io/npm/dm/%40dax-crafta%2Fchat.svg)](https://www.npmjs.com/package/@dax-crafta/chat)
[![license](https://img.shields.io/npm/l/%40dax-crafta%2Fchat.svg)](https://www.npmjs.com/package/@dax-crafta/chat)

Production-ready chat engine for Node.js that is made to plug into your **existing backend**, not replace it.

Package: @dax-crafta/chat

## Core Promise

- One call setup: `chat({...})`
- Works with JS and TS
- Feature toggles with secure defaults
- Realtime can be turned on/off
- Socket channel integration via adapter
- Presence, reply, reactions, seen receipts
- Group and person-to-person channels
- MongoDB adapter helper for saving in your own DB

## Install

```bash
npm install @dax-crafta/chat
```

## Quick Start

```js
const { chat } = require('@dax-crafta/chat');

(async () => {
  const app = chat({
    features: {
      realtime: true,
      rateLimit: true,
      auditLogs: true,
    },
  });

  await app.createGroupChannel({
    roomId: 'team-general',
    name: 'Team General',
    members: ['u1', 'u2'],
  });

  const message = await app.sendMessage({
    roomId: 'team-general',
    userId: 'u1',
    text: 'Hello team',
  });

  await app.markSeen({ roomId: 'team-general', messageId: message.id, userId: 'u2' });
  await app.addReaction({ roomId: 'team-general', messageId: message.id, userId: 'u2', reaction: 'like' });

  console.log(await app.readMessages({ roomId: 'team-general' }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## Existing Backend Integration

You pass your own identity and user fields from your app, for example:

- Your user id
- Your user name
- Your tenant/org id
- Your own auth/session context

This package does not force user management. It uses what you pass from your own app and auth layer.

## Realtime On/Off + Socket Adapter

`features.realtime` and `realtime.enabled` together control transport.

When realtime is on, provide your adapter from your socket layer.

```js
const ioAdapter = {
  emit(event, payload) {
    io.to(payload.roomId || 'global').emit(event, payload);
  },
  joinChannel(channelId, context) {
    if (context.socket && context.socket.join) {
      context.socket.join(channelId);
    }
  },
  leaveChannel(channelId, context) {
    if (context.socket && context.socket.leave) {
      context.socket.leave(channelId);
    }
  },
};

const app = chat({
  features: { realtime: true },
  realtime: { enabled: true, ackTimeoutMs: 4000 },
  optional: { realtimeAdapter: ioAdapter },
});

app.joinChannel('team-general', { userId: 'u1', socket });
app.setUserOnline({ userId: 'u1', roomId: 'team-general', sessionId: 's1' });
```

## MongoDB Storage (Your Database)

Use your existing Mongo collections.

```js
const { chat, createMongoPersistenceAdapter } = require('@dax-crafta/chat');

const persistenceAdapter = createMongoPersistenceAdapter({
  rooms: db.collection('chat_rooms'),
  messages: db.collection('chat_messages'),
});

const app = chat({
  optional: {
    persistenceAdapter,
  },
});
```

## Config Shape

```js
chat({
  emailVerification: true,
  loginAlerts: false,
  enableCSRF: false,
  features: {
    emailVerification: true,
    loginAlerts: false,
    securityAttempts: true,
    rateLimit: true,
    auditLogs: true,
    twoFactor: false,
    csrf: false,
    antiSpam: true,
    realtime: true,
  },
  limits: {
    maxMessageLength: 4000,
    pageSize: 50,
    rateLimit: {
      maxEvents: 40,
      windowMs: 10000,
    },
  },
  realtime: {
    enabled: true,
    ackTimeoutMs: 4000,
  },
  policy: {
    redactKeys: ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey'],
  },
  optional: {
    persistenceAdapter: null,
    realtimeAdapter: null,
    customLogger: null,
  },
});
```

## API

- `chat(config?)`
- `createRoom(roomId, members?, options?)`
- `createDirectChannel({ userA, userB, roomId?, name?, metadata? })`
- `createGroupChannel({ roomId, name?, members?, metadata? })`
- `joinChannel(channelId, userContext?)`
- `leaveChannel(channelId, userContext?)`
- `setUserOnline({ userId, roomId?, sessionId?, meta? })`
- `setUserOffline({ userId, roomId?, sessionId?, meta? })`
- `getUserStatus(userId)`
- `sendMessage({ roomId, userId, text, metadata?, id?, dedupeKey?, replyTo? })`
- `editMessage({ roomId, messageId, text })`
- `deleteMessage({ roomId, messageId })`
- `addReaction({ roomId, messageId, userId, reaction })`
- `removeReaction({ roomId, messageId, userId, reaction })`
- `markSeen({ roomId, messageId, userId, seenAt? })`
- `readMessages({ roomId, limit?, cursor?, direction? })`
- `unreadCount(roomId, userId)`
- `acknowledge(messageId)`
- `reconnect(sessionId, missedMessages)`
- `on(event, handler)`
- `close()`
- `getConfig()`, `getWarnings()`, `getAuditLogs()`

## Why Teams Choose It

- No lock-in: works with your current backend and auth flow.
- Fast setup: one initialization call, sensible defaults.
- Realtime flexibility: turn transport on/off without rewriting app logic.
- Production safety: payload validation, rate limiting, audit logs, redaction.
- Extensible persistence: in-memory default, Mongo adapter helper for your DB.

## Events You Can Listen

- `message`
- `ack`
- `ack-timeout`
- `presence`
- `channel-join`
- `channel-leave`

## Fail-Safe Behavior

- Invalid optional adapter never crashes startup.
- Missing optional integrations fallback to internal behavior.
- Warnings are explicit via logger.

## Run Smoke Tests

```bash
npm test
```

Includes 7 smoke tests for exports, config normalization, middleware toggle behavior, payload validation, realtime fallback, cursor behavior, and security/audit safeguards.

## Publish Checklist

- Update version in package.json
- Run npm test
- Verify README examples with your backend
- Publish: npm publish
