'use strict';

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const { createApp } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const { deviceStore, energyStore, roomSampleBuffer } = require('./store');
const { alertStore, AlertEngine } = require('./alerts');
const { IncidentAggregator } = require('./incidents');
const { Simulator } = require('./simulator');
const { registerRoutes } = require('./routes');
const { SocketBroadcaster } = require('./sockets');
const { HuggingFaceService } = require('./services/huggingFaceService');
const { PredictionEngine } = require('./services/predictionEngine');
const { EcoModeEngine } = require('./services/ecoModeEngine');
const {
  DeviceService,
  RoomService,
  UsageService,
  AlertService,
  IncidentService,
  DemoService
} = require('./services');

/**
 * Compose the whole backend: stores → engines → routes → sockets → simulator.
 * Subscribers are always started BEFORE the simulator so no events are missed.
 */
function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] }
  });

  const hfService = new HuggingFaceService({
    apiToken: config.hfApiToken,
    model: config.hfModel
  });
  
  const predictionEngine = new PredictionEngine();

  const alertEngine = new AlertEngine({ deviceStore, alertStore, roomSampleBuffer, hfService });
  const incidentAggregator = new IncidentAggregator({ alertStore });
  const broadcaster = new SocketBroadcaster({
    io,
    deviceStore,
    energyStore,
    alertStore,
    incidentAggregator,
    roomSampleBuffer,
    predictionEngine
  });
  const simulator = new Simulator({ deviceStore });

  const deviceService = new DeviceService({ deviceStore });
  const roomService = new RoomService({ deviceStore, roomSampleBuffer });
  const usageService = new UsageService({ deviceStore, energyStore });
  const alertService = new AlertService({ alertStore });
  const incidentService = new IncidentService({ incidentAggregator });
  const demoService = new DemoService({ deviceStore, simulator, energyStore });

  registerRoutes(app, {
    deviceStore,
    energyStore,
    alertStore,
    incidentAggregator,
    deviceService,
    roomService,
    usageService,
    alertService,
    incidentService,
    demoService,
    predictionEngine
  });

  const ecoModeEngine = new EcoModeEngine({ predictionEngine, deviceService, roomService });
  // Forward Eco-Mode auto-shutdown events to all connected socket clients
  ecoModeEngine.on('eco:action', (payload) => {
    io.emit('eco:action', payload);
  });

  incidentAggregator.start();
  broadcaster.start();
  alertEngine.start();
  ecoModeEngine.start();
  simulator.start();

  server.listen(config.port, config.host, () => {
    logger.info('Backend listening', { host: config.host, port: config.port });
  });

  const shutdown = (signal) => {
    logger.warn('Shutting down', { signal });
    simulator.stop();
    alertEngine.stop();
    ecoModeEngine.stop();
    incidentAggregator.stop();
    broadcaster.stop();
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
