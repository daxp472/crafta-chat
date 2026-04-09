'use strict';

const { deepMerge } = require('./utils/deep-merge');
const { createLogger } = require('./utils/logger');
const { ApiError } = require('./utils/api-error');
const { AUDIT_ACTIONS } = require('./utils/constants');
const { createMessageStore } = require('./models/message-store');
const { createRateLimiter } = require('./middlewares/rate-limit');
const { createAuditService } = require('./services/audit-service');
const { createRealtimeService } = require('./services/realtime-service');
const { createChatService } = require('./services/chat-service');
const { createMongoPersistenceAdapter } = require('./adapters/mongodb-adapter');

const PERSISTENCE_METHODS = [
  'createRoom',
  'softDeleteRoom',
  'removeMember',
  'addMessage',
  'editMessage',
  'deleteMessage',
  'listMessages',
  'unreadCount',
  'addReaction',
  'removeReaction',
  'markSeen',
];

const DEFAULT_CONFIG = Object.freeze({
  features: {
    emailVerification: false,
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
    maxMessageLength: 2000,
    pageSize: 20,
    rateLimit: {
      maxEvents: 20,
      windowMs: 10000,
    },
  },
  routes: {
    verifyEmail: '/verify',
    login: '/login',
  },
  policy: {
    redactKeys: ['password', 'token', 'secret', 'authorization', 'cookie'],
  },
  realtime: {
    enabled: true,
    ackTimeoutMs: 10000,
  },
  logger: {
    enabled: true,
    level: 'info',
  },
  optional: {
    persistenceAdapter: null,
    customLogger: null,
    realtimeAdapter: null,
  },
});

function mapLegacyFlags(input) {
  const config = { ...input };
  const features = { ...(input.features || {}) };

  if (input.emailVerification !== undefined) {
    features.emailVerification = Boolean(input.emailVerification);
  }
  if (input.loginAlerts !== undefined) {
    features.loginAlerts = Boolean(input.loginAlerts);
  }
  if (input.enableCSRF !== undefined) {
    features.csrf = Boolean(input.enableCSRF);
  }

  config.features = features;
  return config;
}

function normalizeConfig(inputConfig) {
  const userInput = inputConfig && typeof inputConfig === 'object' ? inputConfig : {};
  const mapped = mapLegacyFlags(userInput);
  const merged = deepMerge(DEFAULT_CONFIG, mapped);
  const warnings = [];

  const optionalPersistence = merged.optional && merged.optional.persistenceAdapter;
  const hasExternalPersistence = optionalPersistence
    && PERSISTENCE_METHODS.every((method) => typeof optionalPersistence[method] === 'function');

  if (!hasExternalPersistence && optionalPersistence) {
    warnings.push('optional.persistenceAdapter is invalid; falling back to internal store.');
  }

  if (!merged.features.auditLogs) {
    warnings.push('features.auditLogs is disabled; security traceability is reduced.');
  }

  if (merged.features.realtime && merged.realtime && merged.realtime.enabled === false) {
    warnings.push('features.realtime is true but realtime.enabled is false; realtime transport is disabled.');
  }

  return {
    config: {
      ...merged,
      features: {
        ...DEFAULT_CONFIG.features,
        ...(merged.features || {}),
      },
      limits: {
        ...DEFAULT_CONFIG.limits,
        ...(merged.limits || {}),
        rateLimit: {
          ...DEFAULT_CONFIG.limits.rateLimit,
          ...((merged.limits && merged.limits.rateLimit) || {}),
        },
      },
      policy: {
        ...DEFAULT_CONFIG.policy,
        ...(merged.policy || {}),
      },
      realtime: {
        ...DEFAULT_CONFIG.realtime,
        ...(merged.realtime || {}),
      },
      optional: {
        ...DEFAULT_CONFIG.optional,
        ...(merged.optional || {}),
      },
    },
    warnings,
  };
}

function createStore(finalConfig) {
  const adapter = finalConfig.optional.persistenceAdapter;
  const validAdapter = adapter
    && PERSISTENCE_METHODS.every((method) => typeof adapter[method] === 'function');

  if (validAdapter) {
    return adapter;
  }
  return createMessageStore();
}

function chat(inputConfig) {
  const normalized = normalizeConfig(inputConfig);
  const finalConfig = normalized.config;

  const loggerSink = finalConfig.optional.customLogger && typeof finalConfig.optional.customLogger.log === 'function'
    ? (line) => finalConfig.optional.customLogger.log(line)
    : undefined;

  const logger = createLogger({
    enabled: finalConfig.logger.enabled,
    level: finalConfig.logger.level,
    sink: loggerSink,
  });

  normalized.warnings.forEach((warning) => logger.warn(warning));

  const store = createStore(finalConfig);
  const rateLimiter = createRateLimiter({
    enabled: finalConfig.features.rateLimit,
    maxEvents: finalConfig.limits.rateLimit.maxEvents,
    windowMs: finalConfig.limits.rateLimit.windowMs,
  });

  const audit = createAuditService({
    enabled: finalConfig.features.auditLogs,
    redactKeys: finalConfig.policy.redactKeys,
  }, logger);

  const realtime = createRealtimeService({
    enabled: Boolean(finalConfig.features.realtime && finalConfig.realtime.enabled),
    ackTimeoutMs: finalConfig.realtime.ackTimeoutMs,
    transportAdapter: finalConfig.optional.realtimeAdapter,
  }, audit);

  const chatService = createChatService({
    config: finalConfig,
    logger,
    store,
    rateLimiter,
    audit,
    realtime,
  });

  return {
    ...chatService,
    on: realtime.on,
    close: realtime.close,
    getConfig: () => finalConfig,
    getWarnings: () => normalized.warnings.slice(),
    getAuditLogs: () => audit.all(),
  };
}

module.exports = {
  chat,
  normalizeConfig,
  DEFAULT_CONFIG,
  AUDIT_ACTIONS,
  ApiError,
  createMongoPersistenceAdapter,
};
