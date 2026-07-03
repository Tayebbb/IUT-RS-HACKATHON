'use strict';

const config = require('./config');

/**
 * Optional OpenAI polishing. If the API key is missing OR the call fails
 * for any reason, we return the fallback text unchanged. Callers must
 * always be able to depend on getting *some* string back.
 */

const SYSTEM_PROMPT =
  'You are a concise office facilities assistant. Rewrite the given ' +
  'monitoring report in a friendlier tone for a Discord chat. Keep ALL ' +
  'numbers, device names, and factual details EXACTLY as provided. Do ' +
  'not invent data. Preserve line breaks and Discord markdown. Reply ' +
  'with the rewritten message only.';

/**
 * @param {string} fallbackText  The template output; also the ground truth.
 * @param {string} [userIntent]  Short label for the intent (e.g. "status").
 * @returns {Promise<string>}
 */
async function polish(fallbackText, userIntent = 'report') {
  if (!config.openAiApiKey) {
    return fallbackText;
  }

  try {
    const res = await fetch(`${config.openAiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body: JSON.stringify({
        model: config.openAiModel,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Intent: ${userIntent}\n\nReport:\n${fallbackText}`
          }
        ]
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : fallbackText;
  } catch (err) {
    console.warn('[llm] polish failed, using fallback:', err.message);
    return fallbackText;
  }
}

module.exports = { polish };
