# API Reference

This document provides complete technical specifications for all HTTP endpoints exposed by BarLoLo Chat.

Base URLs:
- **Local Development**: `http://localhost:3000`
- **Vercel Production**: `https://<your-project>.vercel.app`

---

## 1. POST /api/chat

Answers user questions by retrieving relevant vector context from Pinecone and querying the configured LLM.

### 1.1 Request
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
- **Body Parameters**:

| Field | Type | Required | Description | Default |
|---|---|---|---|---|
| `message` | `string` | **Yes** | The user's prompt or question (alias: `question`). Max 4000 characters. | - |
| `history` | `array` | No | List of prior messages: `[{ role: "user" \| "assistant", content: string }]`. Max last 6 turns used. | `[]` |
| `topK` | `integer` | No | Number of context chunks to retrieve (clamped between 1 and 20). | `6` (from `TOP_K` env) |
| `namespace` | `string` | No | Pinecone namespace to scope vector retrieval. | `""` or `PINECONE_NAMESPACE` |
| `filter` | `object` | No | Pinecone metadata filter (e.g. `{ source: { $eq: "remax.md" } }`). | `undefined` |
| `minScore` | `number` | No | Minimum cosine similarity score threshold (0.0 to 1.0) to include a chunk. | `0` |

#### Request Example (JSON)
```json
{
  "message": "REMAX ရဲ့ ပစ္စည်းပြန်လဲလှယ်ခွင့် မူဝါဒက ဘယ်လိုရှိပါသလဲ?",
  "history": [
    { "role": "user", "content": "မင်္ဂလာပါ" },
    { "role": "assistant", "content": "မင်္ဂလာပါခင်ဗျာ၊ BarLoLo မှ ကြိုဆိုပါတယ်။ ဘာများကူညီပေးရမလဲခင်ဗျာ။" }
  ],
  "topK": 5
}
```

#### Request Example (cURL)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I return a defective power bank?"
  }'
```

### 1.2 Response
- **Status Code**: `200 OK`
- **Content-Type**: `application/json`

```json
{
  "answer": "ပစ္စည်းချို့ယွင်းချက်ရှိပါက ဝယ်ယူပြီး ၇ ရက်အတွင်း မူရင်းပြေစာနှင့်အတူ ဆိုင်သို့ လာရောက်လဲလှယ်နိုင်ပါတယ်ခင်ဗျာ။",
  "sources": [
    {
      "ref": 1,
      "id": "upload_remax_policy_delivery_burmese_md_a1b2c3d4#0",
      "source": "remax_policy_delivery_burmese.md",
      "score": 0.884,
      "snippet": "ပစ္စည်းချို့ယွင်းချက် (Defect) များအတွက် ဝယ်ယူပြီး ၇ ရက်အတွင်း မူရင်းပြေစာနှင့် ဘောက်စ်အပြည့်အစုံဖြင့်..."
    }
  ],
  "model": "openai/gpt-4o-mini"
}
```

---

## 2. POST /api/ingest

Directly ingests raw text or batch text documents into Pinecone, handling text chunking, embedding generation, and vector upsert.

### 2.1 Request
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
- **Limits**: Maximum 50 documents and 1,000,000 total characters per call.

#### Single Document Format
```json
{
  "text": "REMAX Power Bank RPP-520 20000mAh features 22.5W Super Fast Charging.",
  "id": "doc_rpp_520",
  "source": "rpp-520.txt",
  "metadata": {
    "category": "power_bank",
    "price": 65000
  },
  "namespace": "catalog"
}
```

#### Multi-Document Format
```json
{
  "documents": [
    {
      "text": "Shipping within Yangon takes 1 to 2 business days.",
      "id": "policy_yangon_delivery",
      "source": "delivery_policy.md"
    },
    {
      "text": "Shipping to other states takes 3 to 5 business days via reliable express services.",
      "id": "policy_upcountry_delivery",
      "source": "delivery_policy.md"
    }
  ],
  "namespace": "policies"
}
```

### 2.2 Response
- **Status Code**: `200 OK`
```json
{
  "upserted": 2,
  "documents": [
    {
      "id": "policy_yangon_delivery",
      "source": "delivery_policy.md",
      "chunks": 1
    },
    {
      "id": "policy_upcountry_delivery",
      "source": "delivery_policy.md",
      "chunks": 1
    }
  ]
}
```

---

## 3. GET & POST /api/upload

Multi-format file upload and OCR extraction endpoint, backing the Admin UI (`/admin.html`).

### 3.1 GET /api/upload
Retrieves allowed file types and file size limits.

#### Response
- **Status Code**: `200 OK`
```json
{
  "ok": true,
  "maxUploadMb": 4,
  "extensions": [
    ".pdf", ".docx", ".xlsx", ".xls", ".csv",
    ".png", ".jpg", ".jpeg", ".webp",
    ".md", ".txt", ".html", ".json"
  ]
}
```

### 3.2 POST /api/upload
Uploads one or more binary files (up to 10 files per request). Extracts text, chunks, embeds, and updates Pinecone vectors.

- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: One or more binary files attached.
  - `namespace` (optional): Pinecone namespace for the upload.

#### Example (cURL)
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@./data/remax/remax_00_store_info.pdf" \
  -F "namespace=remax"
```

#### Successful Response (`200 OK`)
```json
{
  "upserted": 12,
  "files": [
    {
      "file": "remax_00_store_info.pdf",
      "id": "upload_remax_00_store_info_pdf_4c89e211",
      "chunks": 12,
      "characters": 10450
    }
  ]
}
```

#### Partial or Failed Response (`422 Unprocessable Entity`)
```json
{
  "error": "No readable text found in this file",
  "upserted": 0,
  "files": [
    {
      "file": "empty_document.pdf",
      "error": "No readable text found in this file"
    }
  ]
}
```

---

## 4. GET /api/health

Verifies environment health and reports configured models. No secrets or credentials are ever leaked.

### 4.1 Request
- **Method**: `GET`
- **URL**: `/api/health`

### 4.2 Response
- **Status Code**: `200 OK`
```json
{
  "ok": true,
  "env": {
    "PINECONE_API_KEY": true,
    "PINECONE_INDEX": true,
    "OPENROUTER_API_KEY": true
  },
  "llmModel": "openai/gpt-4o-mini",
  "embedding": {
    "provider": "pinecone",
    "model": "llama-text-embed-v2"
  }
}
```

---

## 5. HTTP Error Handling & Status Codes

All errors return JSON in the structure `{ "error": "<message>" }`.

| Status Code | Meaning | Common Cause |
|---|---|---|
| `400 Bad Request` | Missing or malformed parameters | Missing `message` in `/api/chat` or empty documents in `/api/ingest`. |
| `405 Method Not Allowed` | Incorrect HTTP Verb | Calling `GET` on `/api/chat`. |
| `413 Payload Too Large` | Limit exceeded | Uploading larger than `MAX_UPLOAD_MB` (4 MB) or >50 docs. |
| `415 Unsupported Media Type` | Invalid file format | Uploading an unapproved extension like `.exe` or `.zip`. |
| `422 Unprocessable Entity` | Parsing/extraction failure | Uploading corrupted PDF or file with 0 readable characters. |
| `500 Internal Server Error` | Backend or external service failure | Pinecone connection timeout or OpenRouter rate limit. |
