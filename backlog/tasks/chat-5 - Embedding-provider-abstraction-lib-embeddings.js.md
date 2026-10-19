---
id: CHAT-5
title: Embedding provider abstraction (lib/embeddings.js)
status: Done
assignee: []
created_date: '2026-10-19 03:29'
labels:
  - core
  - rag
  - embeddings
dependencies: []
modified_files:
  - lib/embeddings.js
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dual-provider embedding module supporting Pinecone Inference and OpenRouter. Features batched processing (96 for Pinecone, 100 for OpenRouter), asymmetric passage/query input types for llama-text-embed-v2, and automatic chunked batching for large document sets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Supports Pinecone Inference and OpenRouter embedding providers
- [ ] #2 Batched processing respects provider-specific limits (96/100)
- [ ] #3 Asymmetric passage/query input types for llama-text-embed-v2
- [ ] #4 embedOne() convenience wrapper for single-text embedding
<!-- AC:END -->
