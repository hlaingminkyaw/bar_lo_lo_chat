# BarLoLo Chat: Vercel + Pinecone + OpenRouter

A serverless Retrieval-Augmented Generation backend that runs on free tiers:

| Piece | Service | Cost |
|---|---|---|
| Hosting | Vercel Serverless Functions (Node.js) | Hobby plan, free |
| Vector DB | Pinecone serverless index | Starter plan, free |
| Embeddings | Pinecone Inference `llama-text-embed-v2` (default) or OpenRouter `/embeddings` | Free on Starter / pay-per-token |
| LLM | OpenRouter `openrouter/free` (or any model you choose) | Free models available |

```
            ┌──────────── POST /api/ingest ────────────┐
 documents ─┤ chunk → embed (passage) → upsert Pinecone │
            └───────────────────────────────────────────┘
            ┌──────────── POST /api/chat ──────────────────────────────────┐
 question ──┤ embed (query) → Pinecone top-k → prompt + context → OpenRouter ├─→ { answer, sources }
            └───────────────────────────────────────────────────────────────┘
```

## Project structure

```
api/
  chat.js          POST /api/chat    retrieve + generate
  ingest.js        POST /api/ingest  chunk + embed + upsert (Bearer-protected)
  health.js        GET  /api/health  shows which env vars are set
  webhook.js       GET|POST /api/webhook  Facebook Messenger bot for many shop pages (see docs/multi-tenant-shops.md)
config/
  shops.json       Facebook Page ID → shop (namespace, prompt, token env var, maxTokens)
lib/
  config.js        env var access and defaults
  chunk.js         recursive text splitter with overlap
  embeddings.js    Pinecone Inference or OpenRouter embeddings
  pinecone.js      cached Pinecone client
  openrouter.js    chat completion call
  ingest.js        ingestion pipeline
  rag.js           retrieval + prompt building
  http.js          CORS, JSON parsing, error handling
scripts/
  create-index.js  one-time index creation (detects the embedding dimension)
  ingest.js        bulk-ingest local files (no function timeout)
  dev-server.js    local server running the same handlers
  smoke-test.js    offline sanity checks
public/index.html  small chat page for manual testing
data/remax/        REMAX Online Shop knowledge base (store info + product catalog PDFs)
vercel.json        function config (60s max duration)
.env.example       environment variable template
```

---

## 1. Get your API keys

1. **Pinecone**: sign up at <https://app.pinecone.io>. The Starter plan is free. Copy the key from **API Keys**.
2. **OpenRouter**: sign up at <https://openrouter.ai>, then create a key at <https://openrouter.ai/settings/keys>.

## 2. Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env        # then fill in PINECONE_API_KEY, OPENROUTER_API_KEY
npm run check               # offline sanity check, no keys needed
```

**Create the index** (one time). The script embeds a probe string to find the model's dimension, then creates a serverless index on `aws/us-east-1`, the only region the free plan allows:

```bash
npm run setup-index
```

**Load documents.** Choose either option:

```bash
# Option A: bulk-load local files (.md .txt .html .csv .json), no timeout limits
npm run ingest                    # loads ./data
npm run ingest -- ./my-docs       # any folder or file list
```

```bash
# Option B: through the HTTP endpoint (start the server first, see below)
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"id":"faq","source":"faq.md","text":"Annual plans can be refunded within 30 days..."}'
```

**Start the API and test it:**

```bash
npm run dev                       # http://localhost:3000
```

```bash
curl http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the refund policy for annual plans?"}'
```

You can also open <http://localhost:3000> to use the small chat page.

> `npm run dev` is a plain Node server that mounts the same `/api` handlers, so no Vercel login is needed. To match production exactly, run `npx vercel dev` instead (it asks you to log in and link the project the first time).

## 3. Deploy to Vercel

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel                      # first deploy: links/creates the project (preview URL)

# Add env vars (each command prompts for the value)
vercel env add PINECONE_API_KEY production
vercel env add PINECONE_INDEX production
vercel env add OPENROUTER_API_KEY production
# optional: OPENROUTER_MODEL, EMBEDDING_PROVIDER, EMBEDDING_MODEL, ALLOWED_ORIGIN ...

vercel --prod               # production deploy
```

### Option B: GitHub

1. Push this folder to a GitHub repo. `.env` is gitignored, so it won't be committed.
   ```bash
   git init && git add . && git commit -m "RAG backend"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In the Vercel dashboard, choose **Add New → Project** and import the repo. Leave Framework Preset as **Other** and leave the build settings empty.
3. Under **Environment Variables**, add the same keys as in `.env`.
4. Click **Deploy**. Every push to `main` redeploys automatically.

> Env vars only take effect on new deployments. If you change one, redeploy.

### Test the deployment

```bash
URL=https://<your-project>.vercel.app

curl $URL/api/health          # "ok": true means all required keys are set

curl -X POST $URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What does the Business plan include?"}'
```

Ingestion writes to the same Pinecone index whether you run it locally or on Vercel. Loading data with `npm run ingest` from your laptop is usually the easiest approach.

---

## API reference

### `POST /api/chat`

```jsonc
{
  "message": "What is the refund policy?",       // required (alias: "question")
  "sessionId": "3f2b8c1e-...",                     // web UI: history kept in Upstash Redis (last 4 messages, 1h TTL)
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }], // only without sessionId
  "topK": 5,                                       // 1–20
  "namespace": "default",
  "filter": { "source": { "$eq": "faq.md" } },     // Pinecone metadata filter
  "minScore": 0.3                                  // drop weak matches
}
```

Response:

```json
{
  "answer": "Annual subscriptions can be refunded in full within 30 days [1].",
  "sources": [{ "ref": 1, "id": "faq#0", "source": "faq.md", "score": 0.84, "snippet": "..." }],
  "model": "google/gemma-4-31b-it:free"
}
```

### `GET /api/history?sessionId=<id>`

Returns `{ "history": [{ "role": "user" | "assistant", "content": "..." }] }`, the last 4 stored messages for a web session (empty if none, expired, or Redis is down). The web UI uses it to redraw the chat after a reload.

### `POST /api/ingest`

No authentication (see **Security**).

```jsonc
// single document
{ "text": "...", "id": "faq", "source": "faq.md", "metadata": { "lang": "en" } }
// or a batch (max 50 docs / 1M characters per request)
{ "documents": [{ "text": "...", "source": "a.md" }, { "text": "...", "source": "b.md" }], "namespace": "default" }
```

Vector IDs are `<docId>#<chunkIndex>`. Re-ingesting a document with the same `id` overwrites its chunks instead of creating duplicates. If a document gets shorter, its leftover higher-numbered chunks remain; delete them from the Pinecone console, or ingest into a fresh namespace.

### `POST /api/upload`

No authentication (see **Security**). Send `multipart/form-data` with one or more files in the `file` field (and an optional `namespace` field). The admin page at **`/admin`** does this for you; the public chat page has no upload UI. `GET /api/upload` returns the upload limits.

Each chunk is stored in Pinecone with metadata `{ text, source, uploadedAt, fileType, docId, chunk }` (`uploadedAt` is milliseconds since epoch). Uploaded files are held in memory only; nothing is written to disk.

```bash
curl -X POST http://localhost:3000/api/upload \
  -F file=@pricing.pdf -F file=@plans.xlsx
```

| Format | Extracted with |
|---|---|
| `.pdf` | `pdf-parse` (text layer only; Burmese PDFs often extract scrambled, so prefer `.docx`) |
| `.docx` | `mammoth` |
| `.xlsx` `.xls` `.csv` | `xlsx`, one line per row as `Header: value; Header: value` |
| `.png` `.jpg` `.jpeg` `.webp` | OCR via `VISION_MODEL` on OpenRouter (default `google/gemini-2.5-flash`) |
| `.md` `.txt` `.html` `.json` | read as UTF-8 |

Each file is limited to `MAX_UPLOAD_MB` (default 4; Vercel rejects request bodies over 4.5 MB). Re-uploading a file with the same name replaces its chunks. `npm run ingest` accepts the same formats.

---

## Configuration notes

- **Choosing an LLM.** `openrouter/free` picks an available free model for each request, so answer quality and style vary. For consistent results, set `OPENROUTER_MODEL` to a specific model. Browse free models at <https://openrouter.ai/models?q=free>.
- **Changing the embedding model.** Every vector in an index must have the same dimension. If you change `EMBEDDING_PROVIDER` or `EMBEDDING_MODEL`, set a new `PINECONE_INDEX` name, then rerun `npm run setup-index` and re-ingest. The setup script refuses to reuse an index whose dimension doesn't match.
- **Free OpenRouter embedding models** (`...:free`) exist, but OpenRouter notes that requests to some of them may be retained and used for training. The default Pinecone Inference option avoids this.

## Free-tier limits

These limits were current when this README was written; check each provider for the latest.

- **Vercel Hobby** is for non-commercial use. Request bodies are limited to 4.5 MB, and `vercel.json` sets a 60-second function timeout.
- **Pinecone Starter** allows only `aws/us-east-1`, has a storage cap of a few GB, and includes a monthly embedding-token allowance. Indexes inactive for a long period may be paused.
- **OpenRouter free models** are rate-limited per minute and per day. The daily cap rises if you've ever bought credits. A `429` from `/api/chat` means you hit that limit.

## Security

- `/admin`, `/api/upload` and `/api/ingest` have **no authentication**, by choice for personal use. Anyone who finds the URL can add documents (changing what the bot answers) and spend OpenRouter credits on image OCR. To lock them down without code changes, turn on Vercel **Deployment Protection**.
- `/api/chat` is public. Anyone with the URL can use up your OpenRouter quota. Set `ALLOWED_ORIGIN` to your frontend's domain. If you need stricter control, add auth or rate limiting (for example, Vercel Firewall rules).
- Clients can only send `user`/`assistant` turns in `history`. Any `system` message they send is dropped.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing required environment variable` | Add it in `.env` (local) or Vercel env vars, then redeploy |
| `Vector dimension X does not match the dimension of the index Y` | The embedding model changed; see "Changing the embedding model" above |
| Answer says "I don't know" | Check that ingestion succeeded and that you're querying the same `namespace`; try a higher `topK` |
| `429` from chat | OpenRouter free-model rate limit; wait, or pin a different model |
| Function timeout on `/api/ingest` | Send smaller batches, or use `npm run ingest` locally |
