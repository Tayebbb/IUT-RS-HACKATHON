'use strict';

/**
 * Static room and device definitions for the office.
 * Wattage: Fan = 60W, Light = 15W.
 * Device IDs are stable so the frontend and Discord bot can address them.
 */

/** @type {ReadonlyArray<{id:string,name:string}>} */
const ROOMS = Object.freeze([
  { id: 'drawing-room', name: 'Drawing Room' },
  { id: 'work-room-1', name: 'Work Room 1' },
  { id: 'work-room-2', name: 'Work Room 2' }
]);

const WATTAGE = Object.freeze({
  fan: 60,
  light: 15
});

/**
 * Build the initial device catalog: 2 fans + 3 lights per room = 15 devices total.
 * @returns {Array<{id:string,label:string,type:'fan'|'light',room:string,wattage:number}>}
 */
function buildDeviceCatalog() {
  const devices = [];
  for (const room of ROOMS) {
    // 2 Fans per room
    for (let i = 1; i <= 2; i += 1) {
      devices.push({
        id: `${room.id}-fan-${i}`,
        label: `Fan ${i}`,
        type: 'fan',
        room: room.id,
        wattage: WATTAGE.fan
      });
    }
    // 3 Lights per room
    for (let i = 1; i <= 3; i += 1) {
      devices.push({
        id: `${room.id}-light-${i}`,
        label: `Light ${i}`,
        type: 'light',
        room: room.id,
        wattage: WATTAGE.light
      });
    }
  }
  return devices;
}

module.exports = {
  ROOMS,
  WATTAGE,
  buildDeviceCatalog
};
