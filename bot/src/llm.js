'use strict';

const config = require('./config');
const apiClient = require('./apiClient');

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
      signal: AbortSignal.timeout(5000),
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
    console.warn('[llm] Error details:', err);
    return fallbackText;
  }
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'getUsage',
      description: 'Get live power usage metrics and total energy consumption summary.'
    }
  },
  {
    type: 'function',
    function: {
      name: 'getRooms',
      description: 'Get a list of all rooms with their name, status, total devices, how many devices are ON/OFF, and their total power consumption.'
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAlerts',
      description: 'Get a list of active system alerts.'
    }
  },
  {
    type: 'function',
    function: {
      name: 'getIncidents',
      description: 'Get a list of active aggregated incidents.'
    }
  }
];

const toolHandlers = {
  getUsage: () => apiClient.getUsage(),
  getRooms: () => apiClient.getRooms(),
  getAlerts: () => apiClient.getAlerts(),
  getIncidents: () => apiClient.getIncidents()
};

/**
 * Ask a free-form question using tool-calling.
 * @param {string} question
 * @returns {Promise<string>}
 */
async function askQuestion(question) {
  if (!config.openAiApiKey) {
    return 'Sorry, I need an OpenAI API key configured to answer free-form questions. Try using !status or !usage instead.';
  }

  const messages = [
    {
      role: 'system',
      content:
        'You are an office energy monitor bot. Answer questions about the office power usage, devices, alerts, or incidents using the provided tools. ' +
        'Strictly bound your scope: ONLY answer questions related to the office power, device, alert, or incident state. ' +
        'If the user asks about unrelated topics (like weather, sports, generic knowledge, code), politely decline and redirect them to try !status, !usage, or !room. ' +
        'If the user asks to modify states (like "turn off lights", "toggle fan"), explain that you operate in a read-only context and cannot perform state mutations.'
    },
    { role: 'user', content: question }
  ];

  let iterations = 0;
  const maxIterations = 2;

  while (iterations < maxIterations) {
    try {
      const res = await fetch(`${config.openAiBaseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000), // 8 seconds timeout per completion call
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openAiApiKey}`
        },
        body: JSON.stringify({
          model: config.openAiModel,
          temperature: 0.2,
          messages,
          tools
        })
      });

      if (!res.ok) {
        throw new Error(`OpenAI HTTP ${res.status}`);
      }

      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      if (!message) {
        break;
      }

      messages.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return message.content || 'No response received.';
      }

      for (const toolCall of message.tool_calls) {
        const handler = toolHandlers[toolCall.function.name];
        let result;
        if (handler) {
          try {
            result = await handler();
          } catch (err) {
            result = { error: `Failed to fetch data: ${err.message}` };
          }
        } else {
          result = { error: 'Unknown tool requested.' };
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(result)
        });
      }

      iterations++;
    } catch (err) {
      console.warn('[llm] askQuestion failed:', err.message);
      return 'Sorry, I encountered an issue while communicating with the AI. Try using !status or !usage instead.';
    }
  }

  // If we exceeded loop cap, ask model to summarize based on currently collected messages
  try {
    const res = await fetch(`${config.openAiBaseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body: JSON.stringify({
        model: config.openAiModel,
        temperature: 0.2,
        messages: [
          ...messages,
          { role: 'user', content: 'Provide a final summary using the data retrieved so far.' }
        ]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'No response received.';
  } catch (err) {
    console.warn('[llm] askQuestion final summary fallback failed:', err.message);
    return 'Sorry, I encountered an issue while communicating with the AI. Try using !status or !usage instead.';
  }
}

module.exports = { polish, askQuestion };
