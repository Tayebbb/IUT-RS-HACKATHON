'use strict';

/**
 * EnergyService: convenience readers on top of EnergyStore + unit helpers.
 * @typedef {import('../store/energyStore').EnergyStore} EnergyStore
 * @typedef {import('../store/energyStore').EnergySample} EnergySample
 */

/**
 * @param {number} wh
 * @returns {number} kWh, rounded to 3 decimals.
 */
function whToKwh(wh) {
  return Math.round((wh / 1000) * 1000) / 1000;
}

/**
 * @param {EnergyStore} energyStore
 * @returns {{energyTodayWh:number, energyTodayKwh:number, samples:EnergySample[]}}
 */
function snapshot(energyStore) {
  const energyTodayWh = energyStore.getEnergyTodayWh();
  return {
    energyTodayWh,
    energyTodayKwh: whToKwh(energyTodayWh),
    samples: energyStore.getSamples()
  };
}

module.exports = { whToKwh, snapshot };
