'use strict';

/**
 * Service encapsulating Device Store operations for the REST layer.
 */
class DeviceService {
  /**
   * @param {Object} deps
   * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
   */
  constructor({ deviceStore }) {
    if (!deviceStore) {throw new Error('DeviceService requires deviceStore');}
    this._store = deviceStore;
  }

  getAll() {
    return this._store.getAllDevices();
  }

  getById(id) {
    return this._store.getDeviceById(id);
  }

  /**
   * Toggle a device's status between 'on' and 'off'.
   * Returns the updated device or null if the device was not found.
   * @param {string} id
   * @returns {import('../store/deviceStore').Device|null}
   */
  toggle(id) {
    const device = this._store.getDeviceById(id);
    if (!device) {
      return null;
    }
    const nextStatus = device.status === 'on' ? 'off' : 'on';
    this._store.updateDevice(id, nextStatus);
    return this._store.getDeviceById(id);
  }

  /**
   * Turn off all devices in a given room (used by Eco-Mode engine).
   * @param {string} roomId
   * @returns {number} Number of devices that were turned off
   */
  shutdownRoom(roomId) {
    const devices = this._store.getDevicesByRoom(roomId);
    const onDevices = devices
      .filter((d) => d.status === 'on')
      .map((d) => ({ id: d.id, status: 'off' }));
    if (onDevices.length > 0) {
      this._store.updateMultipleDevices(onDevices);
    }
    return onDevices.length;
  }
}

module.exports = { DeviceService };
