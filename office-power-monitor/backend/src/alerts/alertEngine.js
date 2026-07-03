'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { isOfficeHours } = require('../simulator/officeHours');
const roomService = require('../services/roomService');

/**
 * @typedef {import('./alertStore').AlertStore} AlertStore
 * @typedef {import('./alertStore').Alert} Alert
 * @typedef {import('../store/deviceStore').DeviceStore} DeviceStore
 */

/**
 * Track when each room *became* fully ON, so we can detect
 * "entire room ON for > ROOM_ON_MAX_HOURS".
 *
 * The engine derives this purely from the device snapshot; it's the
 * only piece of local state the engine owns.
 */
class AlertEngine {
  /**
   * @param {Object} deps
   * @param {DeviceStore} deps.deviceStore
   * @param {AlertStore}  deps.alertStore
   * @param {() => number} [deps.now]
   * @param {number} [deps.evaluateEveryMs=10000]
   */
  constructor({ deviceStore, alertStore, now, evaluateEveryMs }) {
    if (!deviceStore || !alertStore) {
      throw new Error('AlertEngine requires deviceStore + alertStore');
    }
    this._devices = deviceStore;
    this._alerts = alertStore;
    this._now = now || Date.now;
    this._evaluateEveryMs = evaluateEveryMs ?? 10_000;
    /** @type {Map<string, number>} room id → epoch ms when room went all-on */
    this._roomAllOnSince = new Map();
    /** @type {NodeJS.Timeout|null} */
    this._timer = null;
    this._boundOnDevicesChanged = () => this.evaluate();
  }

  /** Start periodic evaluation + subscribe to device change events. */
  start() {
    if (this._timer) {
      return;
    }
    this._devices.on('devices:changed', this._boundOnDevicesChanged);
    this._devices.on('device:changed', this._boundOnDevicesChanged);
    this._timer = setInterval(() => this.evaluate(), this._evaluateEveryMs);
    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
    logger.info('AlertEngine started', {
      evaluateEveryMs: this._evaluateEveryMs
    });
    this.evaluate();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
    }
    this._timer = null;
    this._devices.off('devices:changed', this._boundOnDevicesChanged);
    this._devices.off('device:changed', this._boundOnDevicesChanged);
    logger.info('AlertEngine stopped');
  }

  /**
   * Evaluate all rules against the current snapshot. Alerts not present in
   * this pass are auto-resolved. Emits 'alerts:changed' if anything moved.
   */
  evaluate() {
    const nowMs = this._now();
    const office = isOfficeHours(nowMs);
    const rooms = roomService.summarizeRooms(this._devices);

    /** @type {Set<string>} signatures that should remain active this pass */
    const keep = new Set();
    let mutated = false;

    for (const room of rooms) {
      // Track how long the room has been fully on.
      if (room.allOn) {
        if (!this._roomAllOnSince.has(room.id)) {
          this._roomAllOnSince.set(room.id, nowMs);
        }
      } else {
        this._roomAllOnSince.delete(room.id);
      }

      // Rule 3: entire room ON for > ROOM_ON_MAX_HOURS.
      if (room.allOn) {
        const sinceMs = this._roomAllOnSince.get(room.id) || nowMs;
        const hoursOn = (nowMs - sinceMs) / 3_600_000;
        if (hoursOn > config.roomOnMaxHours) {
          const sig = `room-on-too-long:${room.id}`;
          keep.add(sig);
          const { opened } = this._alerts.upsert({
            signature: sig,
            kind: 'room_on_too_long',
            severity: 'high',
            room: room.id,
            device: null,
            message:
              `${room.name} has been fully ON for ${hoursOn.toFixed(1)}h ` +
              `(threshold ${config.roomOnMaxHours}h).`,
            nowMs
          });
          if (opened) {
            mutated = true;
          }
        }
      }

      if (!office) {
        // Rule 2: entire room ON after office hours.
        if (room.allOn) {
          const sig = `room-on-after-hours:${room.id}`;
          keep.add(sig);
          const { opened } = this._alerts.upsert({
            signature: sig,
            kind: 'room_on_after_hours',
            severity: 'high',
            room: room.id,
            device: null,
            message: `${room.name} is fully ON outside office hours (${room.powerWatts}W).`,
            nowMs
          });
          if (opened) {
            mutated = true;
          }
        }

        // Rule 1: any device ON after office hours.
        for (const d of room.devices) {
          if (d.status !== 'on') {
            continue;
          }
          const sig = `device-on-after-hours:${d.id}`;
          keep.add(sig);
          const { opened } = this._alerts.upsert({
            signature: sig,
            kind: 'device_on_after_hours',
            severity: 'medium',
            room: room.id,
            device: d.id,
            message: `${d.label} in ${room.name} is ON outside office hours.`,
            nowMs
          });
          if (opened) {
            mutated = true;
          }
        }
      }
    }

    const resolved = this._alerts.resolveMissing(keep, nowMs);
    if (mutated || resolved.length > 0) {
      this._alerts.emitChanged();
    }
  }
}

module.exports = { AlertEngine };
