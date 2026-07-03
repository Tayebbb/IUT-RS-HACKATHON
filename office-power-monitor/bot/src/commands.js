'use strict';

const apiClient = require('./apiClient');
const formatters = require('./formatters');
const { polish } = require('./llm');

/**
 * @typedef {Object} CommandContext
 * @property {string[]} args
 */

/**
 * @typedef {Object} Command
 * @property {string} name
 * @property {string} description
 * @property {string} usage
 * @property {(ctx: CommandContext) => Promise<string>} run
 */

/** @type {Command[]} */
const commands = [
  {
    name: 'status',
    description: 'Show overall office power status.',
    usage: '!status',
    async run() {
      const [rooms, usage, alerts] = await Promise.all([
        apiClient.getRooms(),
        apiClient.getUsage(),
        apiClient.getAlerts()
      ]);
      const fallback = formatters.formatStatus({
        rooms: rooms.rooms,
        usage: usage.usage,
        alerts: alerts.alerts
      });
      return polish(fallback, 'office status summary');
    }
  },
  {
    name: 'room',
    description: 'Show status of a specific room. Accepts id or name.',
    usage: '!room <room-id-or-name>',
    async run({ args }) {
      if (args.length === 0) {
        return 'Usage: `!room <room-id-or-name>` (try `!status` to list rooms).';
      }
      const query = args.join(' ').trim().toLowerCase();
      const roomsRes = await apiClient.getRooms();
      const match = roomsRes.rooms.find(
        (r) => r.id.toLowerCase() === query || r.name.toLowerCase() === query
      );
      if (!match) {return `Room \`${query}\` not found.`;}
      const fallback = formatters.formatRoom(match);
      return polish(fallback, `room detail for ${match.name}`);
    }
  },
  {
    name: 'usage',
    description: 'Show power draw and today energy consumption.',
    usage: '!usage',
    async run() {
      const usage = await apiClient.getUsage();
      const fallback = formatters.formatUsage(usage.usage);
      return polish(fallback, 'power usage report');
    }
  },
  {
    name: 'alerts',
    description: 'Show active system alerts.',
    usage: '!alerts',
    async run() {
      const res = await apiClient.getAlerts();
      if (!res.alerts || res.alerts.length === 0) {
        const fallback = 'There are currently no active alerts. Everything is running smoothly! 🎉';
        return polish(fallback, 'no active alerts');
      }
      const lines = ['**Active Alerts**'];
      for (const a of res.alerts) {
        lines.push(formatters.formatAlert(a));
      }
      const fallback = lines.join('\n');
      return polish(fallback, 'active alerts summary');
    }
  },
  {
    name: 'help',
    description: 'List available commands.',
    usage: '!help',
    async run() {
      const lines = ['**Office Power Monitor — commands**'];
      for (const cmd of commands) {
        lines.push(`\`${cmd.usage}\` — ${cmd.description}`);
      }
      return lines.join('\n');
    }
  }
];

/**
 * @param {string} name
 * @returns {Command|undefined}
 */
function findCommand(name) {
  const n = name.toLowerCase();
  return commands.find((c) => c.name === n);
}

module.exports = { commands, findCommand };
