'use strict';

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const { createApp } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const { deviceStore, energyStore } = require('./store');
const { alertStore, AlertEngine } = require('./alerts');
const { IncidentAggregator } = require('./incidents');
const { Simulator } = require('./simulator');
const { registerRoutes } = require('./routes');
const { SocketBroadcaster } = require('./sockets');
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

  const alertEngine = new AlertEngine({ deviceStore, alertStore });
  const incidentAggregator = new IncidentAggregator({ alertStore });
  const broadcaster = new SocketBroadcaster({
    io,
    deviceStore,
    energyStore,
    alertStore,
    incidentAggregator
  });
  const simulator = new Simulator({ deviceStore });

  const deviceService = new DeviceService({ deviceStore });
  const roomService = new RoomService({ deviceStore });
  const usageService = new UsageService({ deviceStore, energyStore });
  const alertService = new AlertService({ alertStore });
  const incidentService = new IncidentService({ incidentAggregator });
  const demoService = new DemoService({ deviceStore, simulator });

  registerRoutes(app, {
    deviceService,
    roomService,
    usageService,
    alertService,
    incidentService,
    demoService
  });

  incidentAggregator.start();
  alertEngine.start();
  broadcaster.start();
  simulator.start();

  server.listen(config.port, config.host, () => {
    logger.info('Backend listening', { host: config.host, port: config.port });
  });

  const shutdown = (signal) => {
    logger.warn('Shutting down', { signal });
    simulator.stop();
    alertEngine.stop();
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
