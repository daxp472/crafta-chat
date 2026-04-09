'use strict';

function createLogger(options) {
  const level = options && options.level ? options.level : 'info';
  const enabled = options && options.enabled !== undefined ? options.enabled : true;
  const sink = options && typeof options.sink === 'function' ? options.sink : console.log;

  const priority = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  function shouldLog(type) {
    return enabled && priority[type] >= priority[level];
  }

  function log(type, message, meta) {
    if (!shouldLog(type)) {
      return;
    }
    const timestamp = new Date().toISOString();
    const serializedMeta = meta ? ` ${JSON.stringify(meta)}` : '';
    sink(`[crafta-chat][${type.toUpperCase()}][${timestamp}] ${message}${serializedMeta}`);
  }

  return {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
  };
}

module.exports = {
  createLogger,
};
