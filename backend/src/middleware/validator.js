'use strict';

const { error } = require('../utils/apiResponse');

/**
 * Express middleware to validate query parameters against allowed values.
 * @param {string} queryParam The name of the query parameter to check.
 * @param {string[]} allowedValues Array of permitted values.
 * @param {string} [defaultValue] Value to inject if the parameter is absent.
 */
function validateQueryEnum(queryParam, allowedValues, defaultValue) {
  return (req, res, next) => {
    let val = req.query[queryParam];
    if (!val && defaultValue) {
      val = defaultValue;
      req.query[queryParam] = val;
    }
    
    if (val && !allowedValues.includes(String(val).toLowerCase())) {
      return error(
        res,
        `Invalid query parameter '${queryParam}'. Allowed values are: ${allowedValues.join(', ')}`,
        400,
        'invalid_query_param'
      );
    }
    next();
  };
}

module.exports = { validateQueryEnum };
