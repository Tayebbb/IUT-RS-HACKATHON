'use strict';

const express = require('express');
const { success, error } = require('../utils/apiResponse');

/**
 * @param {Object} deps
 * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
 * @returns {import('express').Router}
 */
function createDevicesRouter({ deviceStore }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    success(res, deviceStore.getAll());
  });

  router.get('/:id', (req, res) => {
    const device = deviceStore.getById(req.params.id);
    if (!device) {
      return error(res, 'device_not_found', 404);
    }
    return success(res, device);
  });

  return router;
}

module.exports = { createDevicesRouter };
