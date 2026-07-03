'use strict';

const express = require('express');
const { success, error } = require('../utils/apiResponse');

/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: Device management and status
 */

/**
 * @param {Object} deps
 * @param {import('../services/DeviceService').DeviceService} deps.deviceService
 * @returns {import('express').Router}
 */
function createDevicesRouter({ deviceService }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/devices:
   *   get:
   *     summary: Retrieve a list of all devices
   *     tags: [Devices]
   *     responses:
   *       200:
   *         description: A list of devices.
   */
  router.get('/', (req, res, next) => {
    try {
      const devices = deviceService.getAll();
      success(res, devices);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/devices/{id}:
   *   get:
   *     summary: Retrieve a single device by its ID
   *     tags: [Devices]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: A single device object.
   *       404:
   *         description: Device not found.
   */
  router.get('/:id', (req, res, next) => {
    try {
      const device = deviceService.getById(req.params.id);
      if (!device) {
        return error(res, 'Device not found', 404, 'device_not_found');
      }
      success(res, device);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createDevicesRouter };
