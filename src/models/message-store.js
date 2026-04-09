'use strict';

const { ApiError } = require('../utils/api-error');

function createMessageStore() {
  const rooms = new Map();

  function ensureRoom(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        messages: [],
        deleted: false,
        members: new Set(),
        type: 'channel',
        name: null,
        metadata: {},
      });
    }
    return rooms.get(roomId);
  }

  function createRoom(roomId, members, options) {
    const room = ensureRoom(roomId);
    room.deleted = false;
    room.type = options && options.type ? options.type : room.type;
    room.name = options && options.name !== undefined ? options.name : room.name;
    room.metadata = options && options.metadata ? { ...options.metadata } : room.metadata;
    if (Array.isArray(members)) {
      members.forEach((member) => room.members.add(member));
    }
    return {
      roomId,
      members: Array.from(room.members),
      type: room.type,
      name: room.name,
      metadata: room.metadata,
    };
  }

  function softDeleteRoom(roomId) {
    const room = ensureRoom(roomId);
    room.deleted = true;
    return true;
  }

  function removeMember(roomId, userId) {
    const room = ensureRoom(roomId);
    room.members.delete(userId);
    return true;
  }

  function addMessage(payload) {
    const room = ensureRoom(payload.roomId);
    if (room.deleted) {
      throw new ApiError('Room is deleted', 410, 'ROOM_DELETED');
    }

    if (room.members.size > 0 && !room.members.has(payload.userId)) {
      throw new ApiError('User not part of room', 403, 'NOT_ROOM_MEMBER');
    }

    room.messages.push({
      ...payload,
      replyTo: payload.replyTo || null,
      reactions: payload.reactions || {},
      seenBy: payload.seenBy || {},
      deleted: false,
      editedAt: null,
    });

    return payload;
  }

  function editMessage(roomId, messageId, text) {
    const room = ensureRoom(roomId);
    const message = room.messages.find((item) => item.id === messageId);
    if (!message || message.deleted) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    message.text = text;
    message.editedAt = Date.now();
    return message;
  }

  function deleteMessage(roomId, messageId) {
    const room = ensureRoom(roomId);
    const message = room.messages.find((item) => item.id === messageId);
    if (!message || message.deleted) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    message.deleted = true;
    return true;
  }

  function listMessages(params) {
    const room = ensureRoom(params.roomId);
    const visible = room.messages.filter((message) => !message.deleted);

    if (visible.length === 0) {
      return { items: [], nextCursor: null, prevCursor: null, total: 0 };
    }

    const limit = Math.max(1, params.limit || 20);
    let startIndex = 0;

    if (params.cursor) {
      const foundIndex = visible.findIndex((message) => message.id === params.cursor);
      if (foundIndex === -1) {
        throw new ApiError('Cursor is invalid or stale', 400, 'CURSOR_INVALID');
      }
      startIndex = params.direction === 'backward' ? Math.max(0, foundIndex - limit) : foundIndex + 1;
    }

    const items = visible.slice(startIndex, startIndex + limit);
    const first = items[0];
    const last = items[items.length - 1];

    const prevCursor = first && visible[0].id !== first.id ? first.id : null;
    const nextCursor = last && visible[visible.length - 1].id !== last.id ? last.id : null;

    return {
      items,
      nextCursor,
      prevCursor,
      total: visible.length,
    };
  }

  function unreadCount(roomId, userId) {
    const room = ensureRoom(roomId);
    return room.messages.filter((message) => !message.deleted && message.userId !== userId).length;
  }

  function addReaction(roomId, messageId, userId, reaction) {
    const room = ensureRoom(roomId);
    const message = room.messages.find((item) => item.id === messageId);
    if (!message || message.deleted) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    if (!message.reactions[reaction]) {
      message.reactions[reaction] = [];
    }
    if (!message.reactions[reaction].includes(userId)) {
      message.reactions[reaction].push(userId);
    }
    return message;
  }

  function removeReaction(roomId, messageId, userId, reaction) {
    const room = ensureRoom(roomId);
    const message = room.messages.find((item) => item.id === messageId);
    if (!message || message.deleted) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    if (!message.reactions[reaction]) {
      return message;
    }
    message.reactions[reaction] = message.reactions[reaction].filter((id) => id !== userId);
    return message;
  }

  function markSeen(roomId, messageId, userId, seenAt) {
    const room = ensureRoom(roomId);
    const message = room.messages.find((item) => item.id === messageId);
    if (!message || message.deleted) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    message.seenBy[userId] = seenAt || Date.now();
    return message;
  }

  return {
    createRoom,
    softDeleteRoom,
    removeMember,
    addMessage,
    editMessage,
    deleteMessage,
    listMessages,
    unreadCount,
    addReaction,
    removeReaction,
    markSeen,
  };
}

module.exports = {
  createMessageStore,
};
