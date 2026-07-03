'use strict';

/**
 * Pure formatting helpers. These are the FALLBACK templates used when
 * OpenAI polishing is disabled or fails.
 */

/** @param {number} w */
const fmtW = (w) => `${Math.round(w)}W`;
/** @param {number} kwh */
const fmtKwh = (kwh) => `${kwh.toFixed(3)} kWh`;

/**
 * @param {{rooms:any[], usage:any, alerts:any[]}} snap
 * @returns {string}
 */
function formatStatus(snap) {
  const { rooms, usage, alerts } = snap;
  const lines = [
    '**Office Power Status**',
    `Current draw: **${fmtW(usage.currentPowerWatts)}**`,
    `Energy today: **${fmtKwh(usage.energyTodayKwh)}**`,
    usage.highestConsumingRoom.roomId
      ? `Top room: **${usage.highestConsumingRoom.name}** (${fmtW(usage.highestConsumingRoom.watts)})`
      : 'Top room: _none active_',
    '',
    '**Rooms**'
  ];
  for (const r of rooms) {
    lines.push(`• ${r.name}: ${r.onCount}/${r.totalDevices} on · ${fmtW(r.powerWatts)}`);
  }
  lines.push('', `Active alerts: **${alerts.length}**`);
  return lines.join('\n');
}

/**
 * @param {any} room
 * @returns {string}
 */
function formatRoom(room) {
  const lines = [
    `**${room.name}** (${room.id})`,
    `Devices ON: ${room.onCount}/${room.totalDevices}`,
    `Power draw: ${fmtW(room.powerWatts)}`,
    room.allOn ? '_All devices are ON_' : '',
    '',
    '**Devices**'
  ].filter(Boolean);
  for (const d of room.devices) {
    const icon = d.status === 'on' ? '🟢' : '⚫';
    lines.push(`${icon} ${d.label} (${d.type}) — ${fmtW(d.status === 'on' ? d.power : 0)}`);
  }
  return lines.join('\n');
}

/**
 * @param {any} usage
 * @returns {string}
 */
function formatUsage(usage) {
  const lines = [
    '**Office Power Usage**',
    `Instantaneous: **${fmtW(usage.currentPowerWatts)}**`,
    `Today: **${fmtKwh(usage.energyTodayKwh)}**`,
    `Active Devices: **${usage.activeDevicesCount}**`,
    `Inactive Devices: **${usage.inactiveDevicesCount}**`,
    '',
    '**By room**'
  ];
  for (const [id, w] of Object.entries(usage.powerByRoom)) {
    lines.push(`• ${id}: ${fmtW(w)}`);
  }
  lines.push('', '**By type**');
  lines.push(`• Fans: ${fmtW(usage.powerByType.fan)}`);
  lines.push(`• Lights: ${fmtW(usage.powerByType.light)}`);
  return lines.join('\n');
}

/**
 * @param {any} alert
 * @returns {string}
 */
function formatAlert(alert) {
  const icon = alert.severity === 'high' ? '🚨' : alert.severity === 'medium' ? '⚠️' : 'ℹ️';
  return `${icon} **[${alert.severity.toUpperCase()}]** ${alert.message}\n_kind:_ \`${alert.kind}\` · _at:_ ${alert.createdAt}`;
}

module.exports = { formatStatus, formatRoom, formatUsage, formatAlert };
