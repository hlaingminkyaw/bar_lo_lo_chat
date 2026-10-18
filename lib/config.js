// Central place for environment configuration. Vercel injects these from
// Project Settings → Environment Variables; locally they come from .env.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class ConfigError extends Error {}

export const config = {
  get pineconeApiKey() {
    return required('PINECONE_API_KEY');
  },
  get pineconeIndex() {
    return required('PINECONE_INDEX');
  },
  get pineconeNamespace() {
    return process.env.PINECONE_NAMESPACE || 'default';
  },
  get openrouterApiKey() {
    return required('OPENROUTER_API_KEY');
  },
  get openrouterModel() {
    // Pin a real chat model: "openrouter/free" can route to safety classifiers
    // that reply "User Safety: safe" instead of answering.
    return process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  },
  // Must accept image input; used to OCR uploaded images. In testing,
  // gpt-4o-mini and gemini-2.5-flash-lite invented Burmese text; this didn't.
  get visionModel() {
    return process.env.VISION_MODEL || 'google/gemini-2.5-flash';
  },
  // Vercel rejects request bodies over 4.5 MB, so keep uploads under that.
  get maxUploadMb() {
    return int('MAX_UPLOAD_MB', 4);
  },
  // "pinecone" uses Pinecone's hosted inference (free on the Starter plan).
  // "openrouter" uses OpenRouter's /embeddings endpoint.
  get embeddingProvider() {
    return (process.env.EMBEDDING_PROVIDER || 'pinecone').toLowerCase();
  },
  get embeddingModel() {
    if (process.env.EMBEDDING_MODEL) return process.env.EMBEDDING_MODEL;
    return this.embeddingProvider === 'openrouter'
      ? 'openai/text-embedding-3-small'
      : 'llama-text-embed-v2';
  },
  get chunkSize() {
    return int('CHUNK_SIZE', 1000);
  },
  get chunkOverlap() {
    return int('CHUNK_OVERLAP', 150);
  },
  get topK() {
    return int('TOP_K', 6);
  },
  // Burmese uses several tokens per word, so detailed answers need headroom.
  get maxTokens() {
    return int('MAX_TOKENS', 4096);
  },
  get ingestSecret() {
    return process.env.INGEST_SECRET || '';
  },
  get allowedOrigin() {
    return process.env.ALLOWED_ORIGIN || '*';
  },
  get siteUrl() {
    return process.env.SITE_URL || '';
  },
  get appName() {
    return process.env.APP_NAME || 'BarLoLo Chat';
  },
};
