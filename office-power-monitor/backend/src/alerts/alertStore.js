'use strict';

const { EventEmitter } = require('events');

/**
 * @typedef {'low'|'medium'|'high'} AlertSeverity
 *
 * @typedef {'device_on_after_hours'|'room_on_after_hours'|'room_on_too_long'} AlertKind
 *
 * @typedef {Object} Alert
 * @property {string} id
 * @property {AlertKind} kind
 * @property {AlertSeverity} severity
 * @property {string|null} room
 * @property {string|null} device
 * @property {string} message
 * @property {'active'|'resolved'} status
 * @property {string} createdAt   ISO
 * @property {string} updatedAt   ISO
 * @property {string|null} resolvedAt ISO
 * @property {boolean} resolved
 */

/**
 * AlertStore holds active + historical alerts keyed by a deterministic
 * "signature" so the same recurring condition upserts instead of duplicating.
 * Emits:
 *   'alert:opened'   (Alert)
 *   'alert:updated'  (Alert)
 *   'alert:resolved' (Alert)
 *   'alerts:changed' (Alert[])  after any batch of mutations
 */
class AlertStore extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, Alert>} keyed by signature (active only) */
    this._activeBySig = new Map();
    /** @type {Map<string, Alert>} keyed by alert id (all history) */
    this._byId = new Map();
    this._seq = 0;
  }

  /** @private */
  _nextId() {
    this._seq += 1;
    return `alert-${Date.now().toString(36)}-${this._seq}`;
  }

  /**
   * @returns {Alert[]} All alerts (active + resolved), newest first.
   */
  getAll() {
    return Array.from(this._byId.values())
      .map((a) => ({ ...a }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** @returns {Alert[]} Only active alerts. */
  getActive() {
    return Array.from(this._activeBySig.values()).map((a) => ({ ...a }));
  }

  /** @param {string} sig */
  getActiveBySignature(sig) {
    const a = this._activeBySig.get(sig);
    return a ? { ...a } : undefined;
  }

  /**
   * Upsert an active alert for a given signature. If a matching active alert
   * exists it's updated (message/severity refreshed). Otherwise a new one
   * is opened.
   *
   * @param {Object} params
   * @param {string} params.signature
   * @param {AlertKind} params.kind
   * @param {AlertSeverity} params.severity
   * @param {string|null} params.room
   * @param {string|null} params.device
   * @param {string} params.message
   * @param {number} [params.nowMs=Date.now()]
   * @returns {{alert:Alert, opened:boolean}}
   */
  upsert({ signature, kind, severity, room, device, message, nowMs = Date.now() }) {
    const iso = new Date(nowMs).toISOString();
    const existing = this._activeBySig.get(signature);

    if (existing) {
      let changed = false;
      if (existing.severity !== severity) {
        existing.severity = severity;
        changed = true;
      }
      if (existing.message !== message) {
        existing.message = message;
        changed = true;
      }
      if (changed) {
        existing.updatedAt = iso;
        this.emit('alert:updated', { ...existing });
      }
      return { alert: { ...existing }, opened: false };
    }

    /** @type {Alert} */
    const alert = {
      id: this._nextId(),
      kind,
      severity,
      room,
      device,
      message,
      status: 'active',
      resolved: false,
      createdAt: iso,
      updatedAt: iso,
      resolvedAt: null
    };
    this._activeBySig.set(signature, alert);
    this._byId.set(alert.id, alert);
    
    // Garbage collection for memory safety
    if (this._byId.size > 500) {
      const oldestKey = this._byId.keys().next().value;
      this._byId.delete(oldestKey);
    }

    this.emit('alert:opened', { ...alert });
    return { alert: { ...alert }, opened: true };
  }

  /**
   * Resolve every active alert whose signature is not present in `keepSet`.
   * Called by the engine after each evaluation pass.
   * @param {Set<string>} keepSet
   * @param {number} [nowMs=Date.now()]
   * @returns {Alert[]} resolved alerts.
   */
  resolveMissing(keepSet, nowMs = Date.now()) {
    const iso = new Date(nowMs).toISOString();
    /** @type {Alert[]} */
    const resolved = [];
    for (const [sig, alert] of this._activeBySig.entries()) {
      if (!keepSet.has(sig)) {
        alert.status = 'resolved';
        alert.resolved = true;
        alert.resolvedAt = iso;
        alert.updatedAt = iso;
        this._activeBySig.delete(sig);
        this.emit('alert:resolved', { ...alert });
        resolved.push({ ...alert });
      }
    }
    return resolved;
  }

  /** Emit the aggregate change notification. */
  emitChanged() {
    this.emit('alerts:changed', this.getAll());
  }
}

const alertStore = new AlertStore();
module.exports = { AlertStore, alertStore };
