'use strict';

const express = require('express');
const { success, error } = require('../utils/apiResponse');

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room summaries and aggregates
 */

/**
 * @param {Object} deps
 * @param {import('../services/roomService').RoomService} deps.roomService
 * @returns {import('express').Router}
 */
function createRoomsRouter({ roomService }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/rooms:
   *   get:
   *     summary: Retrieve a summary of all rooms
   *     tags: [Rooms]
   *     responses:
   *       200:
   *         description: A list of room summaries.
   */
  router.get('/', (req, res, next) => {
    try {
      const rooms = roomService.summarizeRooms();
      success(res, rooms);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/rooms/{id}:
   *   get:
   *     summary: Retrieve a single room summary by ID
   *     tags: [Rooms]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: A single room summary.
   *       404:
   *         description: Room not found.
   */
  router.get('/:id', (req, res, next) => {
    try {
      const room = roomService.getRoomSummary(req.params.id);
      if (!room) {
        return error(res, 'Room not found', 404, 'room_not_found');
      }
      success(res, room);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createRoomsRouter };
