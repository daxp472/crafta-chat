'use strict';

const { ApiError } = require('../utils/api-error');

function requiredCollection(name, value) {
  if (!value) {
    throw new Error(`createMongoPersistenceAdapter: missing collection ${name}`);
  }
  return value;
}

function createMongoPersistenceAdapter(input) {
  const options = input || {};
  const rooms = requiredCollection('rooms', options.rooms);
  const messages = requiredCollection('messages', options.messages);

  async function createRoom(roomId, members, roomOptions) {
    const now = Date.now();
    const payload = {
      roomId,
      type: roomOptions && roomOptions.type ? roomOptions.type : 'channel',
      name: roomOptions && roomOptions.name ? roomOptions.name : null,
      metadata: roomOptions && roomOptions.metadata ? roomOptions.metadata : {},
      members: Array.isArray(members) ? Array.from(new Set(members)) : [],
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await rooms.updateOne(
      { roomId },
      {
        $setOnInsert: payload,
        $set: {
          deleted: false,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    const room = await rooms.findOne({ roomId });
    return {
      roomId: room.roomId,
      members: room.members || [],
      type: room.type || 'channel',
      name: room.name || null,
      metadata: room.metadata || {},
    };
  }

  async function softDeleteRoom(roomId) {
    await rooms.updateOne({ roomId }, { $set: { deleted: true, updatedAt: Date.now() } });
    return true;
  }

  async function removeMember(roomId, userId) {
    await rooms.updateOne({ roomId }, { $pull: { members: userId }, $set: { updatedAt: Date.now() } });
    return true;
  }

  async function validateRoomAccess(roomId, userId) {
    const room = await rooms.findOne({ roomId });
    if (!room) {
      throw new ApiError('Room not found', 404, 'ROOM_NOT_FOUND');
    }
    if (room.deleted) {
      throw new ApiError('Room is deleted', 410, 'ROOM_DELETED');
    }
    if (Array.isArray(room.members) && room.members.length > 0 && !room.members.includes(userId)) {
      throw new ApiError('User not part of room', 403, 'NOT_ROOM_MEMBER');
    }
    return room;
  }

  async function addMessage(payload) {
    await validateRoomAccess(payload.roomId, payload.userId);

    const doc = {
      ...payload,
      reactions: {},
      seenBy: {},
      replyTo: payload.replyTo || null,
      deleted: false,
      editedAt: null,
    };

    await messages.insertOne(doc);
    return doc;
  }

  async function editMessage(roomId, messageId, text) {
    const updatedAt = Date.now();
    const result = await messages.updateOne(
      { roomId, id: messageId, deleted: { $ne: true } },
      { $set: { text, editedAt: updatedAt } }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    return messages.findOne({ roomId, id: messageId });
  }

  async function deleteMessage(roomId, messageId) {
    const result = await messages.updateOne({ roomId, id: messageId, deleted: { $ne: true } }, { $set: { deleted: true } });
    if (result.matchedCount === 0) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }
    return true;
  }

  async function listMessages(params) {
    const filter = {
      roomId: params.roomId,
      deleted: { $ne: true },
    };

    const all = await messages.find(filter).sort({ createdAt: 1, id: 1 }).toArray();

    if (all.length === 0) {
      return { items: [], nextCursor: null, prevCursor: null, total: 0 };
    }

    const limit = Math.max(1, params.limit || 20);
    let startIndex = 0;

    if (params.cursor) {
      const foundIndex = all.findIndex((message) => message.id === params.cursor);
      if (foundIndex === -1) {
        throw new ApiError('Cursor is invalid or stale', 400, 'CURSOR_INVALID');
      }
      startIndex = params.direction === 'backward' ? Math.max(0, foundIndex - limit) : foundIndex + 1;
    }

    const items = all.slice(startIndex, startIndex + limit);
    const first = items[0];
    const last = items[items.length - 1];

    return {
      items,
      nextCursor: last && all[all.length - 1].id !== last.id ? last.id : null,
      prevCursor: first && all[0].id !== first.id ? first.id : null,
      total: all.length,
    };
  }

  async function unreadCount(roomId, userId) {
    const count = await messages.countDocuments({
      roomId,
      deleted: { $ne: true },
      userId: { $ne: userId },
    });
    return count;
  }

  async function addReaction(roomId, messageId, userId, reaction) {
    const path = `reactions.${reaction}`;
    const result = await messages.updateOne(
      { roomId, id: messageId, deleted: { $ne: true } },
      {
        $addToSet: {
          [path]: userId,
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    return messages.findOne({ roomId, id: messageId });
  }

  async function removeReaction(roomId, messageId, userId, reaction) {
    const path = `reactions.${reaction}`;
    const result = await messages.updateOne(
      { roomId, id: messageId, deleted: { $ne: true } },
      {
        $pull: {
          [path]: userId,
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    return messages.findOne({ roomId, id: messageId });
  }

  async function markSeen(roomId, messageId, userId, seenAt) {
    const path = `seenBy.${userId}`;
    const result = await messages.updateOne(
      { roomId, id: messageId, deleted: { $ne: true } },
      {
        $set: {
          [path]: seenAt || Date.now(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    return messages.findOne({ roomId, id: messageId });
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
  createMongoPersistenceAdapter,
};
