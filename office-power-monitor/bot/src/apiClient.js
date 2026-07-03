'use strict';

const config = require('./config');

/**
 * Thin fetch wrapper around the backend REST API. Uses global `fetch`
 * (Node 18+). Never hardcodes response bodies — always live data.
 */

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
async function get(path) {
  const url = `${config.backendHttpUrl}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  
  if (!res.ok) {
    throw new Error(`Backend ${path} failed: ${res.status} ${res.statusText}`);
  }
  
  const body = await res.json();
  if (body && body.success === false) {
    throw new Error(`Backend API Error: ${body.error?.message}`);
  }
  
  // Unwrap the standardized API response structure
  return body.data;
}

const apiClient = {
  /** @returns {Promise<{devices: any[]}>} */
  getDevices: async () => ({ devices: await get('/api/devices') }),
  
  /** @returns {Promise<{rooms: any[]}>} */
  getRooms: async () => ({ rooms: await get('/api/rooms') }),
  
  /** @param {string} id */
  getRoom: async (id) => ({ room: await get(`/api/rooms/${encodeURIComponent(id)}`) }),
  
  /** @returns {Promise<{usage: any}>} */
  getUsage: async () => ({ usage: await get('/api/usage') }),
  
  /** @returns {Promise<{alerts: any[]}>} */
  getAlerts: async () => ({ alerts: await get('/api/alerts?status=active') }),
  
  /** @returns {Promise<{incidents: any[]}>} */
  getIncidents: async () => ({ incidents: await get('/api/incidents?status=active') })
};

module.exports = apiClient;
