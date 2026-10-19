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
  // Vector database provider: 'pinecone' (default) or 'qdrant'
  get vectorDb() {
    return (process.env.VECTOR_DB || 'pinecone').toLowerCase();
  },
  get qdrantUrl() {
    return process.env.QDRANT_URL || 'http://localhost:6333';
  },
  get qdrantApiKey() {
    return process.env.QDRANT_API_KEY || '';
  },
  get qdrantCollection() {
    return process.env.QDRANT_COLLECTION || process.env.PINECONE_INDEX || 'barlolo-chat';
  },
  get pineconeApiKey() {
    if (this.vectorDb === 'pinecone') return required('PINECONE_API_KEY');
    return process.env.PINECONE_API_KEY || '';
  },
  get pineconeIndex() {
    if (this.vectorDb === 'pinecone') return required('PINECONE_INDEX');
    return process.env.PINECONE_INDEX || '';
  },
  get pineconeNamespace() {
    return process.env.PINECONE_NAMESPACE || 'default';
  },

  // AI / LLM Provider: 'openrouter' (default), 'gemini' | 'google', 'openai', 'groq', 'ollama', 'custom'
  get aiProvider() {
    return (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
  },
  get aiBaseUrl() {
    if (process.env.AI_BASE_URL) return process.env.AI_BASE_URL.replace(/\/+$/, '');
    switch (this.aiProvider) {
      case 'gemini':
      case 'google':
        return 'https://generativelanguage.googleapis.com/v1beta/openai';
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'groq':
        return 'https://api.groq.com/openai/v1';
      case 'ollama':
        return (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/+$/, '') + '/v1';
      case 'openrouter':
      default:
        return 'https://openrouter.ai/api/v1';
    }
  },
  get aiApiKey() {
    if (process.env.AI_API_KEY) return process.env.AI_API_KEY;
    switch (this.aiProvider) {
      case 'gemini':
      case 'google':
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      case 'openai':
        return process.env.OPENAI_API_KEY || '';
      case 'groq':
        return process.env.GROQ_API_KEY || '';
      case 'ollama':
        return process.env.OLLAMA_API_KEY || 'ollama';
      case 'openrouter':
      default:
        return process.env.OPENROUTER_API_KEY || '';
    }
  },
  // Backward compatibility alias for openrouterApiKey
  get openrouterApiKey() {
    if (this.aiProvider === 'openrouter' && !this.aiApiKey) {
      return required('OPENROUTER_API_KEY');
    }
    return this.aiApiKey || '';
  },
  get useFreeModels() {
    return (
      process.env.USE_FREE_MODELS === 'true' ||
      Boolean((process.env.LLM_MODEL || process.env.OPENROUTER_MODEL)?.endsWith(':free'))
    );
  },
  get openrouterModel() {
    return this.llmModel;
  },
  get llmModel() {
    if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
    if (process.env.OPENROUTER_MODEL) return process.env.OPENROUTER_MODEL;
    if (this.useFreeModels && this.aiProvider === 'openrouter') return 'nvidia/nemotron-3-ultra-550b-a55b:free';
    switch (this.aiProvider) {
      case 'gemini':
      case 'google':
        return 'gemini-2.5-flash';
      case 'openai':
        return 'gpt-4o-mini';
      case 'groq':
        return 'llama-3.3-70b-versatile';
      case 'ollama':
        return 'llama3.2';
      default:
        return 'openai/gpt-4o-mini';
    }
  },
  get openrouterFreeFallbacks() {
    const list = process.env.OPENROUTER_FREE_FALLBACKS;
    if (list) return list.split(',').map((s) => s.trim()).filter(Boolean);
    return [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3.5-lightning:free',
      'nvidia/nemotron-3.5-super-vl:free',
      'dots-studio/dots-3-note-preview:free',
      'poolside/laguna-s-2.1:free',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
    ];
  },
  // Must accept image input; used to OCR uploaded images.
  get visionModel() {
    if (process.env.VISION_MODEL) return process.env.VISION_MODEL;
    if (this.useFreeModels && this.aiProvider === 'openrouter') return 'nvidia/nemotron-3.5-super-vl:free';
    switch (this.aiProvider) {
      case 'gemini':
      case 'google':
        return 'gemini-2.5-flash';
      case 'openai':
        return 'gpt-4o-mini';
      case 'groq':
        return 'llama-3.2-11b-vision-preview';
      case 'ollama':
        return 'llama3.2-vision';
      default:
        return 'google/gemini-2.5-flash';
    }
  },

  // Vercel rejects request bodies over 4.5 MB, so keep uploads under that.
  get maxUploadMb() {
    return int('MAX_UPLOAD_MB', 4);
  },
  // "pinecone" uses Pinecone's hosted inference (free on the Starter plan).
  // "openrouter" uses OpenRouter's /embeddings endpoint.
  // "openai" uses OpenAI's /embeddings endpoint.
  get embeddingProvider() {
    if (process.env.EMBEDDING_PROVIDER) return process.env.EMBEDDING_PROVIDER.toLowerCase();
    if (this.vectorDb === 'qdrant' && !process.env.PINECONE_API_KEY) {
      return this.aiProvider === 'openai' ? 'openai' : 'openrouter';
    }
    return 'pinecone';
  },
  get embeddingModel() {
    if (process.env.EMBEDDING_MODEL) return process.env.EMBEDDING_MODEL;
    if (this.embeddingProvider === 'openrouter') return 'openai/text-embedding-3-small';
    if (this.embeddingProvider === 'openai') return 'text-embedding-3-small';
    return 'llama-text-embed-v2';
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
