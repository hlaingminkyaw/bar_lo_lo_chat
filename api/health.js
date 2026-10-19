import { config } from '../lib/config.js';
import { route, sendJson } from '../lib/http.js';

// GET /api/health: reports which settings are present (never their values).
export default route(['GET'], async (_req, res) => {
  const has = (name) => Boolean(process.env[name]);
  const isQdrant = config.vectorDb === 'qdrant';

  const vectorDbConfigured = isQdrant
    ? Boolean(config.qdrantUrl)
    : has('PINECONE_API_KEY') && has('PINECONE_INDEX');

  const aiKeyConfigured = Boolean(config.aiApiKey) || config.aiProvider === 'ollama';

  sendJson(res, 200, {
    ok: vectorDbConfigured && aiKeyConfigured,
    aiProvider: config.aiProvider,
    vectorDb: config.vectorDb,
    env: {
      AI_PROVIDER: config.aiProvider,
      AI_API_KEY: Boolean(config.aiApiKey),
      VECTOR_DB: config.vectorDb,
      ...(isQdrant
        ? {
            QDRANT_URL: Boolean(config.qdrantUrl),
            QDRANT_COLLECTION: config.qdrantCollection,
            QDRANT_API_KEY: Boolean(config.qdrantApiKey),
          }
        : {
            PINECONE_API_KEY: has('PINECONE_API_KEY'),
            PINECONE_INDEX: has('PINECONE_INDEX'),
          }),
      OPENROUTER_API_KEY: has('OPENROUTER_API_KEY'),
      GEMINI_API_KEY: has('GEMINI_API_KEY') || has('GOOGLE_API_KEY'),
      OPENAI_API_KEY: has('OPENAI_API_KEY'),
      GROQ_API_KEY: has('GROQ_API_KEY'),
    },
    llmModel: config.llmModel,
    embedding: { provider: config.embeddingProvider, model: config.embeddingModel },
  });
});
