'use strict';

require('dotenv').config();

/**
 * @typedef {Object} BotConfig
 * @property {string} discordToken
 * @property {string} commandPrefix
 * @property {string[]} alertChannelIds
 * @property {string} backendHttpUrl
 * @property {string} backendWsUrl
 * @property {string|null} openAiApiKey
 * @property {string} openAiModel
 * @property {string} openAiBaseUrl
 */

/** @type {BotConfig} */
const config = {
  discordToken: process.env.DISCORD_TOKEN || '',
  commandPrefix: process.env.COMMAND_PREFIX || '!',
  alertChannelIds: (process.env.ALERT_CHANNEL_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  backendHttpUrl: process.env.BACKEND_HTTP_URL || 'http://localhost:4000',
  backendWsUrl: process.env.BACKEND_WS_URL || 'http://localhost:4000',
  openAiApiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY : null,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openAiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
};

module.exports = config;
