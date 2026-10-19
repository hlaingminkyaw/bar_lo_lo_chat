---
id: CHAT-3
title: HTTP utilities & CORS middleware (lib/http.js)
status: Done
assignee: []
created_date: '2026-10-19 03:28'
labels:
  - core
  - api
dependencies: []
modified_files:
  - lib/http.js
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Shared HTTP utilities for both Vercel and local dev server. Includes HttpError class, JSON send/read helpers (handles Vercel pre-parsed body and raw streams), CORS headers with configurable origin, OPTIONS preflight, method enforcement, and uniform error responses with ConfigError awareness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 HttpError class with status code support
- [ ] #2 readJson handles both Vercel pre-parsed body and raw Node streams
- [ ] #3 CORS applied to all responses with configurable ALLOWED_ORIGIN
- [ ] #4 route() wrapper enforces methods, handles OPTIONS, and catches errors uniformly
<!-- AC:END -->
