'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * EcoModeEngine — monitors room occupancy predictions and automatically
 * shuts down devices in rooms that have been classified as 'unoccupied'
 * for a sustained period.
 *
 * When an auto-shutdown is triggered, the engine emits an 'eco:action'
 * event which the SocketBroadcaster forwards to all connected clients
 * as a notification toast.
 *
 * Configuration:
 *   - CHECK_INTERVAL_MS  How often to evaluate rooms (default: 30s)
 *   - ECO_THRESHOLD_MS   How long a room must be unoccupied before auto-shutdown (default: 5 min)
 */
class EcoModeEngine extends EventEmitter {
  /**
   * @param {Object} deps
   * @param {import('../services/predictionEngine').PredictionEngine} deps.predictionEngine
   * @param {import('../services/DeviceService').DeviceService} deps.deviceService
   * @param {import('../services/roomService').RoomService} deps.roomService
   * @param {number} [deps.checkIntervalMs]
   * @param {number} [deps.ecoThresholdMs]
   */
  constructor({ predictionEngine, deviceService, roomService, checkIntervalMs, ecoThresholdMs }) {
    super();
    if (!predictionEngine || !deviceService || !roomService) {
      throw new Error('EcoModeEngine missing required deps');
    }
    this._predictionEngine = predictionEngine;
    this._deviceService = deviceService;
    this._roomService = roomService;
    this._checkIntervalMs = checkIntervalMs ?? 30_000;
    this._ecoThresholdMs = ecoThresholdMs ?? 5 * 60 * 1000; // 5 minutes

    /** @type {Map<string, number>} roomId → timestamp when first classified as unoccupied */
    this._unoccupiedSince = new Map();
    /** @type {Set<string>} rooms already shut down in this unoccupied window */
    this._shutdownThisWindow = new Set();
    /** @type {NodeJS.Timeout|null} */
    this._timer = null;
  }

  /** Start the periodic check loop. */
  start() {
    if (this._timer) {
      return;
    }
    this._timer = setInterval(() => this._evaluate(), this._checkIntervalMs);
    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
    logger.info('EcoModeEngine started', {
      checkIntervalMs: this._checkIntervalMs,
      ecoThresholdMs: this._ecoThresholdMs
    });
  }

  /** Stop the engine. */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
    }
    this._timer = null;
    logger.info('EcoModeEngine stopped');
  }

  /** @private */
  _evaluate() {
    const rooms = this._roomService.getRooms();
    const nowMs = Date.now();

    for (const room of rooms) {
      const prediction = this._predictionEngine.getRoomPredictions(room);
      const isUnoccupied = prediction.predictedState === 'unoccupied';
      const hasActiveDevices = room.powerWatts > 0;

      if (isUnoccupied && hasActiveDevices) {
        if (!this._unoccupiedSince.has(room.id)) {
          this._unoccupiedSince.set(room.id, nowMs);
          logger.debug('EcoMode: room marked unoccupied', { roomId: room.id });
        }

        const sinceMs = nowMs - this._unoccupiedSince.get(room.id);
        const alreadyShutdown = this._shutdownThisWindow.has(room.id);

        if (sinceMs >= this._ecoThresholdMs && !alreadyShutdown) {
          const count = this._deviceService.shutdownRoom(room.id);
          this._shutdownThisWindow.add(room.id);

          if (count > 0) {
            const savings = Number(prediction.potentialSavingsBdt.toFixed(2));
            logger.info('EcoMode: auto-shutdown triggered', {
              roomId: room.id,
              devicesOff: count,
              savingsBdt: savings
            });

            this.emit('eco:action', {
              roomId: room.id,
              roomName: room.name,
              devicesShutdown: count,
              savingsBdt: savings,
              timestamp: new Date().toISOString()
            });
          }
        }
      } else {
        // Room is now occupied or empty — reset tracking state
        if (this._unoccupiedSince.has(room.id)) {
          this._unoccupiedSince.delete(room.id);
          this._shutdownThisWindow.delete(room.id);
        }
      }
    }
  }
}

module.exports = { EcoModeEngine };
