'use strict';

const express = require('express');

/**
 * @param {Object} deps
 * @param {import('../incidents/incidentAggregator').IncidentAggregator} deps.incidentAggregator
 * @returns {import('express').Router}
 */
function createIncidentsRouter({ incidentAggregator }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const status = String(req.query.status || 'all').toLowerCase();
    let incidents;
    if (status === 'active') {
      incidents = incidentAggregator.getActive();
    } else if (status === 'all') {
      incidents = incidentAggregator.getAll();
    } else {
      return res.status(400).json({ error: 'invalid_status' });
    }
    return res.json({ incidents });
  });

  return router;
}

module.exports = { createIncidentsRouter };
