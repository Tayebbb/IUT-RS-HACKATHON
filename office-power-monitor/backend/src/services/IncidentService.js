'use strict';

/**
 * Service encapsulating Incident Aggregator operations for the REST layer.
 */
class IncidentService {
  /**
   * @param {Object} deps
   * @param {import('../incidents/incidentAggregator').IncidentAggregator} deps.incidentAggregator
   */
  constructor({ incidentAggregator }) {
    if (!incidentAggregator) {throw new Error('IncidentService requires incidentAggregator');}
    this._aggregator = incidentAggregator;
  }

  getAll() {
    return this._aggregator.getAll();
  }

  getActive() {
    return this._aggregator.getActive();
  }
}

module.exports = { IncidentService };
