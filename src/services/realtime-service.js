'use strict';

const EventEmitter = require('events');
const { AUDIT_ACTIONS } = require('../utils/constants');

function createRealtimeService(config, auditService) {
  const emitter = new EventEmitter();
  const dedupe = new Set();
  const pendingAcks = new Map();
  const presence = new Map();

  function emitEvent(event, payload) {
    emitter.emit(event, payload);
    if (config.transportAdapter && typeof config.transportAdapter.emit === 'function') {
      config.transportAdapter.emit(event, payload);
    }
  }

  function enqueue(message, dedupeKey) {
    if (!config.enabled) {
      return { accepted: true, realtime: false };
    }

    const key = dedupeKey || `${message.roomId}:${message.userId}:${message.id}`;
    if (dedupe.has(key)) {
      return { accepted: false, reason: 'duplicate' };
    }

    dedupe.add(key);
    emitEvent('message', message);

    if (config.ackTimeoutMs > 0) {
      const timeout = setTimeout(() => {
        pendingAcks.delete(message.id);
        auditService.log(AUDIT_ACTIONS.ACK_TIMEOUT, { messageId: message.id, roomId: message.roomId });
        emitEvent('ack-timeout', { messageId: message.id, roomId: message.roomId });
      }, config.ackTimeoutMs);

      pendingAcks.set(message.id, timeout);
    }

    return { accepted: true };
  }

  function acknowledge(messageId) {
    if (!config.enabled) {
      return false;
    }

    if (!pendingAcks.has(messageId)) {
      return false;
    }

    clearTimeout(pendingAcks.get(messageId));
    pendingAcks.delete(messageId);
    emitEvent('ack', { messageId });
    return true;
  }

  function reconnect(sessionId, missedMessages) {
    auditService.log(AUDIT_ACTIONS.RECONNECT, { sessionId, replay: (missedMessages || []).length });

    const ordered = (missedMessages || []).slice().sort((a, b) => {
      if (a.createdAt === b.createdAt) {
        return a.id.localeCompare(b.id);
      }
      return a.createdAt - b.createdAt;
    });

    ordered.forEach((message) => emitEvent('message', message));
    return ordered;
  }

  function joinChannel(channelId, userContext) {
    if (!config.enabled) {
      return { joined: false, reason: 'realtime_disabled' };
    }

    if (config.transportAdapter && typeof config.transportAdapter.joinChannel === 'function') {
      config.transportAdapter.joinChannel(channelId, userContext || {});
    }

    emitEvent('channel-join', {
      channelId,
      userId: userContext && userContext.userId ? userContext.userId : null,
    });

    return { joined: true };
  }

  function leaveChannel(channelId, userContext) {
    if (!config.enabled) {
      return { left: false, reason: 'realtime_disabled' };
    }

    if (config.transportAdapter && typeof config.transportAdapter.leaveChannel === 'function') {
      config.transportAdapter.leaveChannel(channelId, userContext || {});
    }

    emitEvent('channel-leave', {
      channelId,
      userId: userContext && userContext.userId ? userContext.userId : null,
    });

    return { left: true };
  }

  function setUserStatus(userId, status, context) {
    const safeStatus = status === 'online' ? 'online' : 'offline';
    presence.set(String(userId), {
      status: safeStatus,
      lastSeenAt: Date.now(),
      context: context || {},
    });

    const payload = {
      userId: String(userId),
      status: safeStatus,
      lastSeenAt: presence.get(String(userId)).lastSeenAt,
      context: context || {},
    };

    emitEvent('presence', payload);
    return payload;
  }

  function getUserStatus(userId) {
    const value = presence.get(String(userId));
    if (!value) {
      return { userId: String(userId), status: 'offline', lastSeenAt: null, context: {} };
    }
    return {
      userId: String(userId),
      status: value.status,
      lastSeenAt: value.lastSeenAt,
      context: value.context,
    };
  }

  function on(event, handler) {
    emitter.on(event, handler);
    return () => emitter.off(event, handler);
  }

  function close() {
    pendingAcks.forEach((timeout) => clearTimeout(timeout));
    pendingAcks.clear();
    dedupe.clear();
    presence.clear();
    emitter.removeAllListeners();
  }

  return {
    enqueue,
    acknowledge,
    reconnect,
    joinChannel,
    leaveChannel,
    setUserStatus,
    getUserStatus,
    on,
    close,
  };
}

module.exports = {
  createRealtimeService,
};
