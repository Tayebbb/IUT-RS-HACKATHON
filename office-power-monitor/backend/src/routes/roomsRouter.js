'use strict';

const express = require('express');
const roomService = require('../services/roomService');
const { success, error } = require('../utils/apiResponse');

/**
 * @param {Object} deps
 * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
 * @returns {import('express').Router}
 */
function createRoomsRouter({ deviceStore }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    success(res, roomService.summarizeRooms(deviceStore));
  });

  router.get('/:id', (req, res) => {
    const room = roomService.getRoomSummary(deviceStore, req.params.id);
    if (!room) {
      return error(res, 'room_not_found', 404);
    }
    return success(res, room);
  });

  return router;
}

module.exports = { createRoomsRouter };
