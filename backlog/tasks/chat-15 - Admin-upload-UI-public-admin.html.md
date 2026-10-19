---
id: CHAT-15
title: Admin upload UI (public/admin.html)
status: Done
assignee: []
created_date: '2026-10-19 03:30'
labels:
  - frontend
  - ui
  - admin
dependencies: []
modified_files:
  - public/admin.html
priority: medium
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Admin page for document management via file upload. Drag-and-drop or click-to-upload interface supporting all extraction formats. Shows upload progress, results per file (chunks, characters), and error details. Fetches upload limits from GET /api/upload.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Drag-and-drop and click-to-select file upload
- [ ] #2 Displays upload results per file (chunks, characters, errors)
- [ ] #3 Fetches and displays upload limits from API
- [ ] #4 Supports all file formats handled by /api/upload
<!-- AC:END -->
