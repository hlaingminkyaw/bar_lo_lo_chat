---
id: CHAT-12
title: File upload endpoint with multi-format extraction (api/upload.js)
status: Done
assignee: []
created_date: '2026-10-19 03:30'
labels:
  - api
  - endpoint
  - upload
dependencies: []
modified_files:
  - api/upload.js
  - lib/extract.js
priority: medium
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
POST /api/upload (multipart/form-data, no auth, max 10 files). Extracts text from PDF (pdf-parse), DOCX (mammoth), XLSX/XLS/CSV (xlsx), images via OCR (vision model), and plain text formats. Stable upload IDs via SHA-1 hash for idempotent re-upload. GET returns upload limits. Handles Burmese filenames with defParamCharset utf8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Supports PDF, DOCX, XLSX, XLS, CSV, PNG, JPG, WEBP, MD, TXT, HTML, JSON
- [ ] #2 OCR via configurable vision model for image uploads
- [ ] #3 Stable upload IDs (SHA-1 hash) for idempotent re-uploads
- [ ] #4 Max 10 files, configurable MB limit per file
- [ ] #5 GET endpoint returns upload limits and supported extensions
<!-- AC:END -->
