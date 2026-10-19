import { config } from './config.js';
import { getPinecone } from './pinecone.js';
import { HttpError } from './http.js';

// Pinecone's hosted models accept at most 96 inputs per request.
const PINECONE_BATCH = 96;
const API_BATCH = 100;

/**
 * Embed a list of texts.
 * @param {string[]} texts
 * @param {'passage' | 'query'} inputType  documents vs. search queries; asymmetric
 *   models like llama-text-embed-v2 embed these differently.
 * @returns {Promise<number[][]>}
 */
export async function embed(texts, inputType) {
  const provider = config.embeddingProvider;
  if (provider === 'pinecone') return batched(texts, PINECONE_BATCH, (b) => embedPinecone(b, inputType));
  if (provider === 'openrouter') return batched(texts, API_BATCH, (b) => embedHttp(b, 'https://openrouter.ai/api/v1/embeddings', config.openrouterApiKey));
  if (provider === 'openai') return batched(texts, API_BATCH, (b) => embedHttp(b, 'https://api.openai.com/v1/embeddings', config.aiApiKey));
  throw new Error(`Unknown EMBEDDING_PROVIDER "${provider}" (use "pinecone", "openrouter", or "openai")`);
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
    throw new HttpError(502, `Embeddings failed (${res.status}): ${body?.error?.message ?? 'unknown error'}`);
  }
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
