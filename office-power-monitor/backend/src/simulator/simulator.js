'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { isOfficeHours, transitionProbability } = require('./officeHours');

/**
 * @typedef {import('../store/deviceStore').Device} Device
 * @typedef {import('../store/deviceStore').DeviceStore} DeviceStore
 * @typedef {import('../store/deviceStore').DeviceChange} DeviceChange
 */

/**
 * Simulator — drives realistic device state changes on a fixed tick interval.
 *
 * ## Behaviour
 *
 * Every tick (default 5 s) the simulator:
 *   1. Reads the current device snapshot from the DeviceStore.
 *   2. Skips any device that has not yet satisfied the minimum dwell time
 *      (default 60 s) since its last status change, preventing unrealistic
 *      rapid toggling.
 *   3. For each eligible device, draws a random number and compares it to
 *      the office-hour-aware transition probability:
 *        - During office hours (9 AM – 5 PM): high chance of ON, low chance of OFF.
 *        - Outside office hours: low chance of ON, high chance of OFF.
 *   4. Commits all chosen transitions in a single atomic batch via
 *      `updateMultipleDevices()`, which in turn:
 *        - Updates each device's `status`, `power`, and `lastChanged` fields.
 *        - Emits `device:changed` per transition and `devices:changed` once after
 *          the batch — which triggers the AlertEngine and SocketBroadcaster
 *          automatically through the EventEmitter subscription chain.
 *
 * ## Separation of concerns
 *
 * The Simulator owns **no state** other than its timer handle and running flag.
 * All device state lives in the injected DeviceStore.  This makes the Simulator
 * trivially testable: inject a deterministic clock and RNG, call `tick()`, and
 * assert on the store.
 *
 * ## Downstream notification chain (automatic, no extra code needed here)
 *
 * ```
 * Simulator.tick()
 *   → DeviceStore.updateMultipleDevices()
 *       → emits 'device:changed'  per device → AlertEngine.evaluate()
 *       → emits 'devices:changed' snapshot   → AlertEngine.evaluate()
 *                                             → SocketBroadcaster._emitDeviceScopedUpdates()
 *                                                 → socket.emit('devices:update')
 *                                                 → socket.emit('rooms:update')
 *                                                 → socket.emit('usage:update')
 * ```
 */
class Simulator {
  /**
   * @param {Object}         deps
   * @param {DeviceStore}    deps.deviceStore  The in-memory device state store.
   * @param {()=>number}     [deps.now]        Clock function (default: Date.now).
   *                                            Inject a fixed clock in tests.
   * @param {()=>number}     [deps.random]     RNG function (default: Math.random).
   *                                            Inject a deterministic RNG in tests.
   * @throws {Error} When deviceStore is not provided.
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

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start the periodic simulation loop.
   *
   * Fires an immediate first tick so the store is not stale for the first
   * SIMULATOR_TICK_MS milliseconds after boot. Safe to call multiple times —
   * subsequent calls are no-ops if already running.
   */
  start() {
    if (this._running) {
      return;
    }
    this._running = true;

    logger.info('Simulator started', {
      tickMs: config.simulatorTickMs,
      minDwellSeconds: config.minDwellSeconds,
      officeHourStart: config.officeHourStart,
      officeHourEnd: config.officeHourEnd
    });

    // Fire immediately so the first broadcast does not wait a full tick.
    this.tick();

    this._timer = setInterval(() => this.tick(), config.simulatorTickMs);
    // Unref so the timer does not prevent process exit in tests.
    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }

  /**
   * Stop the simulation loop and clear the interval.
   * Safe to call when already stopped.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
    }
    this._timer = null;
    this._running = false;
    logger.info('Simulator stopped');
  }

  // ---------------------------------------------------------------------------
  // Core tick logic
  // ---------------------------------------------------------------------------

  /**
   * Execute exactly one simulation tick.
   *
   * Public so it can be called directly in tests without starting the interval.
   * The method is intentionally synchronous — all DeviceStore mutations are
   * committed atomically and their downstream effects (alerts, sockets) are
   * handled by listeners already registered on the store's EventEmitter.
   */
  tick() {
    const nowMs = this._now();
    const officeHours = isOfficeHours(nowMs);
    const devices = this._store.getAllDevices();

    /**
     * Collect transitions for this tick.
     * @type {Array<{id:string, status:'on'|'off'}>}
     */
    const updates = [];

    for (const device of devices) {
      // Skip devices that have not yet exceeded the minimum dwell time.
      // This prevents unrealistic rapid toggling and keeps the simulation
      // believable (a fan that was just switched ON stays ON for at least
      // minDwellSeconds before the simulator can turn it OFF again).
      const dwellSeconds = this._store.getDwellSeconds(device.id, nowMs);
      if (dwellSeconds < config.minDwellSeconds) {
        continue;
      }

      // Draw a random number and compare to the office-hour-biased probability.
      const p = transitionProbability(device.status, officeHours);
      if (this._random() < p) {
        updates.push({
          id: device.id,
          status: device.status === 'on' ? 'off' : 'on'
        });
      }
    }

    if (updates.length > 0) {
      // updateMultipleDevices() commits all transitions atomically and emits:
      //   'device:changed'  per device  → AlertEngine picks this up
      //   'devices:changed' snapshot    → AlertEngine + SocketBroadcaster pick this up
      const changes = this._store.updateMultipleDevices(updates, nowMs);

      logger.debug('Simulator tick applied', {
        officeHours,
        eligible: updates.length,
        changed: changes.length,
        transitions: changes.map((c) => `${c.device.id}: ${c.previousStatus}→${c.nextStatus}`)
      });
    } else {
      logger.debug('Simulator tick — no transitions', {
        officeHours,
        devicesChecked: devices.length
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Introspection (useful for health checks and debugging)
  // ---------------------------------------------------------------------------

  /**
   * @returns {boolean} Whether the simulation loop is currently running.
   */
  get isRunning() {
    return this._running;
  }

  /**
   * @returns {boolean} Whether the current wall-clock time is within office hours.
   */
  get isOfficeHours() {
    return isOfficeHours(this._now());
  }
}

module.exports = { Simulator };
