---
id: CHAT-10
title: Chat API endpoint (api/chat.js)
status: Done
assignee: []
created_date: '2026-10-19 03:29'
labels:
  - api
  - endpoint
dependencies: []
modified_files:
  - api/chat.js
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
POST /api/chat serverless function. Validates message (required, max 4000 chars), sanitizes history (user/assistant only, no system injection), clamps topK (1-20), passes namespace/filter/minScore to RAG pipeline. Returns answer, sources with numbered refs, and model name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Message required and limited to 4000 characters
- [ ] #2 History sanitized: only user/assistant roles allowed, content truncated
- [ ] #3 topK clamped between 1-20
- [ ] #4 Returns { answer, sources, model } JSON response
<!-- AC:END -->
