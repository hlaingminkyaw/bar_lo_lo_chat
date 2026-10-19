---
id: CHAT-19
title: Smoke test script (scripts/smoke-test.js)
status: Done
assignee: []
created_date: '2026-10-19 03:31'
labels:
  - tooling
  - testing
dependencies: []
modified_files:
  - scripts/smoke-test.js
priority: low
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Offline sanity check script (npm run check). Tests chunking, config loading, and module imports without requiring API keys or network access.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Runs without API keys or network access
- [ ] #2 Validates chunking logic and module imports
<!-- AC:END -->
