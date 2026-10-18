import { config } from './config.js';
import { HttpError } from './http.js';

/**
 * Call OpenRouter's OpenAI-compatible chat completions endpoint.
 * @param {{ role: string, content: string }[]} messages
 * @returns {Promise<{ answer: string, model: string, usage?: object }>}
 */
export async function chatCompletion(messages, { model = config.openrouterModel, temperature = 0.2, maxTokens = config.maxTokens } = {}) {
  const headers = {
    Authorization: `Bearer ${config.openrouterApiKey}`,
    'Content-Type': 'application/json',
    // Optional attribution headers; they show your app on openrouter.ai.
    'X-Title': config.appName,
  };
  if (config.siteUrl) headers['HTTP-Referer'] = config.siteUrl;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(50_000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const status = res.status === 429 ? 429 : 502;
    throw new HttpError(status, `OpenRouter request failed (${res.status}): ${body?.error?.message ?? 'unknown error'}`);
  }

  const choice = body.choices?.[0] ?? {};
  const message = choice.message ?? {};
  if (choice.finish_reason === 'length') {
    console.warn(`OpenRouter answer hit max_tokens (${maxTokens}) and was truncated; raise MAX_TOKENS.`);
  }
  return {
    answer: clean(message.content || ''),
    model: body.model,
    usage: body.usage,
  };
}

// Some free reasoning models inline their chain of thought; strip it.
function clean(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}
