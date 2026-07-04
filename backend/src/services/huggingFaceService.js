'use strict';

const logger = require('../utils/logger');

/**
 * HuggingFaceService — calls the HuggingFace Inference API to generate
 * natural-language AI insights for power anomaly alerts.
 *
 * Uses the OpenAI-compatible `/v1/chat/completions` endpoint so no extra
 * SDK is needed — plain Node 18 `fetch` works.
 *
 * Insights are cached per alert signature so the LLM is only called once
 * per unique open anomaly. If no token is configured, all calls return null
 * gracefully (the UI simply skips the AI section).
 */
class HuggingFaceService {
  /**
   * @param {Object} opts
   * @param {string|null} opts.apiToken    HF_API_TOKEN env var
   * @param {string}      opts.model       e.g. 'mistralai/Mistral-7B-Instruct-v0.2'
   * @param {number}      [opts.timeoutMs] Request timeout in ms (default 35s)
   */
  constructor({ apiToken, model, timeoutMs = 35_000 }) {
    this._token = apiToken || null;
    this._model = model || 'meta-llama/Meta-Llama-3-8B-Instruct';
    this._timeoutMs = timeoutMs;
    /** @type {Map<string, string>} signature → cached insight text */
    this._cache = new Map();
    this._baseUrl = 'https://router.huggingface.co';
  }

  /**
   * Generate an AI insight for an anomaly alert.
   * Returns cached result on repeat calls for the same signature.
   *
   * @param {Object} ctx
   * @param {string}   ctx.signature      Alert signature for cache keying
   * @param {string}   ctx.roomName       Human-readable room name
   * @param {number}   ctx.currentW       Current detected wattage
   * @param {number}   ctx.baselineW      Rolling baseline mean
   * @param {number}   ctx.deviationPct   % above baseline (e.g. 279)
   * @param {string[]} ctx.activeDevices  Labels of active devices in the room
   * @param {boolean}  ctx.isOfficeHours  Whether it's within 9AM-5PM
   * @param {number}   ctx.energyCostBdt  Total energy cost today in BDT
   * @param {number}   ctx.tariff         BDT per kWh
   * @returns {Promise<string|null>}
   */
  async generateInsight(ctx) {
    if (!this._token) {
      return null;
    }

    // Return cached result to avoid hammering the API
    if (this._cache.has(ctx.signature)) {
      return this._cache.get(ctx.signature);
    }

    const prompt = this._buildPrompt(ctx);

    try {
      const insight = await this._callApi(prompt);
      if (insight) {
        this._cache.set(ctx.signature, insight);
        // Evict oldest entries if cache grows too large
        if (this._cache.size > 50) {
          this._cache.delete(this._cache.keys().next().value);
        }
      }
      return insight;
    } catch (err) {
      logger.warn('[HuggingFace] Insight generation failed', { error: err.message });
      return null;
    }
  }

  /**
   * Invalidate the cached insight for a given signature (e.g. when alert resolves).
   * @param {string} signature
   */
  invalidate(signature) {
    this._cache.delete(signature);
  }

  /** @private */
  _buildPrompt(ctx) {
    const timeContext = ctx.isOfficeHours
      ? 'during office hours (9 AM – 5 PM)'
      : 'OUTSIDE office hours — the office should be empty';

    const savingsPerHour = ((ctx.currentW - ctx.baselineW) / 1000) * ctx.tariff;

    const deviceList = ctx.activeDevices.length > 0
      ? ctx.activeDevices.join(', ')
      : 'no devices reported';

    return `You are an AI energy analyst for a smart office power monitoring system in Bangladesh.

Office layout: 3 rooms (Drawing Room, Work Room 1, Work Room 2), each with 3 fans (60W each) and 3 lights (15W each). Max room draw: 225W.

ANOMALY DETECTED:
- Room: ${ctx.roomName}
- Current power draw: ${Math.round(ctx.currentW)}W
- Rolling baseline: ~${Math.round(ctx.baselineW)}W  
- Deviation: +${Math.round(ctx.deviationPct)}% above baseline
- Active devices: ${deviceList}
- Time context: ${timeContext}
- Today's total energy cost so far: ${ctx.energyCostBdt} BDT
- Electricity tariff: ${ctx.tariff} BDT/kWh
- Excess cost rate: ~${savingsPerHour.toFixed(2)} BDT/hour above normal

Write a concise 2-3 sentence AI insight that:
1. Diagnoses the likely cause of this spike
2. Recommends the single most impactful action
3. Quantifies the BDT savings if that action is taken immediately

Maintain a strictly professional, formal, and objective tone. Under no circumstances should you use emojis or casual language. Do not repeat the raw numbers unnecessarily. Maximum 60 words.`;
  }

  /** @private */
  async _callApi(prompt) {
    // Use HuggingFace router (OpenAI-compatible) — same base as the Discord bot
    const url = `${this._baseUrl}/v1/chat/completions`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this._token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this._model,
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 120,
          temperature: 0.4,
          stream: false
        })
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HF API ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      return text || null;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { HuggingFaceService };
