'use strict';

const { AUDIT_ACTIONS } = require('../utils/constants');
const { redactSensitive } = require('../utils/redaction');

function createAuditService(config, logger) {
  const records = [];

  function log(action, context) {
    if (!config.enabled) {
      return;
    }

    if (!Object.values(AUDIT_ACTIONS).includes(action)) {
      logger.warn('Skipped unknown audit action', { action });
      return;
    }

    const record = {
      action,
      timestamp: Date.now(),
      context: redactSensitive(context || {}, config.redactKeys),
    };

    records.push(record);
  }

  return {
    log,
    all: () => records.slice(),
  };
}

module.exports = {
  createAuditService,
};
