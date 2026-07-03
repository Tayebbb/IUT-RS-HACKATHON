'use strict';

/**
 * Barrel export for the in-memory store layer.
 *
 * Exposes:
 *  - deviceStore  — singleton DeviceStore (source of truth for all 15 devices)
 *  - energyStore  — singleton EnergyStore (rolling Wh accumulator)
 *  - DeviceStore  — class, for consumers that need the type or want a fresh instance in tests
 *  - EnergyStore  — class, for test instantiation
 */

const { deviceStore, DeviceStore } = require('./deviceStore');
const { energyStore, EnergyStore } = require('./energyStore');

module.exports = {
  deviceStore,
  energyStore,
  DeviceStore,
  EnergyStore
};
