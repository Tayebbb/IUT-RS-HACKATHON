'use strict';

const logger = require('../utils/logger');

class DemoService {
  /**
   * @param {Object} deps
   * @param {import('../store').DeviceStore} deps.deviceStore
   * @param {import('../simulator/Simulator').Simulator} deps.simulator
   * @param {import('../store/energyStore').EnergyStore} [deps.energyStore]
   */
  constructor({ deviceStore, simulator, energyStore }) {
    this._devices = deviceStore;
    this._simulator = simulator;
    this._energyStore = energyStore;
  }

  /**
   * Triggers a specific demo scenario.
   * @param {string} scenario 
   * @returns {Object} Result of the operation.
   */
  triggerScenario(scenario) {
    logger.info(`[demo] Triggering scenario: ${scenario}`);
    const all = this._devices.getAll();
    const nowMs = Date.now();

    switch (scenario) {
      case 'everything-off':
        for (const d of all) {
          if (d.status !== 'off') {
            this._devices.updateDevice(d.id, 'off', nowMs);
          }
        }
        if (this._energyStore) {
          this._energyStore.reset(12400); // Seed 12.4 kWh for persuasive demo figures
        }
        return { message: 'All devices turned OFF' };

      case 'high-power':
      case 'office-hours':
        for (const d of all) {
          if (d.status !== 'on') {
            this._devices.updateDevice(d.id, 'on', nowMs);
          }
        }
        return { message: 'All devices turned ON (High Power / Office Hours)' };

      case 'alert-scenario':
      case 'after-hours':
        // Turn everything in Drawing Room ON, and leave others OFF to trigger room_on_after_hours if outside office hours,
        // or we can just turn a specific device ON.
        for (const d of all) {
          const target = d.room === 'drawing-room' ? 'on' : 'off';
          if (d.status !== target) {
            this._devices.updateDevice(d.id, target, nowMs);
          }
        }
        return { message: 'Drawing room devices turned ON (Alert Scenario)' };

      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }
}

module.exports = { DemoService };
