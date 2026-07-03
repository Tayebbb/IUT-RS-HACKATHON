'use strict';

const express = require('express');
const { success } = require('../utils/apiResponse');
const { validateQueryEnum } = require('../middleware/validator');

/**
 * @swagger
 * tags:
 *   name: Incidents
 *   description: System incidents (grouped alerts)
 */

/**
 * @param {Object} deps
 * @param {import('../services/IncidentService').IncidentService} deps.incidentService
 * @returns {import('express').Router}
 */
function createIncidentsRouter({ incidentService }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/incidents:
   *   get:
   *     summary: Retrieve incidents
   *     tags: [Incidents]
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [all, active]
   *         description: Filter incidents by status (defaults to active)
   *     responses:
   *       200:
   *         description: A list of incidents.
   */
  router.get('/', validateQueryEnum('status', ['all', 'active'], 'active'), (req, res, next) => {
    try {
      const status = req.query.status;
      const incidents = status === 'all' ? incidentService.getAll() : incidentService.getActive();
      success(res, incidents);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createIncidentsRouter };
