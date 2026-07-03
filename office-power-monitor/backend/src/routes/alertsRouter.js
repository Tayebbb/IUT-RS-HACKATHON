'use strict';

const express = require('express');

/**
 * @param {Object} deps
 * @param {import('../alerts/alertStore').AlertStore} deps.alertStore
 * @returns {import('express').Router}
 */
function createAlertsRouter({ alertStore }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const status = String(req.query.status || 'all').toLowerCase();
    let alerts;
    if (status === 'active') {alerts = alertStore.getActive();}
    else if (status === 'all') {alerts = alertStore.getAll();}
    else {return res.status(400).json({ error: 'invalid_status' });}
    return res.json({ alerts });
  });

  return router;
}

module.exports = { createAlertsRouter };
