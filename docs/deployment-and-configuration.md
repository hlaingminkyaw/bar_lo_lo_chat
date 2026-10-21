# Deployment and Configuration Guide

This guide walks through configuring, testing, and deploying BarLoLo Chat locally, via Docker Compose, and in production on Vercel.

---

## 1. Environment Variables Reference

Configure environment variables in `.env` for local execution or inside the Vercel Dashboard under **Project Settings → Environment Variables**.

| Variable | Required? | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | No | `openrouter` | AI/LLM provider: `openrouter`, `gemini`, `openai`, `groq`, `ollama`, or `custom`. |
| `OPENROUTER_API_KEY`| If using OpenRouter | - | OpenRouter API key from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys). |
| `GEMINI_API_KEY` | If using Gemini | - | Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey). |
| `OPENAI_API_KEY` | If using OpenAI | - | OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys). |
| `GROQ_API_KEY` | If using Groq | - | Groq API key from [console.groq.com](https://console.groq.com/keys). |
| `OLLAMA_HOST` | If using Ollama | `http://localhost:11434` | Ollama local endpoint URL. |
| `AI_BASE_URL` | If using Custom | - | Base URL for custom OpenAI-compatible endpoint. |
| `AI_API_KEY` | If using Custom | - | API key for custom endpoint (or generic override). |
| `LLM_MODEL` | No | Provider default | Main model override across any AI provider. |
| `VECTOR_DB` | No | `pinecone` | Vector store provider: `pinecone` or `qdrant`. |
| `PINECONE_API_KEY` | If using Pinecone | - | Pinecone API key from [app.pinecone.io](https://app.pinecone.io). |
| `PINECONE_INDEX` | If using Pinecone | - | Pinecone Serverless index name (e.g. `barlolo-chat`). |
| `PINECONE_NAMESPACE` | No | `default` | Namespace partition inside Pinecone index. |
| `QDRANT_URL` | If using Qdrant | `http://localhost:6333` | Qdrant host URL (or `http://qdrant:6333` inside Docker Compose). |
| `QDRANT_COLLECTION` | If using Qdrant | `barlolo-chat` | Qdrant collection name. |
| `QDRANT_API_KEY` | No | `""` | Optional API key for authenticated Qdrant Cloud clusters. |
| `USE_FREE_MODELS` | No | `false` | When `true`, automatically defaults chat & vision to top free models. |
| `OPENROUTER_MODEL` | No | `openai/gpt-4o-mini` | Model for OpenRouter (alias for `LLM_MODEL`). |
| `VISION_MODEL` | No | Provider default | Multimodal model for OCR extraction. |
| `OPENROUTER_FREE_FALLBACKS` | No | Default list | Comma-separated list of fallback free models on 429 rate limits. |
| `MAX_UPLOAD_MB` | No | `4` | Maximum upload size in megabytes (kept ≤4.5 MB for Vercel limits). |
| `EMBEDDING_PROVIDER`| No | `pinecone` (or `openrouter` with Qdrant) | Vector provider: `pinecone`, `openrouter`, or `openai`. |
| `EMBEDDING_MODEL` | No | `llama-text-embed-v2` | Embedding model (`llama-text-embed-v2` or `openai/text-embedding-3-small`). |
| `CHUNK_SIZE` | No | `1000` | Target characters per chunk during text splitting. |
| `CHUNK_OVERLAP` | No | `150` | Overlap characters between consecutive chunks. |
| `TOP_K` | No | `6` | Number of context chunks retrieved for generation. |
| `MAX_TOKENS` | No | `4096` | Output token generation budget (Burmese requires token headroom). |
| `ALLOWED_ORIGIN` | No | `*` | Allowed CORS origins for browser fetch calls. |
| `SITE_URL` | No | `""` | Optional OpenRouter referrer ranking header. |
| `APP_NAME` | No | `BarLoLo Chat` | OpenRouter application identifier header. |
| `FB_VERIFY_TOKEN` | If using Messenger | - | Secret string matched against `hub.verify_token` when Meta verifies `/api/webhook`. |
| `PAGE_ACCESS_TOKEN_<SHOP>` | If using Messenger | - | One per shop page: the env var named by that shop's `pageAccessToken` in `config/shops.json` (e.g. `PAGE_ACCESS_TOKEN_REMAX`). Used to send replies via the Graph Send API. See [multi-tenant-shops.md](multi-tenant-shops.md). |
| `UPSTASH_REDIS_REST_URL` | For chat history | - | Upstash Redis REST URL (falls back to `KV_REST_API_URL`). Without it, web chat and Messenger answer without history. |
| `UPSTASH_REDIS_REST_TOKEN` | For web chat history | - | Upstash Redis REST token (falls back to `KV_REST_API_TOKEN`). |

---

## 2. Using 100% Free OpenRouter Models

BarLoLo Chat supports running completely on **$0 cost free models** from OpenRouter:

### 2.1 Enabling Free Models
Set either:
```ini
USE_FREE_MODELS=true
```
Or specify explicit `:free` models in `.env`:
```ini
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
VISION_MODEL=google/gemini-2.0-flash-lite:free
```

### 2.2 Recommended Free Models on OpenRouter
- **`meta-llama/llama-3.3-70b-instruct:free`** (Recommended Default): Excellent reasoning, detailed answers, and strong multilingual Myanmar Unicode support.
- **`google/gemini-2.0-flash-lite:free`**: Extremely fast inference and multimodal vision OCR.
- **`deepseek/deepseek-r1:free`**: Advanced chain-of-thought reasoning (automatically sanitizes `<think>` tags).
- **`qwen/qwen-2.5-72b-instruct:free`**: High performance and multilingual knowledge.

### 2.3 Automatic Free Model Rate-Limit Fallbacks
Free models on OpenRouter occasionally return `429 Too Many Requests` during peak global traffic. When an `:free` model encounters a 429, BarLoLo Chat automatically falls back through alternative top free models, ensuring uninterrupted user chat sessions without requiring manual configuration changes.

---

## 2. Docker Compose (Self-Hosted Free Setup with Qdrant)

BarLoLo Chat provides a complete, turnkey Docker Compose configuration running both the application and a local **Qdrant** vector database container.

### 2.1 Starting Docker Compose
1. Ensure Docker is running.
2. In your `.env` file, specify your OpenRouter key:
   ```ini
   VECTOR_DB=qdrant
   OPENROUTER_API_KEY=sk-or-v1-...
   EMBEDDING_PROVIDER=openrouter
   EMBEDDING_MODEL=openai/text-embedding-3-small
   ```
3. Launch services:
   ```bash
   docker compose up -d
   ```
4. Services available:
   - **BarLoLo Chat & Admin UI**: `http://localhost:3000`
   - **Qdrant REST API & Dashboard**: `http://localhost:6333/dashboard`

### 2.2 Ingesting Data in Docker Setup
Run setup and ingestion against your local Qdrant instance:
```bash
# Initialize collection in Qdrant
QDRANT_URL=http://localhost:6333 npm run setup-index

# Bulk-ingest documents into Qdrant
VECTOR_DB=qdrant QDRANT_URL=http://localhost:6333 npm run ingest
```

---

## 3. Local Development Setup (Node.js)

### 3.1 Prerequisites
- **Node.js**: Version 20.0.0 or higher.
- **npm**: Version 10 or higher.
- API keys from **Pinecone** (or local Qdrant) and **OpenRouter**.

### 3.2 Installation & Offline Sanity Check
```bash
npm install
npm run check
```

### 3.3 Configure Local Environment
```bash
cp .env.example .env
```
Choose your vector database in `.env`:
- **Pinecone Mode**: Set `VECTOR_DB=pinecone`, `PINECONE_API_KEY`, and `PINECONE_INDEX`.
- **Qdrant Mode**: Set `VECTOR_DB=qdrant` and `QDRANT_URL=http://localhost:6333`.

### 3.4 Initialize Index / Collection
```bash
npm run setup-index
```
Automatically creates either:
- The Pinecone serverless index (`aws/us-east-1`, cosine), or
- The Qdrant collection with matching embedding dimension.

### 3.5 Start Local Dev Server
```bash
npm run dev
```
Access at `http://localhost:3000`.

---

## 4. Production Deployment on Vercel

Vercel Serverless Functions natively support both Pinecone (serverless cloud) and Qdrant (Qdrant Cloud free tier or self-hosted accessible endpoint).

### 4.1 Deploy via Vercel CLI
```bash
vercel login
vercel

# Add required production environment variables:
vercel env add VECTOR_DB production          # "pinecone" or "qdrant"
vercel env add OPENROUTER_API_KEY production

# If using Pinecone:
vercel env add PINECONE_API_KEY production
vercel env add PINECONE_INDEX production

# If using Qdrant Cloud:
vercel env add QDRANT_URL production         # https://xxxxxx.cloud.qdrant.io:6333
vercel env add QDRANT_API_KEY production

vercel --prod
```

### 4.2 Function Configuration (`vercel.json`)
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/**/*.js": {
      "maxDuration": 60
    }
  }
}
```
Execution timeout is set to 60s for batch processing and OCR workloads.
