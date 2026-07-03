'use strict';

const express = require('express');
const { success } = require('../utils/apiResponse');

/**
 * @swagger
 * tags:
 *   name: Usage
 *   description: Real-time power usage snapshots
 */

/**
 * @param {Object} deps
 * @param {import('../services/usageService').UsageService} deps.usageService
 * @returns {import('express').Router}
 */
function createUsageRouter({ usageService }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/usage:
   *   get:
   *     summary: Retrieve a live usage snapshot
   *     tags: [Usage]
   *     responses:
   *       200:
   *         description: A usage snapshot object including power calculations and energy estimates.
   */
  router.get('/', (req, res, next) => {
    try {
      const snapshot = usageService.getSnapshot();
      success(res, snapshot);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createUsageRouter };
