'use strict';

/**
 * @typedef {Object} EnergySample
 * @property {number} timestamp   Epoch ms when the sample was taken.
 * @property {number} powerWatts  Total instantaneous power at that instant.
 */

/**
 * EnergyStore accumulates energy (Wh) consumed since local midnight using
 * trapezoidal integration over a rolling stream of power samples.
 *
 * It also keeps a short rolling window of samples so the API/frontend can
 * render sparkline-style history without a database.
 */
class EnergyStore {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxSamples=2880]  ~4h @ one sample every 5s.
   */
  constructor(opts = {}) {
    this._maxSamples = opts.maxSamples ?? 2880;
    /** @type {EnergySample[]} */
    this._samples = [];
    this._energyWhToday = 0;
    this._dayKey = this._dayKeyFor(Date.now());
  }

  /**
   * Reset Wh today and samples with optional seed.
   * @param {number} [seedWh=0]
   */
  reset(seedWh = 0) {
    this._samples = [];
    this._energyWhToday = seedWh;
  }

  /**
   * @param {number} ms
   * @returns {string} YYYY-MM-DD in local time.
   * @private
   */
  _dayKeyFor(ms) {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Record a new power sample and integrate energy.
   * @param {number} powerWatts
   * @param {number} [nowMs=Date.now()]
   */
  record(powerWatts, nowMs = Date.now()) {
    const key = this._dayKeyFor(nowMs);
    if (key !== this._dayKey) {
      this._dayKey = key;
      this._energyWhToday = 0;
    }

    const last = this._samples[this._samples.length - 1];
    if (last) {
      const hours = (nowMs - last.timestamp) / 3_600_000;
      const avgW = (last.powerWatts + powerWatts) / 2;
      this._energyWhToday += avgW * hours;
    }

    this._samples.push({ timestamp: nowMs, powerWatts });
    if (this._samples.length > this._maxSamples) {
      this._samples.splice(0, this._samples.length - this._maxSamples);
    }
  }

  /** @returns {number} Energy consumed today in Wh. */
  getEnergyTodayWh() {
    return this._energyWhToday;
  }

  /** @returns {EnergySample[]} Defensive copy of recent samples. */
  getSamples() {
    return this._samples.slice();
  }

  /** @returns {EnergySample|undefined} */
  getLatestSample() {
    return this._samples[this._samples.length - 1];
  }
}

const energyStore = new EnergyStore();

module.exports = { EnergyStore, energyStore };
