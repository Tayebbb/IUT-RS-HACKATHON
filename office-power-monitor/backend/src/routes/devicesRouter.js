'use strict';

const express = require('express');

/**
 * @param {Object} deps
 * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
 * @returns {import('express').Router}
 */
function createDevicesRouter({ deviceStore }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.json({ devices: deviceStore.getAll() });
  });

  router.get('/:id', (req, res) => {
    const device = deviceStore.getById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'device_not_found' });
    }
    return res.json({ device });
  });

  return router;
}

module.exports = { createDevicesRouter };
