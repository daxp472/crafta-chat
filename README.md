# @dax-crafta/chat

[![npm version](https://img.shields.io/npm/v/%40dax-crafta%2Fchat.svg)](https://www.npmjs.com/package/@dax-crafta/chat)
[![npm downloads/month](https://img.shields.io/npm/dm/%40dax-crafta%2Fchat.svg)](https://www.npmjs.com/package/@dax-crafta/chat)
[![license](https://img.shields.io/npm/l/%40dax-crafta%2Fchat.svg)](https://www.npmjs.com/package/@dax-crafta/chat)

Production-ready chat engine for Node.js that plugs into your **existing backend** instead of replacing it.

Package: @dax-crafta/chat

## Start Here

Use this package in four steps:

1. Install it.
2. Initialize it with your app config.
3. Connect it to your rooms, users, and MongoDB.
4. Turn on realtime only if your backend needs it.

## 1. Install

```bash
npm install @dax-crafta/chat
```

## 2. Import and Create the Instance

```js
const { chat } = require('@dax-crafta/chat');

const app = chat();
```

If you want your own defaults, pass config:

```js
const app = chat({
  features: {
    rateLimit: true,
    auditLogs: true,
    realtime: true,
  },
});
```

## 3. Create a Room or Channel

```js
(async () => {
  const room = await app.createGroupChannel({
    roomId: 'team-general',
    name: 'Team General',
    members: ['u1', 'u2'],
  });

  console.log(room);
})().catch(console.error);
```

Use `createDirectChannel()` for person-to-person chat and `createGroupChannel()` for multi-user chat.

## 4. Send, Read, React, and Mark Seen

```js
(async () => {
  const message = await app.sendMessage({
    roomId: 'team-general',
    userId: 'u1',
    text: 'Hello team',
  });

  await app.addReaction({
    roomId: 'team-general',
    messageId: message.id,
    userId: 'u2',
    reaction: 'like',
  });

  await app.markSeen({
    roomId: 'team-general',
    messageId: message.id,
    userId: 'u2',
  });

  const messages = await app.readMessages({ roomId: 'team-general' });
  console.log(messages);
})().catch(console.error);
```

## Core Promise

- One call setup: `chat({...})`
- Works with JS and TS
- Feature toggles with secure defaults
- Realtime can be turned on/off
- Socket channel integration via adapter
- Presence, reply, reactions, seen receipts
- Group and person-to-person channels
 - MongoDB adapter helper for saving in your own DB

## Existing Backend Integration

You pass your own identity and user fields from your app, for example:

- Your user id
- Your user name
- Your tenant/org id
- Your own auth/session context

This package does not force user management. It uses what you pass from your own app and auth layer.

## 5. Connect Realtime Only When Needed

If you already use sockets, pass your own adapter.

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

Use `setUserOffline()` when the socket closes or the user disconnects.

## 6. Save Data in Your MongoDB

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

If you want to stay on your own backend, this is the cleanest path.

## 7. Configure Defaults and Feature Flags

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

If you do not pass a value, the package uses the default.

## 8. Listen to Events

```js
app.on('message', (message) => {
  console.log('new message', message);
});

app.on('presence', (status) => {
  console.log('presence update', status);
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

## Detailed Guide

For a full breakdown of config, room types, realtime events, Mongo adapter usage, and integration patterns, read [docs/DETAILED-GUIDE.md](docs/DETAILED-GUIDE.md).

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
