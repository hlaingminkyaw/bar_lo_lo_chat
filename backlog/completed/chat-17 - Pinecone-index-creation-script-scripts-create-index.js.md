---
id: CHAT-17
title: Pinecone index creation script (scripts/create-index.js)
status: Done
assignee: []
created_date: '2026-10-19 03:30'
labels:
  - tooling
  - setup
dependencies: []
modified_files:
  - scripts/create-index.js
priority: low
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One-time setup script that probes the configured embedding model's dimension by embedding a test string, then creates a serverless Pinecone index on aws/us-east-1 (free tier region). Refuses to reuse an index with mismatched dimensions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Probes embedding dimension by embedding a test string
- [ ] #2 Creates serverless index on aws/us-east-1
- [ ] #3 Refuses to create index if dimension mismatch detected
<!-- AC:END -->
