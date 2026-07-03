'use strict';

const { createDevicesRouter } = require('./devicesRouter');
const { createRoomsRouter } = require('./roomsRouter');
const { createUsageRouter } = require('./usageRouter');
const { createAlertsRouter } = require('./alertsRouter');
const { createIncidentsRouter } = require('./incidentsRouter');
const { createDemoRouter } = require('./demoRouter');

const requestLogger = require('../middleware/requestLogger');
const errorHandler = require('../middleware/errorHandler');

/**
 * Mount all feature routers under /api on the given app.
 *
 * @param {import('express').Express} app
 * @param {Object} deps
 * @param {import('../services/DeviceService').DeviceService} deps.deviceService
 * @param {import('../services/roomService').RoomService} deps.roomService
 * @param {import('../services/usageService').UsageService} deps.usageService
 * @param {import('../services/AlertService').AlertService} deps.alertService
 * @param {import('../services/IncidentService').IncidentService} deps.incidentService
 */
function registerRoutes(app, deps) {
  // Global API Middleware
  app.use('/api', requestLogger);

  // Mount domain routers
  app.use('/api/devices', createDevicesRouter(deps));
  app.use('/api/rooms', createRoomsRouter(deps));
  app.use('/api/usage', createUsageRouter(deps));
  app.use('/api/alerts', createAlertsRouter(deps));
  app.use('/api/incidents', createIncidentsRouter(deps));
  app.use('/api/demo', createDemoRouter(deps));

  // 404 for unknown /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: { message: 'Route not found', code: 'not_found' } });
  });

  // Global Error Handler
  app.use(errorHandler);
}

module.exports = { registerRoutes };
