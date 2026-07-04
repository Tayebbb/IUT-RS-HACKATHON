'use strict';

const powerService = require('./powerService');
const energyService = require('./energyService');
const roomService = require('./roomService');
const config = require('../config');

/**
 * @typedef {import('../store/deviceStore').DeviceStore} DeviceStore
 * @typedef {import('../store/energyStore').EnergyStore} EnergyStore
 *
 * @typedef {Object} UsageSnapshot
 * @property {number} timestamp
 * @property {number} currentPowerWatts
 * @property {Record<string, number>} powerByRoom
 * @property {Record<'fan'|'light', number>} powerByType
 * @property {Record<string, number>} powerByDevice
 * @property {{roomId:string|null, name:string|null, watts:number}} highestConsumingRoom
 * @property {number} activeDevicesCount
 * @property {number} inactiveDevicesCount
 * @property {Array<{id:string, label:string, room:string, type:string, power:number}>} activeDevices
 * @property {number} energyTodayWh
 * @property {number} energyTodayKwh
 * @property {Array<{timestamp:number,powerWatts:number}>} samples
 */

/**
 * UsageService composes power + energy + room data into a single
 * snapshot the REST endpoint and Socket.IO broadcaster both consume.
 *
 * @param {DeviceStore} deviceStore
 * @param {EnergyStore} energyStore
 * @returns {UsageSnapshot}
 */
function buildUsageSnapshot(deviceStore, energyStore) {
  const devices = deviceStore.getAllDevices();
  const rooms = deviceStore.getRooms();

  const currentPowerWatts = powerService.totalPower(devices);
  const perRoom = powerService.powerByRoom(devices);
  const perType = powerService.powerByType(devices);
  const perDevice = powerService.powerByDevice(devices);
  const highest = powerService.highestConsumingRoom(devices);
  const highestName = highest.roomId
    ? (rooms.find((r) => r.id === highest.roomId)?.name ?? null)
    : null;
    
  const activeDevs = powerService.activeDevices(devices);
  const inactiveCount = powerService.inactiveDevicesCount(devices);
  
  const energy = energyService.snapshot(energyStore);
  const tariff = config.tariffBdtPerKwh || 7.0;
  const energyCostBdt = Number((energy.energyTodayKwh * tariff).toFixed(2));
  const projectedMonthlyKwh = Number((energy.energyTodayKwh * 30).toFixed(2));
  const projectedMonthlyCostBdt = Number((energy.energyTodayKwh * 30 * tariff).toFixed(2));

  return {
    timestamp: Date.now(),
    currentPowerWatts,
    powerByRoom: perRoom,
    powerByType: perType,
    powerByDevice: perDevice,
    activeDevicesCount: activeDevs.length,
    inactiveDevicesCount: inactiveCount,
    activeDevices: activeDevs.map(d => ({
      id: d.id,
      label: d.label,
      room: d.room,
      type: d.type,
      power: d.power
    })),
    highestConsumingRoom: {
      roomId: highest.roomId,
      name: highestName,
      watts: highest.watts
    },
    energyTodayWh: energy.energyTodayWh,
    energyTodayKwh: energy.energyTodayKwh,
    energyCostBdt,
    projectedMonthlyKwh,
    projectedMonthlyCostBdt,
    samples: energy.samples
  };
}

/**
 * Service class encapsulating Usage pure functions for the REST layer.
 */
class UsageService {
  /**
   * @param {Object} deps
   * @param {DeviceStore} deps.deviceStore
   * @param {EnergyStore} deps.energyStore
   */
  constructor({ deviceStore, energyStore }) {
    if (!deviceStore || !energyStore) {throw new Error('UsageService requires deviceStore and energyStore');}
    this._deviceStore = deviceStore;
    this._energyStore = energyStore;
  }

  getSnapshot() {
    return buildUsageSnapshot(this._deviceStore, this._energyStore);
  }
}

module.exports = { buildUsageSnapshot, UsageService, roomService };
