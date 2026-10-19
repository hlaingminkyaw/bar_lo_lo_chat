import { config } from './config.js';
import { HttpError } from './http.js';

/**
 * Universal chat completion client supporting multiple AI providers
 * (OpenRouter, Google Gemini, OpenAI, Groq, Ollama, or custom endpoints).
 *
 * @param {{ role: string, content: string | object[] }[]} messages
 * @param {{ model?: string, temperature?: number, maxTokens?: number }} [opts]
 * @returns {Promise<{ answer: string, model: string, usage?: object }>}
 */
export async function chatCompletion(
  messages,
  { model = config.llmModel, temperature = 0.2, maxTokens = config.maxTokens } = {},
) {
  const isFree = Boolean(model?.endsWith(':free'));
  const isFreeOpenRouter = isFree && config.aiProvider === 'openrouter';

  const candidates = isFreeOpenRouter
    ? [model, ...config.openrouterFreeFallbacks.filter((m) => m !== model)]
    : [model];

  let lastError;
  for (const candidate of candidates) {
    try {
      return await executeChatCompletion(messages, { model: candidate, temperature, maxTokens });
    } catch (err) {
      lastError = err;
      if (isFreeOpenRouter) {
        console.warn(`Free model "${candidate}" failed (${err.message}); trying next free fallback...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function executeChatCompletion(messages, { model, temperature, maxTokens }) {
  const apiKey = config.aiApiKey;
  const baseUrl = config.aiBaseUrl;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // OpenRouter attribution headers
  if (config.aiProvider === 'openrouter') {
    headers['X-Title'] = config.appName;
    if (config.siteUrl) headers['HTTP-Referer'] = config.siteUrl;
  }

  const endpoint = `${baseUrl}/chat/completions`;
  const res = await fetch(endpoint, {
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
    const status = res.status === 429 ? 429 : res.status >= 500 ? res.status : 502;
    const errorMsg = body?.error?.message || body?.message || res.statusText || 'unknown error';
    throw new HttpError(status, `${config.aiProvider.toUpperCase()} request failed (${res.status}): ${errorMsg}`);
  }

  const choice = body.choices?.[0] ?? {};
  const message = choice.message ?? {};
  if (choice.finish_reason === 'length') {
    console.warn(`${config.aiProvider.toUpperCase()} answer hit max_tokens (${maxTokens}) and was truncated; raise MAX_TOKENS.`);
  }

  const rawText = message.content ?? message.reasoning ?? message.reasoning_content ?? '';
  let cleaned = clean(rawText);
  if (!cleaned && rawText) {
    cleaned = String(rawText).trim();
  }

  return {
    answer: cleaned,
    model: body.model || model,
    usage: body.usage,
  };
}

// Some free reasoning models inline their chain of thought; strip it.
function clean(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^Here's a thinking process:[\s\S]*?(?=(\n\*{1,3}\s|\n#{1,4}\s|\n[A-Z0-9\u1000-\u109F]))/i, '')
    .trim();
}
