# Data Ingestion and Knowledge Base Guide

This guide details how knowledge documents are processed, structured, embedded, and maintained in BarLoLo Chat.

---

## 1. Knowledge Base Overview

BarLoLo Chat includes a comprehensive retail knowledge base for **REMAX Myanmar Online Shop** located in `data/remax/`:

- **Store Info**: `remax_00_store_info.pdf` (Company history, warranties, customer service contacts, retail locations).
- **Audio & Headsets**: `remax_01_audio_earbuds_headphones.pdf`, `remax_02_audio_speakers_microphones.pdf`.
- **Power & Charging**: `remax_03_power_banks_power_stations.pdf`, `remax_04_chargers_adapters.pdf`.
- **Cables & Connectivity**: `remax_05_cables_part1.pdf`, `remax_05_cables_part2.pdf`.
- **Phone Protection**: `remax_06_phone_cases_covers_part1.pdf`, `remax_06_phone_cases_covers_part2.pdf`, `remax_07_screen_protectors_lens_guards_part1..4.pdf`.
- **Wearables & Cooling**: `remax_08_smart_watches_wearables.pdf`, `remax_09_fans_cooling.pdf`.
- **Vehicle & Tech Accessories**: `remax_10_car_accessories.pdf`, `remax_11_holders_stands_tripods.pdf`, `remax_12_computer_hubs_storage.pdf`, `remax_13_bags_lifestyle.pdf`, `remax_14_other_accessories.pdf`.
- **Store Policies (Burmese)**: `remax_policy_delivery_burmese.md` (Detailed Burmese delivery timelines, payment options, warranty policies, return and refund regulations).

Additionally, sample regional tourism knowledge files (`data/Bagan.pdf`, `data/bagan_overview.docx`, `data/bagan_temples.csv`) are included for testing multi-domain retrieval.

---

## 2. Supported Formats & Extraction Engine (`lib/extract.js`)

The extraction pipeline automatically inspects file extensions and applies specialized parsers:

| Format Category | File Extensions | Parser / Engine | Notes |
|---|---|---|---|
| Plaintext & Structured | `.txt`, `.md`, `.html`, `.json` | Native UTF-8 string decoding | Full fidelity preservation of Unicode. |
| PDF Documents | `.pdf` | `pdf-parse` (v1.1.1) | Extracts textual streams and tables. |
| Microsoft Word | `.docx` | `mammoth` (v1.8.0) | Converts document structure to clean raw text. |
| Spreadsheets & Tables | `.xlsx`, `.xls`, `.csv` | `xlsx` (v0.18.5) | Converts sheets to structured CSV text strings. |
| Images (Multimodal OCR) | `.png`, `.jpg`, `.jpeg`, `.webp` | OpenRouter Vision (`google/gemini-2.5-flash`) | Prompts Gemini with strict instructions to read Burmese script accurately without hallucinating text. |

---

## 3. Ingestion Methods

### 3.1 Bulk Local Ingestion (`scripts/ingest.js`)
For large catalogues or initial index population, use the CLI bulk ingestion script. This runs directly on your local machine with no HTTP function timeout limits:

```bash
# Ingest all files in ./data (including subdirectories like ./data/remax)
npm run ingest

# Ingest specific folder or files
npm run ingest -- ./data/remax
npm run ingest -- ./data/remax/remax_policy_delivery_burmese.md
```

The script:
1. Discovers all supported files recursively.
2. Extracts and splits text.
3. Generates vector embeddings in batches.
4. Upserts vectors to the Pinecone index.
5. Displays a summary report of total documents, chunks, and characters processed.

### 3.2 Web Admin Portal (`public/admin.html`)
An admin portal is available for non-technical users to drag-and-drop documents:
1. Start the server (`npm run dev`) or visit your deployed Vercel domain.
2. Navigate to `/admin.html`.
3. Drop up to 10 files (PDFs, Word docs, spreadsheets, markdown files, product photos).
4. Monitor live progress, per-file chunk counts, and status indicators.

### 3.3 Programmatic Ingestion (`/api/ingest` & `/api/upload`)
- Use `POST /api/upload` with `multipart/form-data` to send raw binary files.
- Use `POST /api/ingest` with `application/json` to send pre-parsed text strings or documentation pipelines.

---

## 4. Chunking Strategy (`lib/chunk.js`)

Text chunking is critical for high-recall RAG:
- **Chunk Size**: Target length is 1,000 characters.
- **Chunk Overlap**: 150 characters are carried over from the end of the previous chunk to maintain context across boundaries.
- **Separator Hierarchy**:
  1. Double newlines (`\n\n`) - Paragraph boundaries.
  2. Single newlines (`\n`) - Line boundaries.
  3. Sentence terminators (`. `, `? `, `! `).
  4. Myanmar sentence terminators (`။ `, `၊ `).
  5. Whitespace and word boundaries.

```javascript
// Burmese-aware punctuation splitters
const SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '။ ', '၊ ', ' '];
```

---

## 5. Vector Storage & Metadata Architecture

Each chunk is stored in Pinecone with structured metadata:

```json
{
  "id": "upload_remax_00_store_info_pdf_4c89e211#0",
  "values": [0.0124, -0.0451, ...],
  "metadata": {
    "text": "REMAX Myanmar Customer Service Hotline...",
    "source": "remax_00_store_info.pdf",
    "fileType": "pdf",
    "docId": "upload_remax_00_store_info_pdf_4c89e211",
    "chunk": 0,
    "uploadedAt": 1729309000000
  }
}
```

### Deterministic IDs & Clean Document Replacement
When a file is uploaded again:
- The system generates the same deterministic `docId` using the filename slug and a SHA-1 hash.
- Prior vectors matching this `docId` prefix are overwritten or updated, preventing stale chunks from degrading answer quality.
