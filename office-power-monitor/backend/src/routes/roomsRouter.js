'use strict';

const express = require('express');
const roomService = require('../services/roomService');

/**
 * @param {Object} deps
 * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
 * @returns {import('express').Router}
 */
function createRoomsRouter({ deviceStore }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.json({ rooms: roomService.summarizeRooms(deviceStore) });
  });

  router.get('/:id', (req, res) => {
    const room = roomService.getRoomSummary(deviceStore, req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'room_not_found' });
    }
    return res.json({ room });
  });

  return router;
}

module.exports = { createRoomsRouter };
