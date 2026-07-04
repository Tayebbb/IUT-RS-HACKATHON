'use strict';

const express = require('express');
const roomService = require('../services/roomService');
const { success, error } = require('../utils/apiResponse');

/**
 * @param {Object} deps
 * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
 * @param {import('../services/predictionEngine').PredictionEngine} deps.predictionEngine
 * @returns {import('express').Router}
 */
function createRoomsRouter({ deviceStore, predictionEngine }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    const rooms = roomService.summarizeRooms(deviceStore).map((room) => ({
      ...room,
      predictions: predictionEngine ? predictionEngine.getRoomPredictions(room) : null
    }));
    success(res, rooms);
  });

  router.get('/:id', (req, res) => {
    let room = roomService.getRoomSummary(deviceStore, req.params.id);
    if (!room) {
      return error(res, 'room_not_found', 404);
    }
    if (predictionEngine) {
      room = { ...room, predictions: predictionEngine.getRoomPredictions(room) };
    }
    return success(res, room);
  });

  return router;
}

module.exports = { createRoomsRouter };
