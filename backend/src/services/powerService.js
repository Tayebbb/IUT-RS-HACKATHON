'use strict';

/**
 * @typedef {import('../store/deviceStore').Device} Device
 */

/**
 * PowerCalculator: pure functions to derive instantaneous power figures
 * from a device snapshot. No I/O, no state.
 */

/**
 * @param {Device[]} devices
 * @returns {number} Total instantaneous power in watts (ON devices only).
 */
function totalPower(devices) {
  let sum = 0;
  for (const d of devices) {
    if (d.status === 'on') {
      sum += d.power;
    }
  }
  return sum;
}

/**
 * @param {Device[]} devices
 * @returns {Record<string, number>} Room id → watts.
 */
function powerByRoom(devices) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const d of devices) {
    out[d.room] = (out[d.room] || 0) + (d.status === 'on' ? d.power : 0);
  }
  return out;
}

/**
 * @param {Device[]} devices
 * @returns {Record<'fan'|'light', number>} Type → watts.
 */
function powerByType(devices) {
  const out = { fan: 0, light: 0 };
  for (const d of devices) {
    if (d.status === 'on') {
      out[d.type] += d.power;
    }
  }
  return out;
}

/**
 * @param {Device[]} devices
 * @returns {{roomId:string|null, watts:number}}
 */
function highestConsumingRoom(devices) {
  const perRoom = powerByRoom(devices);
  let roomId = null;
  let watts = 0;
  for (const [id, w] of Object.entries(perRoom)) {
    if (w > watts) {
      watts = w;
      roomId = id;
    }
  }
  return { roomId, watts };
}

/**
 * @param {Device[]} devices
 * @returns {Record<string, number>} Device id → watts.
 */
function powerByDevice(devices) {
  const out = {};
  for (const d of devices) {
    if (d.status === 'on') {
      out[d.id] = d.power;
    }
  }
  return out;
}

/**
 * @param {Device[]} devices
 * @returns {Device[]}
 */
function activeDevices(devices) {
  return devices.filter(d => d.status === 'on');
}

/**
 * @param {Device[]} devices
 * @returns {number}
 */
function inactiveDevicesCount(devices) {
  return devices.filter(d => d.status === 'off').length;
}

module.exports = {
  totalPower,
  powerByRoom,
  powerByType,
  highestConsumingRoom,
  powerByDevice,
  activeDevices,
  inactiveDevicesCount
};
