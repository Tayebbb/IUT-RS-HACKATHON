'use strict';

const { EventEmitter } = require('events');
const { buildDeviceCatalog, ROOMS } = require('../config/devices');

/**
 * @typedef {'fan'|'light'} DeviceType
 * @typedef {'on'|'off'} DeviceStatus
 *
 * @typedef {Object} Device
 * @property {string} id           Stable identifier, e.g. "drawing-room-fan-1".
 * @property {string} label        Human-readable label, e.g. "Fan 1".
 * @property {string} room         Room id the device belongs to.
 * @property {DeviceType} type     "fan" | "light".
 * @property {DeviceStatus} status "on" | "off".
 * @property {number} wattage      Nameplate wattage (Fan = 60W, Light = 15W).
 * @property {number} power        Instantaneous draw in watts (0 when off).
 * @property {string} lastChanged  ISO-8601 timestamp of last status transition.
 *
 * @typedef {Object} DeviceChange
 * @property {Device} device
 * @property {DeviceStatus} previousStatus
 * @property {DeviceStatus} nextStatus
 * @property {number} timestamp    Epoch ms when the transition happened.
 */

/**
 * DeviceStore - single, in-memory source of truth for all 15 office devices.
 *
 * ## Devices
 * Three rooms (Drawing Room, Work Room 1, Work Room 2), each containing:
 *   - Fan 1   (60 W)
 *   - Fan 2   (60 W)
 *   - Light 1 (15 W)
 *   - Light 2 (15 W)
 *   - Light 3 (15 W)
 *
 * Total: 15 devices, max combined draw = 495 W.
 *
 * ## Events emitted
 * - 'device:changed'   (change: DeviceChange)  - one device flipped status.
 * - 'devices:changed'  (devices: Device[])     - after any batch mutation.
 *
 * ## Spec-required public API
 * - getAllDevices()
 * - getDeviceById(id)
 * - getDevicesByRoom(roomId)
 * - updateDevice(id, status)
 * - updateMultipleDevices(updates)
 * - resetStore()
 *
 * ## Backward-compat aliases (keep existing consumers working)
 * - getAll()          -> getAllDevices()
 * - getById(id)       -> getDeviceById(id)
 * - getByRoom(roomId) -> getDevicesByRoom(roomId)
 * - setStatus(id, s)  -> updateDevice(id, s)
 * - applyBatch(upd)   -> updateMultipleDevices(upd)
 */
class DeviceStore extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, Device>} */
    this._byId = new Map();
    this._initialize();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Seed (or re-seed) the store from the static device catalog.
   * All devices start in the "off" state.
   * @private
   */
  _initialize() {
    const now = new Date().toISOString();
    for (const meta of buildDeviceCatalog()) {
      /** @type {Device} */
      const device = {
        id: meta.id,
        label: meta.label,
        type: meta.type,
        room: meta.room,
        status: 'off',
        wattage: meta.wattage,
        power: 0,
        lastChanged: now
      };
      this._byId.set(device.id, device);
    }
  }

  // -------------------------------------------------------------------------
  // Spec-required public API
  // -------------------------------------------------------------------------

  /**
   * Return a defensive copy of every device in the store.
   * Mutations to the returned array or its objects never affect stored state.
   *
   * @returns {Device[]}
   */
  getAllDevices() {
    return Array.from(this._byId.values()).map((d) => ({ ...d }));
  }

  /**
   * Look up a single device by its stable id.
   *
   * @param {string} id  e.g. "drawing-room-fan-1"
   * @returns {Device|undefined}  undefined when the id is unknown.
   */
  getDeviceById(id) {
    const d = this._byId.get(id);
    return d ? { ...d } : undefined;
  }

  /**
   * Return all devices belonging to a given room.
   *
   * @param {string} roomId  e.g. "work-room-1"
   * @returns {Device[]}     Empty array when the roomId is unknown.
   */
  getDevicesByRoom(roomId) {
    return this.getAllDevices().filter((d) => d.room === roomId);
  }

  /**
   * Flip a single device's status.
   *
   * No-op when the device id is unknown or the status is already correct.
   * On a real transition: updates `power` and `lastChanged`, then emits
   * 'device:changed'.
   *
   * @param {string}       id
   * @param {DeviceStatus} nextStatus
   * @param {number}       [nowMs]   Clock override for testing. Default: Date.now().
   * @returns {DeviceChange|null}   null when no transition occurred.
   */
  updateDevice(id, nextStatus, nowMs = Date.now()) {
    const device = this._byId.get(id);
    if (!device) {
      return null;
    }
    if (device.status === nextStatus) {
      return null;
    }

    const previousStatus = device.status;
    device.status = nextStatus;
    device.power = nextStatus === 'on' ? device.wattage : 0;
    device.lastChanged = new Date(nowMs).toISOString();

    /** @type {DeviceChange} */
    const change = {
      device: { ...device },
      previousStatus,
      nextStatus,
      timestamp: nowMs
    };
    this.emit('device:changed', change);
    return change;
  }

  /**
   * Apply a batch of status updates atomically.
   *
   * All transitions are committed before any event fires, so listeners always
   * receive a consistent snapshot. A single 'devices:changed' event fires
   * after the batch when at least one device actually changed.
   *
   * Unknown ids and no-op transitions are silently skipped.
   *
   * @param {Array<{id:string, status:DeviceStatus}>} updates
   * @param {number} [nowMs]  Clock override. Default: Date.now().
   * @returns {DeviceChange[]}  Only the transitions that actually occurred.
   */
  updateMultipleDevices(updates, nowMs = Date.now()) {
    /** @type {DeviceChange[]} */
    const changes = [];
    for (const u of updates) {
      const change = this.updateDevice(u.id, u.status, nowMs);
      if (change) {
        changes.push(change);
      }
    }
    if (changes.length > 0) {
      this.emit('devices:changed', this.getAllDevices());
    }
    return changes;
  }

  /**
   * Reset every device to the initial "off" state.
   *
   * Existing EventEmitter listeners are preserved; they receive a
   * 'devices:changed' event with the fresh all-off snapshot.
   *
   * Typical use cases:
   *   - Test setup / teardown.
   *   - Administrative "kill all devices" command (Discord bot).
   *   - Recovery from a corrupted simulation state.
   */
  resetStore() {
    this._byId.clear();
    this._initialize();
    this.emit('devices:changed', this.getAllDevices());
  }

  // -------------------------------------------------------------------------
  // Additional helpers used by existing consumers
  // -------------------------------------------------------------------------

  /**
   * Return the list of office rooms (id + name).
   * @returns {ReadonlyArray<{id:string, name:string}>}
   */
  getRooms() {
    return ROOMS;
  }

  /**
   * Seconds elapsed since the device last changed status.
   * Used by the Simulator to enforce the minimum dwell time.
   *
   * @param {string} id
   * @param {number} [nowMs]
   * @returns {number}  0 when the device id is unknown.
   */
  getDwellSeconds(id, nowMs = Date.now()) {
    const device = this._byId.get(id);
    if (!device) {
      return 0;
    }
    return Math.max(0, Math.floor((nowMs - Date.parse(device.lastChanged)) / 1000));
  }

  // -------------------------------------------------------------------------
  // Backward-compat aliases
  // Existing consumers (routes, services, simulator, broadcaster) use these
  // shorter names. Each delegates to the spec-required method above so there
  // is exactly one implementation per operation.
  // -------------------------------------------------------------------------

  /** @see DeviceStore#getAllDevices */
  getAll() {
    return this.getAllDevices();
  }

  /** @see DeviceStore#getDeviceById */
  getById(id) {
    return this.getDeviceById(id);
  }

  /** @see DeviceStore#getDevicesByRoom */
  getByRoom(roomId) {
    return this.getDevicesByRoom(roomId);
  }

  /**
   * Alias for updateDevice. Kept for Simulator backward-compat.
   * @see DeviceStore#updateDevice
   */
  setStatus(id, nextStatus, nowMs = Date.now()) {
    return this.updateDevice(id, nextStatus, nowMs);
  }

  /**
   * Alias for updateMultipleDevices. Kept for Simulator backward-compat.
   * @see DeviceStore#updateMultipleDevices
   */
  applyBatch(updates, nowMs = Date.now()) {
    return this.updateMultipleDevices(updates, nowMs);
  }
}

// -----------------------------------------------------------------------------
// Singleton
// Shared instance imported by: Simulator, AlertEngine, SocketBroadcaster,
// REST route handlers, and the Discord bot.
// -----------------------------------------------------------------------------
const deviceStore = new DeviceStore();

module.exports = { DeviceStore, deviceStore };
