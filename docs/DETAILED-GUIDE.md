# Detailed Guide for @dax-crafta/chat

This guide explains the package in a practical, step-by-step way so you can wire it into an existing backend quickly and safely.

## 1. What This Package Is

`@dax-crafta/chat` is a backend-integrated chat module. It is designed to be imported into an existing app, not used as a standalone chat platform.

Use it when you want:

- direct message chat
- group chat
- realtime presence
- seen receipts
- reactions
- reply support
- MongoDB persistence in your own database
- a single entry point with sensible defaults

## 2. Basic Installation

```bash
npm install @dax-crafta/chat
```

If you are using Crafta already, keep your current auth/session flow and pass user data from your own backend into the chat calls.

## 3. Create the Chat Instance

```js
const { chat } = require('@dax-crafta/chat');

const app = chat();
```

If you want custom behavior, pass a config object:

```js
const app = chat({
  features: {
    realtime: true,
    rateLimit: true,
    auditLogs: true,
    antiSpam: true,
  },
  realtime: {
    enabled: true,
    ackTimeoutMs: 4000,
  },
});
```

### Important default behavior

- Missing optional settings fall back to defaults.
- Optional adapters never crash startup.
- If realtime is disabled, channel methods still return safely.
- Rate limiting and validation are safe by default.

## 4. Feature Flags

Use `features` to turn capabilities on or off.

Common supported flags:

- `emailVerification`
- `loginAlerts`
- `securityAttempts`
- `rateLimit`
- `auditLogs`
- `twoFactor`
- `csrf`
- `antiSpam`
- `realtime`

Example:

```js
const app = chat({
  features: {
    realtime: true,
    auditLogs: true,
    rateLimit: true,
    antiSpam: true,
    csrf: false,
  },
});
```

### Legacy flags

The package also supports legacy top-level flags like:

- `emailVerification`
- `loginAlerts`
- `enableCSRF`

These are mapped into the `features` object during config normalization.

## 5. Room and Channel Types

You can use the package in three common ways:

### A. Generic room

```js
await app.createRoom('room-1', ['u1', 'u2']);
```

### B. Direct channel

```js
await app.createDirectChannel({
  userA: 'u1',
  userB: 'u2',
  name: 'Private chat',
});
```

### C. Group channel

```js
await app.createGroupChannel({
  roomId: 'team-general',
  name: 'Team General',
  members: ['u1', 'u2', 'u3'],
});
```

Use direct channels for one-to-one conversations and group channels for larger groups.

## 6. Sending Messages

```js
const message = await app.sendMessage({
  roomId: 'team-general',
  userId: 'u1',
  text: 'Hello team',
});
```

### Message payload

- `roomId`: where the message goes
- `userId`: who sent it
- `text`: the message body
- `metadata`: custom data from your app
- `id`: optional custom id
- `dedupeKey`: optional retry-safe dedupe key
- `replyTo`: optional parent message id

### Reply example

```js
await app.sendMessage({
  roomId: 'team-general',
  userId: 'u2',
  text: 'Replying to you',
  replyTo: message.id,
});
```

## 7. Reading Messages

```js
const page = await app.readMessages({
  roomId: 'team-general',
  limit: 20,
});
```

Pagination supports:

- `limit`
- `cursor`
- `direction` (`forward` or `backward`)

If a cursor is invalid or stale, the package throws a clear error.

## 8. Message Updates

### Edit a message

```js
await app.editMessage({
  roomId: 'team-general',
  messageId: message.id,
  text: 'Updated text',
});
```

### Delete a message

```js
await app.deleteMessage({
  roomId: 'team-general',
  messageId: message.id,
});
```

Edits and deletes are audited when audit logging is enabled.

## 9. Reactions and Seen Receipts

### Add a reaction

```js
await app.addReaction({
  roomId: 'team-general',
  messageId: message.id,
  userId: 'u2',
  reaction: 'like',
});
```

### Remove a reaction

```js
await app.removeReaction({
  roomId: 'team-general',
  messageId: message.id,
  userId: 'u2',
  reaction: 'like',
});
```

### Mark as seen

```js
await app.markSeen({
  roomId: 'team-general',
  messageId: message.id,
  userId: 'u2',
});
```

These methods are useful for:

- read receipts
- delivery tracking
- user activity UI
- notification cleanup

## 10. Presence

Presence is useful when your frontend wants online/offline status.

### Set online

```js
app.setUserOnline({
  userId: 'u1',
  roomId: 'team-general',
  sessionId: 'session-123',
});
```

### Set offline

```js
app.setUserOffline({
  userId: 'u1',
  roomId: 'team-general',
  sessionId: 'session-123',
});
```

### Check current status

```js
const status = app.getUserStatus('u1');
```

## 11. Realtime and Socket Integration

Realtime is opt-in and can be turned off.

### Enable realtime

```js
const app = chat({
  features: {
    realtime: true,
  },
  realtime: {
    enabled: true,
    ackTimeoutMs: 4000,
  },
});
```

### Connect your own socket adapter

```js
const socketAdapter = {
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
  realtime: { enabled: true },
  optional: {
    realtimeAdapter: socketAdapter,
  },
});
```

### Common realtime events

- `message`
- `ack`
- `ack-timeout`
- `presence`
- `channel-join`
- `channel-leave`

### Channel join/leave

```js
app.joinChannel('team-general', { userId: 'u1', socket });
app.leaveChannel('team-general', { userId: 'u1', socket });
```

## 12. MongoDB Persistence

Use the helper when you want to save chat data in your own MongoDB collections.

```js
const { chat, createMongoPersistenceAdapter } = require('@dax-crafta/chat');

const adapter = createMongoPersistenceAdapter({
  rooms: db.collection('chat_rooms'),
  messages: db.collection('chat_messages'),
});

const app = chat({
  optional: {
    persistenceAdapter: adapter,
  },
});
```

This is the best setup when:

- your backend already owns authentication
- you want your own database schema
- you want chat data alongside your app data
- you want to avoid a separate chat backend

## 13. Config Reference

### limits

- `maxMessageLength`
- `pageSize`
- `rateLimit.maxEvents`
- `rateLimit.windowMs`

### policy

- `redactKeys`: extra keys to remove from audit context

### realtime

- `enabled`: turn realtime on or off
- `ackTimeoutMs`: wait time before ack timeout event

### optional

- `persistenceAdapter`: your own persistence layer
- `realtimeAdapter`: your own socket layer
- `customLogger`: your logger bridge

## 14. Error Handling

The package throws `ApiError` for expected application failures.

Examples:

- empty message
- message too large
- invalid cursor
- room deleted
- user not in room
- rate limit exceeded

Catch errors like this:

```js
try {
  await app.sendMessage({ roomId: 'x', userId: 'u1', text: '' });
} catch (error) {
  console.error(error.message);
}
```

## 15. Practical Integration Pattern

A common backend flow is:

1. Authenticate user in your app.
2. Load user id, name, tenant id, and session data.
3. Create the chat instance once.
4. Pass room ids and user ids from your own backend.
5. Use MongoDB collections from your own database.
6. Connect socket adapter if realtime is needed.

## 16. Testing Before Publish

Run the smoke suite before every release:

```bash
npm test
```

The suite covers:

- exports
- config normalization
- feature toggles
- message validation
- realtime fallback
- cursor behavior
- security/audit behavior

## 17. Minimal Production Checklist

Before publishing or installing in production:

- set the package version
- verify README examples with your backend
- confirm Mongo collection names
- verify socket adapter behavior
- run npm test
- publish

## 18. When You Should Disable Realtime

Turn realtime off if:

- your app only needs stored chat history
- your backend does not use sockets yet
- you want to ship the first version with less moving parts

The package will still work for room, message, and persistence operations.

## 19. Summary

This package is meant to be simple for developers and safe for production. The main idea is:

- you own auth
- you own data
- you own sockets if needed
- this package gives you the chat behavior

That keeps the integration fast and flexible.
