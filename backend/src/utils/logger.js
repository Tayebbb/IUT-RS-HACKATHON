'use strict';

/**
 * Tiny leveled logger. Keeps dependencies minimal.
 * @param {string} level
 * @param {string} msg
 * @param {Record<string,unknown>} [meta]
 */
function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  if (meta && Object.keys(meta).length > 0) {
    console.log(line, JSON.stringify(meta));
  } else {
    console.log(line);
  }
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta)
};
