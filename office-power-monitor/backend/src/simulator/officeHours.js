'use strict';

const config = require('../config');

/**
 * Pure helpers for office-hour reasoning.
 *
 * Kept in a separate module so they can be unit-tested independently of any
 * timer, store, or network state.  The Simulator imports these; nothing else
 * in the backend needs to know how office-hour logic works internally.
 */

/**
 * Determine whether the given instant falls within configured office hours.
 *
 * Uses local time (same timezone as the machine running the backend), which
 * matches the physical office clock.
 *
 * @param {number} [nowMs=Date.now()] - Epoch milliseconds to evaluate.
 * @returns {boolean} true when hour >= OFFICE_HOUR_START and < OFFICE_HOUR_END.
 */
function isOfficeHours(nowMs = Date.now()) {
  const hour = new Date(nowMs).getHours();
  return hour >= config.officeHourStart && hour < config.officeHourEnd;
}

/**
 * Return the probability that a device *transitions* on this simulator tick,
 * given that it has already satisfied the minimum dwell time.
 *
 * ## Tuning rationale
 *
 * During office hours (9 AM – 5 PM) the office is occupied:
 *   - An OFF device has a **35 %** chance of being turned ON  (high ON bias)
 *   - An ON  device has a  **5 %** chance of being turned OFF (low OFF bias)
 *
 * Outside office hours the office is empty:
 *   - An OFF device has a  **3 %** chance of being turned ON  (low ON bias)
 *   - An ON  device has a **40 %** chance of being turned OFF (high OFF bias)
 *
 * These values are intentionally asymmetric so that the simulated office
 * reaches a predominantly-ON state by mid-morning and a predominantly-OFF
 * state within 15–20 minutes of closing time — which feels realistic and
 * gives the Alert Engine interesting conditions to detect.
 *
 * @param {'on'|'off'} currentStatus - The device's current status.
 * @param {boolean}    officeHours   - Result of {@link isOfficeHours}.
 * @returns {number} Transition probability in [0, 1].
 */
function transitionProbability(currentStatus, officeHours) {
  if (officeHours) {
    // Occupied: bias strongly toward ON.
    return currentStatus === 'off' ? 0.35 : 0.05;
  }
  // Unoccupied: bias strongly toward OFF.
  return currentStatus === 'off' ? 0.03 : 0.4;
}

module.exports = { isOfficeHours, transitionProbability };
