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
 * @param {import('../store/roomSampleBuffer').RoomSampleBuffer} [sampleBuffer]
 * @returns {RoomSummary[]}
 */
function summarizeRooms(store, sampleBuffer) {
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
      allOn: roomDevices.length > 0 && onCount === roomDevices.length,
      samples: sampleBuffer ? sampleBuffer.getSamples(room.id, 20) : []
    };
  });
}

/**
 * @param {DeviceStore} store
 * @param {import('../store/roomSampleBuffer').RoomSampleBuffer} [sampleBuffer]
 * @param {string} roomId
 * @returns {RoomSummary|undefined}
 */
function getRoomSummary(store, sampleBuffer, roomId) {
  return summarizeRooms(store, sampleBuffer).find((r) => r.id === roomId);
}

/**
 * Service class encapsulating Room pure functions for the REST layer.
 */
class RoomService {
  /**
   * @param {Object} deps
   * @param {DeviceStore} deps.deviceStore
   * @param {import('../store/roomSampleBuffer').RoomSampleBuffer} [deps.roomSampleBuffer]
   */
  constructor({ deviceStore, roomSampleBuffer }) {
    if (!deviceStore) {throw new Error('RoomService requires deviceStore');}
    this._store = deviceStore;
    this._sampleBuffer = roomSampleBuffer;
  }

  summarizeRooms() {
    return summarizeRooms(this._store, this._sampleBuffer);
  }

  getRoomSummary(roomId) {
    return getRoomSummary(this._store, this._sampleBuffer, roomId);
  }

  /**
   * Return rich room summaries for all rooms (alias of summarizeRooms for clarity).
   * @returns {RoomSummary[]}
   */
  getRooms() {
    return this.summarizeRooms();
  }
}

module.exports = { summarizeRooms, getRoomSummary, RoomService };
