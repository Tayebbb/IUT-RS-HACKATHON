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
    if (!deviceStore) throw new Error('DeviceService requires deviceStore');
    this._store = deviceStore;
  }

  getAll() {
    return this._store.getAllDevices();
  }

  getById(id) {
    return this._store.getDeviceById(id);
  }
}

module.exports = { DeviceService };
