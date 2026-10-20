---
id: CHAT-38
title: Restore web chat history on page load
status: Done
assignee: []
created_date: '2026-10-20 09:01'
updated_date: '2026-10-20 09:04'
labels:
  - backend
  - frontend
  - redis
dependencies: []
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add GET /api/history?sessionId=... returning the stored Redis messages for a web session, and have public/index.html render them as chat bubbles on load so a reload keeps the visible conversation. Keeps the existing 4-message Redis limit and no-history fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/history validates sessionId with isValidSessionId and returns { history } from getHistory
- [x] #2 Invalid/missing sessionId or Redis failure returns { history: [] } with 200
- [x] #3 index.html renders stored messages in order on load, hides the welcome hero and chips, and scrolls to bottom
- [x] #4 Clear still resets the UI and rotates sessionId; a fetch finishing after the user starts typing does not overwrite the thread
- [x] #5 npm run check passes and docs cover the new endpoint
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added api/history.js (GET /api/history?sessionId=...) returning { history } via getHistory, empty on invalid/unknown session or Redis failure, Cache-Control no-store; registered in dev server. index.html loads history on startup, renders bubbles oldest-first, hides hero, scrolls to bottom, and skips rendering if the user already sent a message or pressed Clear. Smoke test covers the endpoint; README and docs/api-reference.md updated. Verified in headless Chrome: 3 questions -> reload shows last 2 exchanges; Clear + reload shows welcome screen.
<!-- SECTION:FINAL_SUMMARY:END -->
