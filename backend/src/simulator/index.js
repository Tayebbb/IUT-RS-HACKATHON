'use strict';

/**
 * Simulator module barrel.
 *
 * Exports:
 *  - Simulator          — class that drives periodic device state transitions.
 *  - isOfficeHours      — pure helper: is the given timestamp within 9AM-5PM?
 *  - transitionProbability — pure helper: per-tick flip probability based on
 *                            current device status and office-hour context.
 *
 * Usage (server.js wires this up):
 *   const { Simulator } = require('./simulator');
 *   const simulator = new Simulator({ deviceStore });
 *   simulator.start();
 */

const { Simulator } = require('./simulator');
const { isOfficeHours, transitionProbability } = require('./officeHours');

module.exports = { Simulator, isOfficeHours, transitionProbability };
