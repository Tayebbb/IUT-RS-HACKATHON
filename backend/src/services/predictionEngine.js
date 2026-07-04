'use strict';

const config = require('../config');
const { isOfficeHours } = require('../simulator/officeHours');

/**
 * AI Prediction Engine
 * Implements Virtual Occupancy Sensing via Logistic Regression
 * and Cost-Savings Extrapolation.
 */
class PredictionEngine {
  constructor({ now = Date.now } = {}) {
    this._now = now;
    
    // Logistic Regression weights (pre-calibrated heuristic)
    this._weights = {
      bias: -2.0,
      fanOn: 1.5,
      lightOn: 1.0,
      minutesSinceChange: -0.05,
      officeHours: 2.0
    };
  }

  /**
   * Sigmoid activation function
   * @private
   */
  _sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Predict the probability that a room is occupied.
   * @param {Object} room
   * @returns {number} Probability 0.0 to 1.0
   */
  predictOccupancy(room) {
    const nowMs = this._now();
    const officeHoursActive = isOfficeHours(nowMs) ? 1.0 : 0.0;
    
    let fanOnCount = 0;
    let lightOnCount = 0;
    
    // Find how long it's been since the most recently changed device in this room
    let mostRecentChangeMs = 0;

    room.devices.forEach(d => {
      if (d.status === 'on') {
        if (d.type === 'fan') {fanOnCount++;}
        if (d.type === 'light') {lightOnCount++;}
      }
      
      const changedMs = new Date(d.lastChanged).getTime();
      if (changedMs > mostRecentChangeMs) {
        mostRecentChangeMs = changedMs;
      }
    });

    // If no devices exist or ever changed, default to empty
    if (mostRecentChangeMs === 0) {return 0.0;}

    const minutesSinceChange = (nowMs - mostRecentChangeMs) / 60000;

    const z = this._weights.bias
      + (fanOnCount * this._weights.fanOn)
      + (lightOnCount * this._weights.lightOn)
      + (minutesSinceChange * this._weights.minutesSinceChange)
      + (officeHoursActive * this._weights.officeHours);

    return this._sigmoid(z);
  }

  /**
   * Predict potential savings (in BDT) if all devices in this room were turned off right now.
   * Savings are extrapolated until the end of the office day (e.g., 5 PM).
   * @param {Object} room
   * @returns {number} Savings in BDT (rounded to 2 decimals)
   */
  predictPotentialSavings(room) {
    // Total watts currently consumed by the room
    const currentPowerW = room.devices
      .filter(d => d.status === 'on')
      .reduce((sum, d) => sum + (d.wattage || 0), 0);
      
    if (currentPowerW === 0) {return 0.0;}

    const now = new Date(this._now());
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const endHour = config.officeHourEnd || 17;

    // If we are past the end of the office day, savings calculation applies to the next full day,
    // or just say 0 for the remainder of today. We'll extrapolate for the next 1 hour minimum
    // to always show some actionable savings outside of hours.
    let hoursRemaining = endHour - currentHour;
    if (hoursRemaining < 1) {
      hoursRemaining = 1; // Minimum 1 hour projection to show immediate waste
    }

    const currentPowerKw = currentPowerW / 1000;
    const tariff = config.tariffBdtPerKwh || 7.0;

    const savings = currentPowerKw * hoursRemaining * tariff;
    return Number(savings.toFixed(2));
  }

  /**
   * Get full prediction payload for a room.
   * @param {Object} room
   */
  getRoomPredictions(room) {
    const probability = this.predictOccupancy(room);
    const isOccupied = probability >= 0.5;
    const savings = this.predictPotentialSavings(room);

    return {
      occupancyProbability: probability,
      predictedState: isOccupied ? 'occupied' : 'unoccupied',
      potentialSavingsBdt: isOccupied ? 0 : savings // Only suggest savings if unoccupied
    };
  }
}

module.exports = { PredictionEngine };
