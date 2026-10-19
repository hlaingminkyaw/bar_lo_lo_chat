---
id: CHAT-11
title: Ingest API endpoint (api/ingest.js)
status: Done
assignee: []
created_date: '2026-10-19 03:30'
labels:
  - api
  - endpoint
  - ingestion
dependencies: []
modified_files:
  - api/ingest.js
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
POST /api/ingest serverless function (no auth). Accepts single document or batch (max 50 docs, 1M chars total). Validates text fields, flattens metadata to Pinecone-compatible types (strings, numbers, booleans, string arrays). Delegates to ingestion pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Accepts single doc or documents[] array (max 50)
- [ ] #2 Total text limited to 1M characters per request
- [ ] #3 Metadata flattened to Pinecone-compatible types
- [ ] #4 Returns { upserted, documents } summary
<!-- AC:END -->
