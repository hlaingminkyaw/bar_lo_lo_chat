---
id: CHAT-18
title: Bulk ingestion script (scripts/ingest.js)
status: Done
assignee: []
created_date: '2026-10-19 03:30'
labels:
  - tooling
  - ingestion
dependencies: []
modified_files:
  - scripts/ingest.js
priority: low
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CLI script for bulk-loading local files into Pinecone without function timeout limits. Supports .md .txt .html .csv .json and all extractable formats. Recursively walks directories, extracts text, and ingests via the pipeline. Defaults to ./data directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Recursively walks directories for supported file types
- [ ] #2 No timeout limits (runs locally, not as serverless function)
- [ ] #3 Defaults to ./data directory, accepts custom paths as args
<!-- AC:END -->
