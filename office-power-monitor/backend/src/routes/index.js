'use strict';

const { createDevicesRouter } = require('./devicesRouter');
const { createRoomsRouter } = require('./roomsRouter');
const { createUsageRouter } = require('./usageRouter');
const { createAlertsRouter } = require('./alertsRouter');
const { createIncidentsRouter } = require('./incidentsRouter');

/**
 * Mount all feature routers under /api on the given app.
 *
 * @param {import('express').Express} app
 * @param {Object} deps
 * @param {import('../store/deviceStore').DeviceStore} deps.deviceStore
 * @param {import('../store/energyStore').EnergyStore} deps.energyStore
 * @param {import('../alerts/alertStore').AlertStore} deps.alertStore
 * @param {import('../incidents/incidentAggregator').IncidentAggregator} deps.incidentAggregator
 */
function registerRoutes(app, deps) {
  app.use('/api/devices', createDevicesRouter(deps));
  app.use('/api/rooms', createRoomsRouter(deps));
  app.use('/api/usage', createUsageRouter(deps));
  app.use('/api/alerts', createAlertsRouter(deps));
  app.use('/api/incidents', createIncidentsRouter(deps));

  // 404 for unknown /api routes.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // JSON error handler.
  app.use((err, _req, res, _next) => {
     
    console.error('[api-error]', err);
    res.status(500).json({ error: 'internal_error' });
  });
}

module.exports = { registerRoutes };
