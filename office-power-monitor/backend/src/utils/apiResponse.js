'use strict';

/**
 * Standardize API success response structure.
 * @param {import('express').Response} res
 * @param {any} data
 * @param {number} [statusCode=200]
 */
function success(res, data, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    data
  });
}

/**
 * Standardize API error response structure.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode=500]
 * @param {string} [errorCode]
 */
function error(res, message, statusCode = 500, errorCode = undefined) {
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: errorCode || (statusCode === 500 ? 'internal_error' : 'bad_request')
    }
  });
}

module.exports = { success, error };
