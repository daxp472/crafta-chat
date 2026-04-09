'use strict';

const { createId } = require('../utils/id');
const { ApiError } = require('../utils/api-error');
const { AUDIT_ACTIONS } = require('../utils/constants');
const { validateMessagePayload } = require('../middlewares/message-validation');

function createChatService(deps) {
  const {
    config,
    logger,
    store,
    rateLimiter,
    audit,
    realtime,
  } = deps;

  function ensureFeatureEnabled(name) {
    if (!config.features[name]) {
      return false;
    }
    return true;
  }

  function applyRateLimit(roomId, userId) {
    if (!ensureFeatureEnabled('rateLimit')) {
      return;
    }

    const result = rateLimiter.hit({ roomId, userId });
    if (!result.allowed) {
      audit.log(AUDIT_ACTIONS.RATE_LIMIT_TRIGGERED, { roomId, userId, retryAfterMs: result.retryAfterMs });
      throw new ApiError('Rate limit exceeded', 429, 'RATE_LIMIT');
    }
  }

  async function sendMessage(payload) {
    const validated = validateMessagePayload(payload, {
      maxMessageLength: config.limits.maxMessageLength,
    });

    applyRateLimit(validated.roomId, validated.userId);

    const message = {
      id: payload.id || createId('msg'),
      roomId: validated.roomId,
      userId: validated.userId,
      text: validated.text,
      metadata: validated.metadata,
      replyTo: payload.replyTo || null,
      reactions: {},
      seenBy: {},
      createdAt: Date.now(),
    };

    const saved = await store.addMessage(message);
    const dedupeResult = realtime.enqueue(saved, payload.dedupeKey);

    if (!dedupeResult.accepted) {
      logger.warn('Duplicate message prevented by dedupe', { messageId: saved.id, roomId: saved.roomId });
    }

    audit.log(AUDIT_ACTIONS.MESSAGE_SENT, {
      roomId: saved.roomId,
      userId: saved.userId,
      messageId: saved.id,
      metadata: saved.metadata,
    });

    if (saved.replyTo) {
      audit.log(AUDIT_ACTIONS.MESSAGE_REPLIED, {
        roomId: saved.roomId,
        userId: saved.userId,
        messageId: saved.id,
        replyTo: saved.replyTo,
      });
    }

    return saved;
  }

  async function readMessages(params) {
    const roomId = params && params.roomId ? String(params.roomId) : '';
    if (!roomId) {
      throw new ApiError('roomId is required', 400, 'INVALID_PAYLOAD');
    }

    return store.listMessages({
      roomId,
      limit: params.limit || config.limits.pageSize,
      cursor: params.cursor || null,
      direction: params.direction || 'forward',
    });
  }

  async function editMessage(params) {
    if (!params || !params.roomId || !params.messageId) {
      throw new ApiError('roomId and messageId are required', 400, 'INVALID_PAYLOAD');
    }

    const text = String(params.text || '').trim();
    if (!text) {
      throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE');
    }
    if (text.length > config.limits.maxMessageLength) {
      throw new ApiError('Message exceeds max length', 413, 'MESSAGE_TOO_LARGE');
    }

    const updated = await store.editMessage(String(params.roomId), String(params.messageId), text);
    audit.log(AUDIT_ACTIONS.MESSAGE_EDITED, {
      roomId: updated.roomId,
      messageId: updated.id,
    });
    realtime.enqueue(updated, `edit:${updated.id}:${updated.editedAt}`);
    return updated;
  }

  async function deleteMessage(params) {
    if (!params || !params.roomId || !params.messageId) {
      throw new ApiError('roomId and messageId are required', 400, 'INVALID_PAYLOAD');
    }
    await store.deleteMessage(String(params.roomId), String(params.messageId));
    audit.log(AUDIT_ACTIONS.MESSAGE_DELETED, {
      roomId: String(params.roomId),
      messageId: String(params.messageId),
    });
    return true;
  }

  async function createRoom(roomId, members, options) {
    if (!roomId) {
      throw new ApiError('roomId is required', 400, 'INVALID_PAYLOAD');
    }
    const created = await store.createRoom(String(roomId), members, options);
    audit.log(AUDIT_ACTIONS.ROOM_CREATED, { roomId: created.roomId, members: created.members.length });
    return created;
  }

  async function createDirectChannel(params) {
    if (!params || !params.userA || !params.userB) {
      throw new ApiError('userA and userB are required', 400, 'INVALID_PAYLOAD');
    }

    const roomId = params.roomId || `dm:${String(params.userA)}:${String(params.userB)}`;
    const room = await createRoom(roomId, [String(params.userA), String(params.userB)], {
      type: 'direct',
      name: params.name || null,
      metadata: params.metadata || {},
    });

    audit.log(AUDIT_ACTIONS.DIRECT_CHANNEL_CREATED, {
      roomId: room.roomId,
      userA: String(params.userA),
      userB: String(params.userB),
    });

    return room;
  }

  async function createGroupChannel(params) {
    if (!params || !params.roomId) {
      throw new ApiError('roomId is required', 400, 'INVALID_PAYLOAD');
    }

    const room = await createRoom(String(params.roomId), params.members || [], {
      type: 'group',
      name: params.name || null,
      metadata: params.metadata || {},
    });

    audit.log(AUDIT_ACTIONS.GROUP_CHANNEL_CREATED, {
      roomId: room.roomId,
      members: room.members.length,
    });

    return room;
  }

  async function removeUserFromRoom(roomId, userId) {
    await store.removeMember(String(roomId), String(userId));
    audit.log(AUDIT_ACTIONS.USER_REMOVED, { roomId: String(roomId), userId: String(userId) });
    return true;
  }

  async function softDeleteRoom(roomId) {
    return store.softDeleteRoom(String(roomId));
  }

  async function unreadCount(roomId, userId) {
    return store.unreadCount(String(roomId), String(userId));
  }

  async function addReaction(params) {
    if (!params || !params.roomId || !params.messageId || !params.userId || !params.reaction) {
      throw new ApiError('roomId, messageId, userId, and reaction are required', 400, 'INVALID_PAYLOAD');
    }

    const updated = await store.addReaction(String(params.roomId), String(params.messageId), String(params.userId), String(params.reaction));
    audit.log(AUDIT_ACTIONS.MESSAGE_REACTION_ADDED, {
      roomId: updated.roomId,
      messageId: updated.id,
      userId: String(params.userId),
      reaction: String(params.reaction),
    });
    realtime.enqueue(updated, `react:add:${updated.id}:${params.userId}:${params.reaction}`);
    return updated;
  }

  async function removeReaction(params) {
    if (!params || !params.roomId || !params.messageId || !params.userId || !params.reaction) {
      throw new ApiError('roomId, messageId, userId, and reaction are required', 400, 'INVALID_PAYLOAD');
    }

    const updated = await store.removeReaction(String(params.roomId), String(params.messageId), String(params.userId), String(params.reaction));
    audit.log(AUDIT_ACTIONS.MESSAGE_REACTION_REMOVED, {
      roomId: updated.roomId,
      messageId: updated.id,
      userId: String(params.userId),
      reaction: String(params.reaction),
    });
    realtime.enqueue(updated, `react:remove:${updated.id}:${params.userId}:${params.reaction}`);
    return updated;
  }

  async function markSeen(params) {
    if (!params || !params.roomId || !params.messageId || !params.userId) {
      throw new ApiError('roomId, messageId, and userId are required', 400, 'INVALID_PAYLOAD');
    }

    const updated = await store.markSeen(
      String(params.roomId),
      String(params.messageId),
      String(params.userId),
      params.seenAt || Date.now()
    );

    audit.log(AUDIT_ACTIONS.MESSAGE_SEEN, {
      roomId: updated.roomId,
      messageId: updated.id,
      userId: String(params.userId),
    });

    realtime.enqueue(updated, `seen:${updated.id}:${params.userId}`);
    return updated;
  }

  function setUserOnline(params) {
    if (!params || !params.userId) {
      throw new ApiError('userId is required', 400, 'INVALID_PAYLOAD');
    }
    const status = realtime.setUserStatus(String(params.userId), 'online', {
      roomId: params.roomId || null,
      sessionId: params.sessionId || null,
      meta: params.meta || {},
    });
    audit.log(AUDIT_ACTIONS.PRESENCE_CHANGED, status);
    return status;
  }

  function setUserOffline(params) {
    if (!params || !params.userId) {
      throw new ApiError('userId is required', 400, 'INVALID_PAYLOAD');
    }
    const status = realtime.setUserStatus(String(params.userId), 'offline', {
      roomId: params.roomId || null,
      sessionId: params.sessionId || null,
      meta: params.meta || {},
    });
    audit.log(AUDIT_ACTIONS.PRESENCE_CHANGED, status);
    return status;
  }

  function getUserStatus(userId) {
    return realtime.getUserStatus(String(userId));
  }

  function joinChannel(channelId, userContext) {
    return realtime.joinChannel(String(channelId), userContext || {});
  }

  function leaveChannel(channelId, userContext) {
    return realtime.leaveChannel(String(channelId), userContext || {});
  }

  return {
    sendMessage,
    readMessages,
    editMessage,
    deleteMessage,
    createRoom,
    createDirectChannel,
    createGroupChannel,
    removeUserFromRoom,
    softDeleteRoom,
    unreadCount,
    addReaction,
    removeReaction,
    markSeen,
    setUserOnline,
    setUserOffline,
    getUserStatus,
    joinChannel,
    leaveChannel,
    acknowledge: realtime.acknowledge,
    reconnect: realtime.reconnect,
  };
}

module.exports = {
  createChatService,
};
