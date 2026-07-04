'use strict';

const logger = require('../utils/logger');
const roomService = require('../services/roomService');
const powerService = require('../services/powerService');
const { buildUsageSnapshot } = require('../services/usageService');

/**
 * SocketBroadcaster owns all outgoing realtime events. It:
 *   - subscribes to store / engine events
 *   - records energy samples on every device change (source of truth for energy)
 *   - runs a heartbeat so `usage:update` fires even when nothing changes
 *   - sends a full snapshot to every newly connected socket
 *
 * Emitted events (spec):
 *   devices:update   (Device[])
 *   rooms:update     (RoomSummary[])
 *   usage:update     (UsageSnapshot)
 *   alerts:update    (Alert[])
 *   incidents:update (Incident[])
 */
class SocketBroadcaster {
  /**
   * @param {Object} deps
   * @param {import('socket.io').Server} deps.io
   * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
   * @param {import('../store/energyStore').EnergyStore} deps.energyStore
   * @param {import('../alerts/alertStore').AlertStore} deps.alertStore
   * @param {import('../incidents/incidentAggregator').IncidentAggregator} deps.incidentAggregator
   * @param {import('../store/roomSampleBuffer').RoomSampleBuffer} deps.roomSampleBuffer
   * @param {import('../services/predictionEngine').PredictionEngine} deps.predictionEngine
   * @param {number} [deps.heartbeatMs=5000]
   */
  constructor({ io, deviceStore, energyStore, alertStore, incidentAggregator, roomSampleBuffer, predictionEngine, heartbeatMs }) {
    if (!io || !deviceStore || !energyStore || !alertStore || !incidentAggregator || !roomSampleBuffer || !predictionEngine) {
      throw new Error('SocketBroadcaster missing required deps');
    }
    this._io = io;
    this._deviceStore = deviceStore;
    this._energyStore = energyStore;
    this._alertStore = alertStore;
    this._incidents = incidentAggregator;
    this._roomSampleBuffer = roomSampleBuffer;
    this._predictionEngine = predictionEngine;
    this._heartbeatMs = heartbeatMs ?? 5000;
    /** @type {NodeJS.Timeout|null} */
    this._heartbeat = null;
  }

  /** Wire subscriptions and start the heartbeat. */
  start() {
    // Record initial power sample so integration has a baseline.
    this._recordEnergySample();

    this._deviceStore.on('devices:changed', () => {
      this._recordEnergySample();
      this._emitDeviceScopedUpdates();
    });
    this._deviceStore.on('device:changed', () => {
      this._recordEnergySample();
      this._emitDeviceScopedUpdates();
    });
    this._alertStore.on('alerts:changed', (alerts) => {
      this._io.emit('alerts:update', alerts);
    });
    this._incidents.on('incidents:changed', (incidents) => {
      this._io.emit('incidents:update', incidents);
    });

    this._heartbeat = setInterval(() => {
      this._recordEnergySample();
      this._emitUsage();
    }, this._heartbeatMs);
    if (typeof this._heartbeat.unref === 'function') {
      this._heartbeat.unref();
    }

    this._io.on('connection', (socket) => {
      logger.info('Socket connected', { id: socket.id });
      // Send full initial snapshot so late joiners don't wait for events.
      socket.emit('devices:update', this._deviceStore.getAll());
      socket.emit('rooms:update', this._getRoomsWithPredictions());
      socket.emit('usage:update', buildUsageSnapshot(this._deviceStore, this._energyStore));
      socket.emit('alerts:update', this._alertStore.getAll());
      socket.emit('incidents:update', this._incidents.getAll());
      socket.on('disconnect', (reason) =>
        logger.info('Socket disconnected', { id: socket.id, reason })
      );
    });

    logger.info('SocketBroadcaster started', { heartbeatMs: this._heartbeatMs });
  }

  stop() {
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
    }
    this._heartbeat = null;
  }

  /** @private */
  _recordEnergySample() {
    const devices = this._deviceStore.getAll();
    const totalW = powerService.totalPower(devices);
    this._energyStore.record(totalW);

    const perRoomWatts = powerService.powerByRoom(devices);
    const roomSnapshots = Object.entries(perRoomWatts).map(([id, powerWatts]) => ({ id, powerWatts }));
    this._roomSampleBuffer.record(roomSnapshots);
  }

  /** @private */
  _emitDeviceScopedUpdates() {
    this._io.emit('devices:update', this._deviceStore.getAll());
    this._io.emit('rooms:update', this._getRoomsWithPredictions());
    this._emitUsage();
  }

  /** @private */
  _getRoomsWithPredictions() {
    const rooms = roomService.summarizeRooms(this._deviceStore, this._roomSampleBuffer);
    return rooms.map(room => ({
      ...room,
      predictions: this._predictionEngine.getRoomPredictions(room)
    }));
  }

  /** @private */
  _emitUsage() {
    this._io.emit('usage:update', buildUsageSnapshot(this._deviceStore, this._energyStore));
  }
}

module.exports = { SocketBroadcaster };
