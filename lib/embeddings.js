import { config } from './config.js';
import { getPinecone } from './pinecone.js';
import { HttpError } from './http.js';

// Pinecone's hosted models accept at most 96 inputs per request.
const PINECONE_BATCH = 96;
const API_BATCH = 100;

// Free tiers cap embedding throughput (Pinecone: 250k tokens/min), so large
// ingests get 429s. The default budget keeps API handlers inside Vercel's 60s
// limit; the CLI ingest passes a larger one to wait out the per-minute window.
const DEFAULT_RETRY_BUDGET_MS = 15_000;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Embed a list of texts.
 * @param {string[]} texts
 * @param {'passage' | 'query'} inputType  documents vs. search queries; asymmetric
 *   models like llama-text-embed-v2 embed these differently.
 * @param {{ retryBudgetMs?: number }} [opts]  total time to spend waiting out rate limits.
 * @returns {Promise<number[][]>}
 */
export async function embed(texts, inputType, { retryBudgetMs = DEFAULT_RETRY_BUDGET_MS } = {}) {
  const provider = config.embeddingProvider;
  let call;
  if (provider === 'pinecone') call = [PINECONE_BATCH, (b) => embedPinecone(b, inputType)];
  else if (provider === 'openrouter') call = [API_BATCH, (b) => embedHttp(b, 'https://openrouter.ai/api/v1/embeddings', config.openrouterApiKey)];
  else if (provider === 'openai') call = [API_BATCH, (b) => embedHttp(b, 'https://api.openai.com/v1/embeddings', config.aiApiKey)];
  else throw new Error(`Unknown EMBEDDING_PROVIDER "${provider}" (use "pinecone", "openrouter", or "openai")`);

  const [size, fn] = call;
  const retry = { budgetMs: retryBudgetMs, waitedMs: 0 };
  return batched(texts, size, (b) => withRateLimitRetry(() => fn(b), retry));
}

/**
 * Run `fn`, retrying on HTTP 429 with exponential backoff (or the server's
 * Retry-After) until `state.budgetMs` of total waiting is used up.
 * Any other error is rethrown immediately.
 */
export async function withRateLimitRetry(fn, state, { baseDelayMs = BASE_RETRY_DELAY_MS } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err)) throw err;
      const delay = Math.min(err.retryAfterMs ?? baseDelayMs * 2 ** attempt, MAX_RETRY_DELAY_MS);
      if (state.waitedMs + delay > state.budgetMs) throw err;
      console.warn(`Embedding rate limit hit; retrying in ${Math.ceil(delay / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      state.waitedMs += delay;
    }
  }
}

// The Pinecone SDK has no status field for 429; it only appears in the message.
function isRateLimited(err) {
  return err?.status === 429 || /\bStatus: 429\b/.test(err?.message ?? '');
}

export async function embedOne(text, inputType) {
  const [vector] = await embed([text], inputType);
  return vector;
}

async function batched(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await fn(items.slice(i, i + size))));
  }
  return out;
}

async function embedPinecone(texts, inputType) {
  const result = await getPinecone().inference.embed({
    model: config.embeddingModel,
    inputs: texts,
    parameters: { inputType, truncate: 'END' },
  });
  return result.data.map((item) => {
    if (item.vectorType !== 'dense') throw new Error('Expected a dense embedding model');
    return item.values;
  });
}

async function embedHttp(texts, url, apiKey) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.embeddingModel, input: texts }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new HttpError(res.status === 429 ? 429 : 502, `Embeddings failed (${res.status}): ${body?.error?.message ?? 'unknown error'}`);
    const retryAfter = Number(res.headers.get('retry-after'));
    if (retryAfter > 0) err.retryAfterMs = retryAfter * 1000;
    throw err;
  }
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
