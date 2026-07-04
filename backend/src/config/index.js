'use strict';

require('dotenv').config();

/**
 * @typedef {Object} AppConfig
 * @property {number} port
 * @property {string} host
 * @property {string} corsOrigin
 * @property {number} simulatorTickMs
 * @property {number} minDwellSeconds
 * @property {number} officeHourStart
 * @property {number} officeHourEnd
 * @property {number} roomOnMaxHours
 * @property {string|null} hfApiToken    HuggingFace Inference API token
 * @property {string} hfModel           HuggingFace model ID
 */

/**
 * Parse an integer environment variable with a fallback default.
 * @param {string|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** @type {AppConfig} */
const config = {
  port: toInt(process.env.PORT, 4000),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  simulatorTickMs: toInt(process.env.SIMULATOR_TICK_MS, 5000),
  minDwellSeconds: toInt(process.env.MIN_DWELL_SECONDS, 60),
  officeHourStart: toInt(process.env.OFFICE_HOUR_START, 9),
  officeHourEnd: toInt(process.env.OFFICE_HOUR_END, 17),
  roomOnMaxHours: toInt(process.env.ROOM_ON_MAX_HOURS, 2),
  tariffBdtPerKwh: Number(process.env.TARIFF_BDT_PER_KWH || 7.0),
  hfApiToken: process.env.HF_API_TOKEN || null,
  hfModel: process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2'
};

module.exports = config;
