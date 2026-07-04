'use strict';

const express = require('express');
const { evaluateSimulation } = require('../services/simulateService');
const { success, error } = require('../utils/apiResponse');

/**
 * @param {Object} deps
 * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
 * @param {import('../store/roomSampleBuffer').RoomSampleBuffer} deps.roomSampleBuffer
 * @returns {import('express').Router}
 */
function createSimulateRouter({ deviceStore, roomSampleBuffer }) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { simulatedDevices } = req.body;

    if (!simulatedDevices || !Array.isArray(simulatedDevices)) {
      return error(res, 'missing_or_invalid_devices_array', 400);
    }

    try {
      const result = evaluateSimulation(deviceStore, roomSampleBuffer, simulatedDevices);
      return success(res, result);
    } catch (err) {
      return error(res, 'simulation_failed', 500, { message: err.message });
    }
  });

  return router;
}

module.exports = { createSimulateRouter };
