---
id: CHAT-35
title: Add Facebook Messenger webhook (api/webhook.js)
status: Done
assignee: []
created_date: '2026-10-19 09:08'
updated_date: '2026-10-19 09:12'
labels:
  - api
  - messenger
  - integration
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let Messenger users chat with BarLoLo. GET /api/webhook answers Meta's verification handshake using FB_VERIFY_TOKEN; POST /api/webhook acknowledges Meta with 200 EVENT_RECEIVED immediately, then answers each text message with answerQuestion() (RAG over the vector DB) and replies via the Graph Send API using FB_PAGE_ACCESS_TOKEN. Existing endpoints must not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/webhook returns hub.challenge when hub.mode=subscribe and hub.verify_token matches FB_VERIFY_TOKEN, else 403
- [x] #2 POST /api/webhook responds 200 EVENT_RECEIVED before the RAG answer is generated, and Vercel keeps the background work alive
- [x] #3 Text messages are answered via answerQuestion() and sent through the Graph v21.0 Send API, split under Messenger's 2000-char limit
- [x] #4 Echoes, non-text events and non-page objects are ignored without errors
- [x] #5 /api/chat and /api/upload are unchanged; npm run check passes and loads the webhook handler
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added api/webhook.js (verify + page events), @vercel/functions waitUntil for post-response work, dev-server route, smoke test for splitMessage, env vars in .env.example and docs. Verified on a temp server: verify 200/403, non-page 404, echo ignored, real message acked in ~1ms then RAG answer + Send API call (fake token → logged 400).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Facebook Messenger webhook at /api/webhook: GET verification against FB_VERIFY_TOKEN, POST acks EVENT_RECEIVED immediately and answers text messages via answerQuestion() + Graph v21.0 Send API (markdown stripped, split at 2000 chars), kept alive on Vercel with waitUntil. /api/chat and /api/upload unchanged; npm run check passes.
<!-- SECTION:FINAL_SUMMARY:END -->
