---
id: CHAT-8
title: Ingestion pipeline (lib/ingest.js)
status: Done
assignee: []
created_date: '2026-10-19 03:29'
labels:
  - core
  - rag
  - ingestion
dependencies: []
modified_files:
  - lib/ingest.js
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document ingestion pipeline: chunks text, embeds all chunks in batch, upserts to Pinecone with deterministic vector IDs (docId#chunkIndex). Supports replace mode that deletes stale chunks from previously longer documents. Batched upsert at 100 records per call.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Documents chunked with configurable size/overlap, then batch-embedded
- [ ] #2 Vector IDs use docId#chunkIndex pattern for idempotent re-ingestion
- [ ] #3 Replace mode deletes stale higher-numbered chunks from previous versions
- [ ] #4 Upserts batched at 100 records to stay within Pinecone limits
- [ ] #5 Returns summary with document IDs, sources, and chunk counts
<!-- AC:END -->
