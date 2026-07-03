'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { isOfficeHours, transitionProbability } = require('./officeHours');

/**
 * @typedef {import('../store/deviceStore').Device} Device
 * @typedef {import('../store/deviceStore').DeviceStore} DeviceStore
 */

/**
 * Simulator drives device state changes on a fixed tick.
 *
 * Rules (per spec):
 *   - Runs every SIMULATOR_TICK_MS (default 5s)
 *   - Fan = 60W, Light = 15W (owned by device catalog)
 *   - Every device has status, power, lastChanged (owned by DeviceStore)
 *   - Office hours 9AM-5PM: bias ON
 *   - Off hours: bias OFF
 *   - Minimum dwell time 60s before any device can flip again
 */
class Simulator {
  /**
   * @param {Object} deps
   * @param {DeviceStore} deps.deviceStore
   * @param {() => number} [deps.now]           Clock injection for tests.
   * @param {() => number} [deps.random]        RNG injection for tests.
   */
  constructor({ deviceStore, now, random }) {
    if (!deviceStore) {
      throw new Error('Simulator requires a deviceStore');
    }
    this._store = deviceStore;
    this._now = now || Date.now;
    this._random = random || Math.random;
    /** @type {NodeJS.Timeout|null} */
    this._timer = null;
    this._running = false;
  }

  /**
   * Start the periodic tick. Safe to call multiple times.
   */
  start() {
    if (this._running) {
      return;
    }
    this._running = true;
    logger.info('Simulator started', {
      tickMs: config.simulatorTickMs,
      minDwellSeconds: config.minDwellSeconds
    });
    this.tick();
    this._timer = setInterval(() => this.tick(), config.simulatorTickMs);
    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }

  /** Stop the periodic tick. Safe to call when already stopped. */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
    }
    this._timer = null;
    this._running = false;
    logger.info('Simulator stopped');
  }

  /**
   * Execute exactly one simulation tick. Public so it can be invoked in tests.
   * Applies all device transitions atomically via `applyBatch`.
   */
  tick() {
    const nowMs = this._now();
    const officeHours = isOfficeHours(nowMs);
    const devices = this._store.getAll();

    /** @type {Array<{id:string,status:'on'|'off'}>} */
    const updates = [];

    for (const device of devices) {
      const dwell = this._store.getDwellSeconds(device.id, nowMs);
      if (dwell < config.minDwellSeconds) {
        continue;
      }

      const p = transitionProbability(device.status, officeHours);
      if (this._random() < p) {
        updates.push({
          id: device.id,
          status: device.status === 'on' ? 'off' : 'on'
        });
      }
    }

    if (updates.length > 0) {
      const changes = this._store.applyBatch(updates, nowMs);
      logger.debug('Simulator tick applied', {
        officeHours,
        changed: changes.length
      });
    }
  }
}

module.exports = { Simulator };
