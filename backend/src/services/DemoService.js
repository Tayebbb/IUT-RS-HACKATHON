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
      case 'everything-off': {
        const updates = [];
        for (const d of all) {
          if (d.status !== 'off') {
            updates.push({ id: d.id, status: 'off' });
          }
        }
        this._devices.updateMultipleDevices(updates, nowMs);
        if (this._energyStore) {
          this._energyStore.reset(12400); // Seed 12.4 kWh for persuasive demo figures
        }
        return { message: 'All devices turned OFF' };
      }

      case 'high-power':
      case 'office-hours': {
        const updates = [];
        for (const d of all) {
          if (d.status !== 'on') {
            updates.push({ id: d.id, status: 'on' });
          }
        }
        this._devices.updateMultipleDevices(updates, nowMs);
        return { message: 'All devices turned ON (High Power / Office Hours)' };
      }

      case 'alert-scenario':
      case 'after-hours': {
        // Turn everything in Drawing Room ON, and leave others OFF to trigger room_on_after_hours if outside office hours,
        // or we can just turn a specific device ON.
        const updates = [];
        for (const d of all) {
          const target = d.room === 'drawing-room' ? 'on' : 'off';
          if (d.status !== target) {
            updates.push({ id: d.id, status: target });
          }
        }
        this._devices.updateMultipleDevices(updates, nowMs);
        return { message: 'Drawing room devices turned ON (Alert Scenario)' };
      }

      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }
}

module.exports = { DemoService };
