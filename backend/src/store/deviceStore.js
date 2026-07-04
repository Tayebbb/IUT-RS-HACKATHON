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
 * DeviceStore — single, in-memory source of truth for all 15 office devices.
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
 * - `'device:changed'`   (change: DeviceChange)  — one device flipped status.
 * - `'devices:changed'`  (devices: Device[])     — after any batch mutation.
 *
 * ## Public API (spec-required names)
 * - {@link DeviceStore#getAllDevices}
 * - {@link DeviceStore#getDeviceById}
 * - {@link DeviceStore#getDevicesByRoom}
 * - {@link DeviceStore#updateDevice}
 * - {@link DeviceStore#updateMultipleDevices}
 * - {@link DeviceStore#resetStore}
 *
 * ## Internal aliases (kept for backward-compat with existing consumers)
 * - `getAll()`          → getAllDevices()
 * - `getById(id)`       → getDeviceById(id)
 * - `getByRoom(roomId)` → getDevicesByRoom(roomId)
 * - `setStatus(id, s)`  → updateDevice(id, s)
 * - `applyBatch(upd)`   → updateMultipleDevices(upd)
 *
 * The store owns no side effects beyond state + events.  Callers
 * (Simulator, AlertEngine, SocketBroadcaster, REST routes, Discord bot)
 * all subscribe to react to changes rather than polling.
 */
class DeviceStore extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, Device>} */
    this._byId = new Map();
    this._initialize();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Seed (or re-seed) the store with the static device catalog.
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

  // ─── Spec-required public API ─────────────────────────────────────────────

  /**
   * Return a defensive copy of every device in the store.
   *
   * Consumers receive a plain array snapshot; mutations to it never affect
   * the stored state.
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
   * Return all devices that belong to a given room.
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
   * This is a no-op when:
   *  - The device id is not found.
   *  - The requested status equals the current status.
   *
   * On a successful transition the device's `power` and `lastChanged` fields
   * are updated and a `'device:changed'` event is emitted.
   *
   * @param {string}       id          Device id.
   * @param {DeviceStatus} nextStatus  Target status ("on" | "off").
   * @param {number}       [nowMs]     Override for the current timestamp
   *                                   (useful in tests). Defaults to Date.now().
   * @returns {DeviceChange|null}      null when no change occurred.
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
   * All individual transitions are committed before any event is emitted,
   * so listeners always receive a consistent snapshot.  A single
   * `'devices:changed'` event fires after the batch (even if only one
   * device actually changed).
   *
   * Devices whose id is unknown or whose status is already correct are
   * silently skipped.
   *
   * @param {Array<{id:string, status:DeviceStatus}>} updates
   * @param {number} [nowMs]  Timestamp override. Defaults to Date.now().
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
   * Reset every device back to its initial "off" state.
   *
   * This is equivalent to reconstructing the singleton from scratch.
   * Existing EventEmitter listeners are preserved — they will receive a
   * `'devices:changed'` event carrying the fresh snapshot.
   *
   * Typical use cases:
   *  - Test setup / teardown.
   *  - Administrative "kill all devices" command from the Discord bot.
   *  - Recovering from a corrupted simulation state.
   */
  resetStore() {
    this._byId.clear();
    this._initialize();
    this.emit('devices:changed', this.getAllDevices());
  }

  // ─── Additional helpers (not part of spec, used by existing consumers) ────

  /**
   * Return the list of office rooms (id + name).
   * @returns {ReadonlyArray<{id:string, name:string}>}
   */
  getRooms() {
    return ROOMS;
  }

  /**
   * Compute how many seconds have elapsed since the device last changed status.
   * Used by the Simulator to enforce the minimum dwell time.
   *
   * @param {string} id
   * @param {number} [nowMs]
   * @returns {number}  0 when the device is unknown.
   */
  getDwellSeconds(id, nowMs = Date.now()) {
    const device = this._byId.get(id);
    if (!device) {
      return 0;
    }
    return Math.max(0, Math.floor((nowMs - Date.parse(device.lastChanged)) / 1000));
  }

  // ─── Backward-compat aliases ──────────────────────────────────────────────
  // Existing consumers (routes, services, simulator, broadcaster) use these
  // shorter names. They delegate to the spec-required methods above so there
  // is exactly one implementation of each operation.

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
   * Alias for {@link DeviceStore#updateDevice}.
   * Kept for backward-compat with the Simulator and any internal callers.
   * @see DeviceStore#updateDevice
   */
  setStatus(id, nextStatus, nowMs = Date.now()) {
    return this.updateDevice(id, nextStatus, nowMs);
  }

  /**
   * Alias for {@link DeviceStore#updateMultipleDevices}.
   * Kept for backward-compat with the Simulator.
   * @see DeviceStore#updateMultipleDevices
   */
  applyBatch(updates, nowMs = Date.now()) {
    return this.updateMultipleDevices(updates, nowMs);
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

/**
 * Shared singleton instance.  Imported by:
 *  - Simulator            → drives state transitions
 *  - AlertEngine          → reads device state to evaluate rules
 *  - SocketBroadcaster    → pushes snapshots to connected clients
 *  - REST route handlers  → serves HTTP responses
 *  - Discord bot          → reads state for !status / !room commands
 */
const deviceStore = new DeviceStore();

module.exports = { DeviceStore, deviceStore };
