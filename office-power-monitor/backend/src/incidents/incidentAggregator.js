'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * @typedef {import('../alerts/alertStore').Alert} Alert
 * @typedef {import('../alerts/alertStore').AlertStore} AlertStore
 *
 * @typedef {Object} Incident
 * @property {string} id
 * @property {string|null} room
 * @property {'active'|'resolved'} status
 * @property {'low'|'medium'|'high'} severity   Highest severity of member alerts.
 * @property {string[]} alertIds
 * @property {string} title
 * @property {string} createdAt   ISO
 * @property {string} updatedAt   ISO
 * @property {string|null} resolvedAt ISO
 */

/**
 * Severity ordering used to roll up incident severity from members.
 */
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

/**
 * @param {'low'|'medium'|'high'} a
 * @param {'low'|'medium'|'high'} b
 */
function maxSeverity(a, b) {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * IncidentAggregator groups related alerts into incidents.
 *
 * Grouping policy: **one active incident per room**. Every alert emitted
 * for that room while the incident is open is attached to it. The
 * incident auto-resolves when the room has no active alerts left.
 *
 * Alerts with `room === null` (should not happen today, but future-proof)
 * are grouped under the pseudo-room `"__global__"`.
 *
 * Emits:
 *   'incident:opened'    (Incident)
 *   'incident:updated'   (Incident)
 *   'incident:resolved'  (Incident)
 *   'incidents:changed'  (Incident[])
 */
class IncidentAggregator extends EventEmitter {
  /**
   * @param {Object} deps
   * @param {AlertStore} deps.alertStore
   * @param {() => number} [deps.now]
   */
  constructor({ alertStore, now }) {
    super();
    if (!alertStore) {
      throw new Error('IncidentAggregator requires alertStore');
    }
    this._alerts = alertStore;
    this._now = now || Date.now;
    /** @type {Map<string, Incident>} roomKey → active incident */
    this._activeByRoom = new Map();
    /** @type {Map<string, Incident>} id → incident (all history) */
    this._byId = new Map();
    this._seq = 0;
    this._boundEvaluate = () => this.evaluate();
  }

  /** @private */
  _nextId() {
    this._seq += 1;
    return `incident-${Date.now().toString(36)}-${this._seq}`;
  }

  /** Subscribe to alert store changes. */
  start() {
    this._alerts.on('alerts:changed', this._boundEvaluate);
    this._alerts.on('alert:opened', this._boundEvaluate);
    this._alerts.on('alert:resolved', this._boundEvaluate);
    logger.info('IncidentAggregator started');
    this.evaluate();
  }

  stop() {
    this._alerts.off('alerts:changed', this._boundEvaluate);
    this._alerts.off('alert:opened', this._boundEvaluate);
    this._alerts.off('alert:resolved', this._boundEvaluate);
    logger.info('IncidentAggregator stopped');
  }

  /** @returns {Incident[]} newest first. */
  getAll() {
    return Array.from(this._byId.values())
      .map((i) => ({ ...i, alertIds: [...i.alertIds] }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** @returns {Incident[]} */
  getActive() {
    return Array.from(this._activeByRoom.values()).map((i) => ({
      ...i,
      alertIds: [...i.alertIds]
    }));
  }

  /**
   * Recompute incidents from the current alert snapshot.
   * Idempotent — safe to call as often as needed.
   */
  evaluate() {
    const nowMs = this._now();
    const iso = new Date(nowMs).toISOString();
    const active = this._alerts.getActive();

    /** @type {Map<string, Alert[]>} */
    const grouped = new Map();
    for (const a of active) {
      const key = a.room || '__global__';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(a);
    }

    let changed = false;

    // Open or update incidents for rooms with active alerts.
    for (const [roomKey, alerts] of grouped.entries()) {
      const severity = alerts.reduce(
        (acc, a) => maxSeverity(acc, a.severity),
        /** @type {'low'|'medium'|'high'} */ ('low')
      );
      const alertIds = alerts.map((a) => a.id).sort();
      const title = this._buildTitle(roomKey, alerts);

      const existing = this._activeByRoom.get(roomKey);
      if (!existing) {
        /** @type {Incident} */
        const incident = {
          id: this._nextId(),
          room: roomKey === '__global__' ? null : roomKey,
          status: 'active',
          severity,
          alertIds,
          title,
          createdAt: iso,
          updatedAt: iso,
          resolvedAt: null
        };
        this._activeByRoom.set(roomKey, incident);
        this._byId.set(incident.id, incident);
        this.emit('incident:opened', { ...incident, alertIds: [...alertIds] });
        changed = true;
      } else {
        let mutated = false;
        if (existing.severity !== severity) {
          existing.severity = severity;
          mutated = true;
        }
        if (existing.title !== title) {
          existing.title = title;
          mutated = true;
        }
        if (existing.alertIds.join(',') !== alertIds.join(',')) {
          existing.alertIds = alertIds;
          mutated = true;
        }
        if (mutated) {
          existing.updatedAt = iso;
          this.emit('incident:updated', { ...existing, alertIds: [...alertIds] });
          changed = true;
        }
      }
    }

    // Resolve incidents whose room no longer has any active alerts.
    for (const [roomKey, incident] of Array.from(this._activeByRoom.entries())) {
      if (!grouped.has(roomKey)) {
        incident.status = 'resolved';
        incident.resolvedAt = iso;
        incident.updatedAt = iso;
        this._activeByRoom.delete(roomKey);
        this.emit('incident:resolved', { ...incident, alertIds: [...incident.alertIds] });
        changed = true;
      }
    }

    if (changed) {
      this.emit('incidents:changed', this.getAll());
    }
  }

  /**
   * @param {string} roomKey
   * @param {Alert[]} alerts
   * @returns {string}
   * @private
   */
  _buildTitle(roomKey, alerts) {
    const scope = roomKey === '__global__' ? 'Office' : roomKey;
    const kinds = Array.from(new Set(alerts.map((a) => a.kind))).sort();
    return `${scope}: ${alerts.length} alert${alerts.length === 1 ? '' : 's'} (${kinds.join(', ')})`;
  }
}

module.exports = { IncidentAggregator };
