'use strict';

const { io: ioClient } = require('socket.io-client');
const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const { formatAlert } = require('./formatters');

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
  const knownAlertIds = new Set();
  let bootstrapped = false;

  socket.on('connect', () => {
     
    console.log('[alert-relay] connected to backend', config.backendWsUrl);
  });

  socket.on('alerts:update', async (alerts) => {
    if (!Array.isArray(alerts)) {return;}

    if (!bootstrapped) {
      for (const a of alerts) {knownAlertIds.add(a.id);}
      bootstrapped = true;
      return;
    }

    /** @type {any[]} */
    const fresh = [];
    for (const a of alerts) {
      if (a.status === 'active' && !knownAlertIds.has(a.id)) {
        knownAlertIds.add(a.id);
        fresh.push(a);
      }
    }
    if (fresh.length === 0) {return;}

    for (const channelId of config.alertChannelIds) {
      let channel;
      try {
        channel = await discordClient.channels.fetch(channelId);
      } catch (err) {
         
        console.warn(`[alert-relay] channel ${channelId} fetch failed:`, err.message);
        continue;
      }
      if (!channel?.isTextBased?.()) {continue;}
      for (const alert of fresh) {
        try {
          const embed = new EmbedBuilder()
            .setTitle(alert.severity === 'high' ? '🚨 Critical Alert' : alert.severity === 'medium' ? '⚠️ Warning' : 'ℹ️ Notice')
            .setColor(alert.severity === 'high' ? '#ef4444' : alert.severity === 'medium' ? '#f59e0b' : '#38bdf8')
            .setDescription(formatAlert(alert))
            .setTimestamp(new Date(alert.createdAt));
          await channel.send({ embeds: [embed] });
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
