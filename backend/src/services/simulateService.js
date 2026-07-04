'use strict';

const powerService = require('./powerService');
const config = require('../config');
const { AlertEngine } = require('../alerts/alertEngine');
const { AlertStore } = require('../alerts/alertStore');
const { ROOMS } = require('../config/devices');

/**
 * A tiny mock of DeviceStore that satisfies AlertEngine's requirement
 * for `this._devices`. It only needs `getAll()` and `getRooms()`.
 */
class MockDeviceStore {
  constructor(devices) {
    this.devices = devices;
  }
  getAll() {
    return this.devices;
  }
  getRooms() {
    return ROOMS;
  }
  // AlertEngine binds to events, so we provide no-ops
  on() {}
  off() {}
}

/**
 * Calculates the delta between the live state and the proposed simulated state.
 * @param {import('../store/deviceStore').DeviceStore} liveDeviceStore
 * @param {import('../store/roomSampleBuffer').RoomSampleBuffer} roomSampleBuffer
 * @param {Array} simulatedDevices
 */
function evaluateSimulation(liveDeviceStore, roomSampleBuffer, simulatedDevices) {
  const liveDevices = liveDeviceStore.getAll();

  // Power & Cost Calculations
  const livePowerWatts = powerService.totalPower(liveDevices);
  const simPowerWatts = powerService.totalPower(simulatedDevices);
  const savedWatts = livePowerWatts - simPowerWatts;

  const tariff = config.tariffBdtPerKwh || 7.0;

  // Projected Monthly Cost (Watts / 1000 * 24 hrs * 30 days * tariff)
  const monthlyMultiplier = (24 * 30 * tariff) / 1000;

  const liveMonthlyBdt = Number((livePowerWatts * monthlyMultiplier).toFixed(2));
  const simMonthlyBdt = Number((simPowerWatts * monthlyMultiplier).toFixed(2));
  const savedMonthlyBdt = Number((savedWatts * monthlyMultiplier).toFixed(2));

  // Stateless Alert Evaluation
  const mockDevices = new MockDeviceStore(simulatedDevices);
  const mockAlertStore = new AlertStore();

  const engine = new AlertEngine({
    deviceStore: mockDevices,
    alertStore: mockAlertStore,
    roomSampleBuffer,
    // We pass null for hfService so we don't trigger real API calls during simulation evaluation
    hfService: null
  });

  // Running evaluate() will populate `mockAlertStore` with any active alerts based on `simulatedDevices`
  engine.evaluate();

  const simulatedAlerts = mockAlertStore.getActive();

  return {
    livePowerWatts,
    simPowerWatts,
    savedWatts,
    liveMonthlyBdt,
    simMonthlyBdt,
    savedMonthlyBdt,
    simulatedAlerts
  };
}

module.exports = { evaluateSimulation };
