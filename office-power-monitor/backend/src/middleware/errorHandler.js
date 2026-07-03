'use strict';

const logger = require('../utils/logger');
const { error } = require('../utils/apiResponse');

/**
 * Global Express error handling middleware.
 * Catches all unhandled synchronous/asynchronous errors from routes.
 */
function errorHandler(err, req, res, next) {
  logger.error(`[API Error] ${req.method} ${req.url}`, {
    message: err.message,
    stack: err.stack
  });

  if (res.headersSent) {
    return next(err);
  }

  // Prevent leaking internal stack traces in production responses
  error(res, 'An unexpected internal error occurred.', 500);
}

module.exports = errorHandler;
