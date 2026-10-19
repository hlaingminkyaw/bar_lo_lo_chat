---
id: CHAT-16
title: Local dev server (scripts/dev-server.js)
status: Done
assignee: []
created_date: '2026-10-19 03:30'
labels:
  - tooling
  - dev
dependencies: []
modified_files:
  - scripts/dev-server.js
priority: medium
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Node.js development server that mounts the same /api handlers as Vercel, plus serves static files from public/. Supports --watch mode for auto-restart. Routes /admin to admin.html and all API paths to their handlers. No Vercel login required.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Mounts all API handlers identically to Vercel routing
- [ ] #2 Serves static files from public/ directory
- [ ] #3 Routes /admin to admin.html
- [ ] #4 Supports node --watch for auto-restart on file changes
<!-- AC:END -->
