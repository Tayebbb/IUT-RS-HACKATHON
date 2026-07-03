'use strict';

/**
 * Service encapsulating Alert Store operations for the REST layer.
 */
class AlertService {
  /**
   * @param {Object} deps
   * @param {import('../alerts/alertStore').AlertStore} deps.alertStore
   */
  constructor({ alertStore }) {
    if (!alertStore) throw new Error('AlertService requires alertStore');
    this._store = alertStore;
  }

  getAll() {
    return this._store.getAll();
  }

  getActive() {
    return this._store.getActive();
  }
}

module.exports = { AlertService };
