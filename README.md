# crafta-chat

[![npm version](https://img.shields.io/npm/v/crafta-chat.svg)](https://www.npmjs.com/package/crafta-chat)
[![npm downloads/month](https://img.shields.io/npm/dm/crafta-chat.svg)](https://www.npmjs.com/package/crafta-chat)
[![license](https://img.shields.io/npm/l/crafta-chat.svg)](https://www.npmjs.com/package/crafta-chat)

Production-ready chat engine for Node.js that is made to plug into your **existing backend**, not replace it.

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
npm install crafta-chat
```

## Quick Start

```js
const { chat } = require('crafta-chat');

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
```

## Existing Backend Integration

You pass your own identity and user fields from your app, for example:

- Your user id
- Your user name
- Your tenant/org id
- Your own auth/session context

`crafta-chat` does not force user management. It uses what you pass in payload and metadata.

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
const { chat, createMongoPersistenceAdapter } = require('crafta-chat');

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
