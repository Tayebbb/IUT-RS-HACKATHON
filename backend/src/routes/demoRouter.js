'use strict';

const { Router } = require('express');
const { success } = require('../utils/apiResponse');

/**
 * @param {Object} deps
 * @param {import('../services/DemoService').DemoService} deps.demoService
 */
function createDemoRouter({ demoService }) {
  const router = Router();

  /**
   * @swagger
   * /api/demo/{scenario}:
   *   post:
   *     summary: Trigger a demo scenario
   *     tags: [Demo]
   *     parameters:
   *       - in: path
   *         name: scenario
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Scenario triggered
   */
  router.post('/:scenario', (req, res, next) => {
    try {
      const result = demoService.triggerScenario(req.params.scenario);
      success(res, result);
    } catch (err) {
      if (err.message.startsWith('Unknown scenario')) {
        res.status(400);
      }
      next(err);
    }
  });

  return router;
}

module.exports = { createDemoRouter };
