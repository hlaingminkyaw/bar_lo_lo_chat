---
id: CHAT-4
title: Text chunking engine (lib/chunk.js)
status: Done
assignee: []
created_date: '2026-10-19 03:29'
labels:
  - core
  - rag
dependencies: []
modified_files:
  - lib/chunk.js
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recursive character splitter with configurable chunk size and overlap. Breaks text hierarchically on paragraph breaks, newlines, sentence endings, word boundaries, and hard-cuts as last resort. Merge step carries overlap forward to preserve cross-boundary context.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Splits on paragraph > line > sentence > word > hard-cut hierarchy
- [ ] #2 Configurable chunkSize (default 1000) and chunkOverlap (default 150)
- [ ] #3 Overlap carried forward so context is not lost at chunk boundaries
- [ ] #4 Validates chunkOverlap < chunkSize
<!-- AC:END -->
