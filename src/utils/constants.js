'use strict';

const AUDIT_ACTIONS = Object.freeze({
  MESSAGE_SENT: 'message.sent',
  MESSAGE_EDITED: 'message.edited',
  MESSAGE_DELETED: 'message.deleted',
  MESSAGE_REPLIED: 'message.replied',
  MESSAGE_REACTION_ADDED: 'message.reaction.added',
  MESSAGE_REACTION_REMOVED: 'message.reaction.removed',
  MESSAGE_SEEN: 'message.seen',
  ROOM_CREATED: 'room.created',
  DIRECT_CHANNEL_CREATED: 'room.direct.created',
  GROUP_CHANNEL_CREATED: 'room.group.created',
  USER_REMOVED: 'room.user.removed',
  RATE_LIMIT_TRIGGERED: 'rate.limit.triggered',
  RECONNECT: 'realtime.reconnect',
  ACK_TIMEOUT: 'realtime.ack.timeout',
  PRESENCE_CHANGED: 'presence.changed',
});

module.exports = {
  AUDIT_ACTIONS,
};
