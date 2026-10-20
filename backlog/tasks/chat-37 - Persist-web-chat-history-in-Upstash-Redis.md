---
id: CHAT-37
title: Persist web chat history in Upstash Redis
status: Done
assignee: []
created_date: '2026-10-20 08:05'
updated_date: '2026-10-20 08:14'
labels:
  - backend
  - frontend
  - redis
dependencies: []
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web chat (public/index.html -> POST /api/chat) sends a persistent localStorage sessionId; the server keeps the last 4 messages (2 user + 2 assistant) per session in Upstash Redis under chat:session:<sessionId> with a 1-hour TTL and feeds them into the RAG prompt. Messenger (/api/webhook) stays stateless. Redis failures must never break answering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 public/index.html stores a sessionId in localStorage and sends { message, sessionId } to /api/chat
- [x] #2 lib/redis.js fetches the last 4 messages and appends user+assistant turns with a 3600s TTL using @upstash/redis
- [x] #3 api/chat.js loads history by sessionId, passes it to answerQuestion, and saves the new turn
- [x] #4 Missing or failing Redis falls back to answering without history
- [x] #5 Messenger webhook does not use Redis history
- [x] #6 npm run check passes and docs/.env.example document the new variables
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added lib/redis.js (@upstash/redis) storing the last 4 messages per web session under chat:session:<sessionId> with a 3600s TTL, 2s request timeout and swallow-on-error fallback. api/chat.js loads history by sessionId, passes it to answerQuestion, and saves the turn via waitUntil; explicit body.history still works without sessionId. public/index.html persists sessionId in localStorage and Clear rotates it. Messenger untouched. Docs, README and .env.example updated; npm run check passes; unreachable-Redis fallback verified manually.
<!-- SECTION:FINAL_SUMMARY:END -->
