---
id: CHAT-13
title: Health check endpoint (api/health.js)
status: Done
assignee: []
created_date: '2026-10-19 03:30'
labels:
  - api
  - endpoint
  - ops
dependencies: []
modified_files:
  - api/health.js
priority: low
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GET /api/health diagnostic endpoint. Reports which environment variables are configured (set/missing) without exposing values. Returns { ok: boolean } based on whether all required keys are present.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Returns ok:true when all required env vars are set
- [ ] #2 Lists configured vs missing env vars without exposing values
<!-- AC:END -->
