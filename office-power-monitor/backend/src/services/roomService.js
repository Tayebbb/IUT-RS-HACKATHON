'use strict';

const powerService = require('./powerService');

/**
 * @typedef {import('../store/deviceStore').Device} Device
 * @typedef {import('../store/deviceStore').DeviceStore} DeviceStore
 *
 * @typedef {Object} RoomSummary
 * @property {string} id
 * @property {string} name
 * @property {Device[]} devices
 * @property {number} totalDevices
 * @property {number} onCount
 * @property {number} offCount
 * @property {number} powerWatts
 * @property {boolean} allOn
 */

/**
 * Build a rich summary of every room from the current device snapshot.
 * @param {DeviceStore} store
 * @returns {RoomSummary[]}
 */
function summarizeRooms(store) {
  const rooms = store.getRooms();
  const devices = store.getAll();
  const perRoomWatts = powerService.powerByRoom(devices);

  return rooms.map((room) => {
    const roomDevices = devices.filter((d) => d.room === room.id);
    const onCount = roomDevices.filter((d) => d.status === 'on').length;
    return {
      id: room.id,
      name: room.name,
      devices: roomDevices,
      totalDevices: roomDevices.length,
      onCount,
      offCount: roomDevices.length - onCount,
      powerWatts: perRoomWatts[room.id] || 0,
      allOn: roomDevices.length > 0 && onCount === roomDevices.length
    };
  });
}

/**
 * @param {DeviceStore} store
 * @param {string} roomId
 * @returns {RoomSummary|undefined}
 */
function getRoomSummary(store, roomId) {
  return summarizeRooms(store).find((r) => r.id === roomId);
}

/**
 * Service class encapsulating Room pure functions for the REST layer.
 */
class RoomService {
  /**
   * @param {Object} deps
   * @param {DeviceStore} deps.deviceStore
   */
  constructor({ deviceStore }) {
    if (!deviceStore) throw new Error('RoomService requires deviceStore');
    this._store = deviceStore;
  }

  summarizeRooms() {
    return summarizeRooms(this._store);
  }

  getRoomSummary(roomId) {
    return getRoomSummary(this._store, roomId);
  }
}

module.exports = { summarizeRooms, getRoomSummary, RoomService };
