'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');

/**
 * Create and configure the Express application.
 * Feature routers are wired in `src/server.js` once their dependencies are ready.
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return app;
}

module.exports = { createApp };
