import { config } from '../lib/config.js';
import { route, sendJson } from '../lib/http.js';

// GET /api/health: reports which settings are present (never their values).
export default route(['GET'], async (_req, res) => {
  const has = (name) => Boolean(process.env[name]);
  sendJson(res, 200, {
    ok: has('PINECONE_API_KEY') && has('PINECONE_INDEX') && has('OPENROUTER_API_KEY'),
    env: {
      PINECONE_API_KEY: has('PINECONE_API_KEY'),
      PINECONE_INDEX: has('PINECONE_INDEX'),
      OPENROUTER_API_KEY: has('OPENROUTER_API_KEY'),
    },
    llmModel: config.openrouterModel,
    embedding: { provider: config.embeddingProvider, model: config.embeddingModel },
  });
});
