---
id: CHAT-40
title: Retry embedding requests on 429 rate limits during ingestion
status: Done
assignee: []
created_date: '2026-10-21T07:00:00Z'
updated_date: '2026-10-21T07:01:00Z'
labels:
  - ingestion
  - embeddings
  - reliability
dependencies: []
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bulk ingest (npm run ingest -- data/remax --shop=remax) crashed with Pinecone 429 'max tokens per minute (250000) for llama-text-embed-v2 passage'. Embedding calls should retry with backoff on rate-limit errors so large ingests finish on the free tier instead of aborting mid-run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pinecone and HTTP embedding calls retry on 429 with exponential backoff (honoring Retry-After when present)
- [x] #2 Non-rate-limit errors still fail immediately
- [x] #3 Retries log a short wait message so CLI ingest shows progress
- [x] #4 npm run check passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added withRateLimitRetry in lib/embeddings.js: retries 429s (Pinecone message 'Status: 429' or HTTP status 429, honoring Retry-After) with exponential backoff 5s→60s cap, within a total wait budget. embed() defaults to a 15s budget so API handlers stay within Vercel's 60s limit; ingestDocuments forwards retryBudgetMs and scripts/ingest.js uses 5 minutes. Non-429 errors throw immediately. OpenAI/OpenRouter 429s now surface as HttpError 429 instead of 502. Smoke test covers retry success, budget exhaustion and no-retry on other errors; npm run check passes.
<!-- SECTION:FINAL_SUMMARY:END -->
