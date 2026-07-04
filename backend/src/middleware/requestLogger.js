'use strict';

const logger = require('../utils/logger');

/**
 * Express middleware to log incoming HTTP requests.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[HTTP] ${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip
    });
  });

  next();
}

module.exports = requestLogger;
