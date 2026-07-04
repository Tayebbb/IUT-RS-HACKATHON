'use strict';

/**
 * RoomSampleBuffer maintains a rolling window of per-room power readings.
 *
 * It is filled by the SocketBroadcaster on every heartbeat tick and on
 * every device-change event, giving the AlertEngine a per-room history
 * needed for anomaly detection, and giving the frontend sparkline data
 * without touching the database.
 */
class RoomSampleBuffer {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxSamples=60]  ~5 minutes at a 5s heartbeat
   */
  constructor(opts = {}) {
    this._max = opts.maxSamples ?? 60;
    /** @type {Map<string, Array<{ts: number, w: number}>>} */
    this._data = new Map();
  }

  /**
   * Record a new snapshot for all rooms.
   * @param {Array<{id: string, powerWatts: number}>} roomSnapshots
   * @param {number} [nowMs]
   */
  record(roomSnapshots, nowMs = Date.now()) {
    for (const { id, powerWatts } of roomSnapshots) {
      if (!this._data.has(id)) {
        this._data.set(id, []);
      }
      const buf = this._data.get(id);
      buf.push({ ts: nowMs, w: powerWatts });
      if (buf.length > this._max) {
        buf.splice(0, buf.length - this._max);
      }
    }
  }

  /**
   * Get the last N samples for a room, oldest first.
   * @param {string} roomId
   * @param {number} [n=20]  How many to return (for sparklines, 20 is plenty)
   * @returns {Array<{ts: number, w: number}>}
   */
  getSamples(roomId, n = 20) {
    const buf = this._data.get(roomId);
    if (!buf || buf.length === 0) {return [];}
    return buf.slice(-n);
  }

  /**
   * Compute basic statistics (mean, stddev, latest) for a room.
   * Used by the AlertEngine to detect anomalous spikes.
   * Returns null if there are fewer than 3 samples.
   * @param {string} roomId
   * @returns {{ mean: number, stddev: number, latest: number } | null}
   */
  getStats(roomId) {
    const buf = this._data.get(roomId);
    if (!buf || buf.length < 3) {return null;}

    const values = buf.map((s) => s.w);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);
    const latest = values[values.length - 1];

    return { mean, stddev, latest };
  }

  /** @returns {string[]} All known room IDs */
  getRoomIds() {
    return Array.from(this._data.keys());
  }
}

module.exports = { RoomSampleBuffer };
