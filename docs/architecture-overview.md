# Architecture Overview

## 1. System Summary

**BarLoLo Chat** is a production-ready Retrieval-Augmented Generation (RAG) system optimized for e-commerce customer support and domain knowledge retrieval in both **Burmese (Myanmar Unicode)** and **English**.

The architecture runs on cost-effective serverless and containerized infrastructure:
- **Compute**: Vercel Serverless Functions (Node.js 20+ runtime) or self-hosted Docker / Docker Compose container.
- **Vector Database**: Pluggable vector store switched via `VECTOR_DB`:
  - **Pinecone**: Cloud serverless index (`aws/us-east-1` region, free starter tier).
  - **Qdrant**: Local self-hosted container via Docker Compose (100% free) or Qdrant Cloud.
- **Embedding Models**: Pinecone Inference (`llama-text-embed-v2`, 1024 dimensions) or OpenRouter (`openai/text-embedding-3-small`, 1536 dimensions).
- **Large Language Model (LLM)**: OpenRouter API (defaulting to `openai/gpt-4o-mini` or any custom LLM).
- **Vision / OCR Extraction**: OpenRouter Vision API (`google/gemini-2.5-flash`) for multi-modal text extraction from images.

---

## 2. High-Level System Architecture

```
                    ┌───────────────────────────────────────────────┐
                    │               Client Interfaces               │
                    │  • Web Chat UI (public/index.html)            │
                    │  • Admin Document Portal (public/admin.html)   │
                    │  • External REST Clients / API Consumers       │
                    └───────────────────────┬───────────────────────┘
                                            │ HTTP / JSON / Multipart
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              API Layer (Vercel or Docker)                              │
│                                                                                        │
│   POST /api/chat             POST /api/ingest             POST /api/upload             │
│   (Retrieval & Q&A)          (Direct JSON Ingest)         (Multi-format File & OCR)    │
│            │                         │                            │                    │
└────────────┼─────────────────────────┼────────────────────────────┼────────────────────┘
             │                         │                            │
             │                         ▼                            ▼
             │                 ┌───────────────┐            ┌───────────────┐
             │                 │ lib/chunk.js  │            │ lib/extract.js│
             │                 │ (Text Split)  │            │ (PDF/DOCX/OCR)│
             │                 └───────┬───────┘            └───────┬───────┘
             │                         │                            │
             ▼                         ▼                            ▼
┌─────────────────────────┐   ┌─────────────────────────────────────────────────────────┐
│       lib/rag.js        │   │                      lib/ingest.js                      │
│                         │   │                                                         │
│ 1. Embed query          │   │ 1. Extract text & metadata                              │
│ 2. Query vector store   │   │ 2. Split into overlapping chunks                        │
│ 3. Assemble prompt      │   │ 3. Generate passage embeddings                          │
│ 4. Call OpenRouter LLM  │   │ 4. Batch upsert vectors & metadata to Vector Store      │
│ 5. Strip inline markers │   │                                                         │
└────────────┬────────────┘   └────────────────────────────┬────────────────────────────┘
             │                                             │
             ├──────────────────────┬──────────────────────┘
             ▼                      ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   Vector Store Adapter  │  │     OpenRouter API      │
│   (lib/vector-store.js) │  │                         │
│ • Pinecone (cloud)      │  │ • Chat Completions      │
│ • Qdrant (local/cloud)  │  │ • Vision OCR (Gemini)   │
│ • Switch via VECTOR_DB  │  │ • Optional Embeddings   │
└─────────────────────────┘  └─────────────────────────┘
```

---

## 3. Data Flow Pipelines

### 3.1 Document Ingestion Flow (`/api/ingest` & `/api/upload`)
1. **Payload Receipt**: Documents arrive either as structured JSON (`/api/ingest`) or binary multipart file uploads (`/api/upload`).
2. **Text Extraction (`lib/extract.js`)**:
   - Plaintext / Markdown / HTML / JSON: parsed directly.
   - Office & PDF formats (`.pdf`, `.docx`, `.xlsx`, `.csv`): parsed via `pdf-parse`, `mammoth`, and `xlsx`.
   - Images (`.png`, `.jpg`, `.jpeg`, `.webp`): sent to OpenRouter Vision model (`google/gemini-2.5-flash`) with prompt instructions specifically tuned for Burmese Unicode text recognition.
3. **Chunking (`lib/chunk.js`)**: Text is segmented into chunks of ~1,000 characters with 150-character overlap using separator hierarchies (`\n\n`, `\n`, `. `, `? `, `! `, `။ `, `space`).
4. **Vector Generation (`lib/embeddings.js`)**: Each chunk is embedded as an `input_type: "passage"`.
5. **Vector Store Upsert (`lib/vector-store.js`)**: Vectors are batched and upserted:
   - For Pinecone: upserted directly into the serverless index.
   - For Qdrant: IDs are deterministically formatted as RFC 4122 v4 UUIDs while preserving original string IDs in payload metadata (`_recordId`).
   - Metadata stored: `text`, `source`, `fileType`, `docId`, `chunk`, `uploadedAt`.

### 3.2 Query & Retrieval Flow (`/api/chat`)
1. **Query Parsing**: Client submits query text, optional conversation history (prior turns), optional namespace, and optional metadata filters.
2. **Query Vectorization**: Query string is embedded as `input_type: "query"`.
3. **Vector Similarity Search**: Active vector store (Pinecone or Qdrant) is searched for `topK` nearest neighbors (default 6) filtered by minimum similarity score.
4. **Context Construction**: Retrieved text snippets are compiled into a `<reference_knowledge>` block within the system prompt.
5. **Generation**: OpenRouter executes the prompt against the designated chat model (e.g., `openai/gpt-4o-mini`).
6. **Post-Processing (`stripCitations`)**: Regex cleanup removes inline numerical citation tags (e.g. `[1]`, `[၁]`, `(1)`) while preserving markdown links.
7. **Client Response**: Returns clean conversational answer alongside structured `sources` metadata.

---

## 4. Key Design Considerations

### 4.1 Pluggable Vector Store (`VECTOR_DB`)
- **Pinecone**: Hosted serverless cloud index on AWS (`aws/us-east-1`).
- **Qdrant**: Turnkey local container via Docker Compose (zero cloud fees) or Qdrant Cloud. Switched seamlessly via `VECTOR_DB=pinecone` or `VECTOR_DB=qdrant`.
- **Interface Compatibility**: Unified CRUD and search interface across both engines with transparent metadata normalization.

### 4.2 Burmese Unicode Support
- **Encoding Standard**: All components enforce standard Myanmar Unicode (U+1000 to U+109F).
- **Punctuation Splitting**: Recursive text chunking respects Myanmar sentence terminators (`။` - U+104B and `၊` - U+104A).
- **Token Budget**: Burmese script consumes more tokens per word than Latin alphabets; maximum token limits (`MAX_TOKENS`) default to 4096 to prevent truncation.

### 4.3 Citation Suppression & Natural Persona
- Unlike traditional technical search engines, BarLoLo acts as a direct, polite support agent.
- Citations inside the answer text are strictly forbidden in both prompt directives and post-generation regex sanitizers.
- Formal sources are provided as structured JSON metadata in the API response for client-side display if desired.

### 4.4 Idempotency & Clean Updates
- File uploads generate deterministic document IDs based on sanitized filename and cryptographic hash (`upload_<slug>_<hash>`).
- Re-uploading a document replaces prior chunks, preventing duplicate vector pollution.
