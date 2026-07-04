'use strict';

const { io: ioClient } = require('socket.io-client');
const config = require('./config');
const { formatIncident } = require('./formatters');
const { polish } = require('./llm');

/**
 * AlertRelay listens on the backend Socket.IO stream and posts *newly
 * opened* alerts to configured Discord channels. Alerts already present
 * on connect are ignored (so restarts don't spam history).
 *
 * @param {import('discord.js').Client} discordClient
 */
function startAlertRelay(discordClient) {
  if (config.alertChannelIds.length === 0) {
    console.log('[alert-relay] ALERT_CHANNEL_IDS empty — realtime relay disabled.');
    return { stop: () => {} };
  }

  const socket = ioClient(config.backendWsUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true
  });

  /** @type {Set<string>} */
  const knownIncidentIds = new Set();
  let bootstrapped = false;

  socket.on('connect', () => {
    console.log('[alert-relay] connected to backend', config.backendWsUrl);
  });

  socket.on('incidents:update', async (incidents) => {
    if (!Array.isArray(incidents)) {
      return;
    }

    if (!bootstrapped) {
      for (const inc of incidents) {
        knownIncidentIds.add(inc.id);
      }
      bootstrapped = true;
      return;
    }

    /** @type {any[]} */
    const fresh = [];
    for (const inc of incidents) {
      if (inc.status === 'active' && !knownIncidentIds.has(inc.id)) {
        knownIncidentIds.add(inc.id);
        fresh.push(inc);
      }
    }
    if (fresh.length === 0) {
      return;
    }

    for (const channelId of config.alertChannelIds) {
      let channel;
      try {
        channel = await discordClient.channels.fetch(channelId);
      } catch (err) {
        console.warn(`[alert-relay] channel ${channelId} fetch failed:`, err.message);
        continue;
      }
      if (!channel?.isTextBased?.()) {
        continue;
      }
      for (const incident of fresh) {
        try {
          const rawMessage = formatIncident(incident);
          const polishedMessage = await polish(rawMessage, 'urgent automated alert');
          await channel.send(polishedMessage);
        } catch (err) {
          console.warn('[alert-relay] send failed:', err.message);
        }
      }
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn('[alert-relay] disconnected:', reason);
  });

  return {
    stop() {
      socket.close();
    }
  };
}

module.exports = { startAlertRelay };
