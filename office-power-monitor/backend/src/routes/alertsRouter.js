'use strict';

const express = require('express');
const { success } = require('../utils/apiResponse');
const { validateQueryEnum } = require('../middleware/validator');

/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: System alerts management
 */

/**
 * @param {Object} deps
 * @param {import('../services/AlertService').AlertService} deps.alertService
 * @returns {import('express').Router}
 */
function createAlertsRouter({ alertService }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/alerts:
   *   get:
   *     summary: Retrieve alerts
   *     tags: [Alerts]
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [all, active]
   *         description: Filter alerts by status (defaults to active)
   *     responses:
   *       200:
   *         description: A list of alerts.
   */
  router.get('/', validateQueryEnum('status', ['all', 'active'], 'active'), (req, res, next) => {
    try {
      const status = req.query.status;
      const alerts = status === 'all' ? alertService.getAll() : alertService.getActive();
      success(res, alerts);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAlertsRouter };
