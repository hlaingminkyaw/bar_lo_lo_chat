---
id: CHAT-39
title: >-
  Multi-tenant Messenger: per-page shop config, namespace isolation, per-shop
  history
status: Done
assignee: []
created_date: '2026-10-21 04:35'
updated_date: '2026-10-21 04:47'
labels:
  - api
  - messenger
  - multi-tenant
  - rag
  - redis
dependencies: []
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Serve several Facebook Pages (online shops) from one backend. Each page ID maps to a shop in config/shops.json (shopId, shopName, namespace, pageAccessToken, maxTokens, customPrompt). The webhook routes by recipient.id, answers from that shop's vector namespace only, uses the shop's page token and prompt, and keeps Messenger history per shop+sender in Redis. Ingestion paths accept a namespace so each shop's documents can be loaded separately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 config/shops.json maps page IDs to shop configs; pageAccessToken can name an env var so tokens stay out of git; invalid or duplicate config fails loudly
- [x] #2 POST /api/webhook routes each event by recipient.id; unknown page IDs are ignored with 200 and no Send API call
- [x] #3 Replies use the matched shop's page access token, customPrompt and maxTokens
- [x] #4 answerQuestion retrieval is scoped to the shop namespace (Pinecone namespace; Qdrant filter and point IDs are namespace-scoped too)
- [x] #5 Messenger history is stored at chat:fb:<shopId>:<senderId>, last 4 messages, 1-hour TTL; Redis failures degrade to no history
- [x] #6 /api/upload and /api/ingest accept ?namespace=, npm run ingest accepts --namespace=<ns>, --namespace <ns> and --shop=<shopId>
- [x] #7 Docs updated with how to add a new shop page; npm run check passes with new offline tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added config/shops.json + lib/shops.js (validated, pageAccessToken = env var name), tenant routing in api/webhook.js, customPrompt/maxTokens in answerQuestion, Messenger history chat:fb:<shopId>:<senderId>, namespace-scoped Qdrant IDs/filters, ?namespace= on upload/ingest, --namespace/--shop on CLI, vercel includeFiles config/**. Live test showed RULES.md identity/REMAX contact overriding shop prompts (Store B leaked REMAX phone numbers), so RULES.md identity+contact moved into a tenant-identity block that rag.js swaps for the shop customPrompt; re-test: each shop answers with its own name, no cross-shop contact leak, web chat unchanged. Verified: npm run check, dev-server webhook run (unknown page ignored, missing token logged, REMAX routed with its token), namespace-scoped retrieval (shop namespaces currently empty), CLI flag errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Multi-tenant Messenger: page ID → shop config in config/shops.json; webhook routes by recipient.id (unknown pages ignored with 200), answers from the shop's namespace with its customPrompt/maxTokens/page token, and keeps history at chat:fb:<shopId>:<senderId> (4 msgs, 1h TTL). RULES.md identity/contact moved into a swappable tenant-identity block to stop cross-shop identity/contact leaks. Ingestion accepts ?namespace= and --namespace/--shop. Qdrant made namespace-safe. Docs: docs/multi-tenant-shops.md plus updates. npm run check passes.
<!-- SECTION:FINAL_SUMMARY:END -->
