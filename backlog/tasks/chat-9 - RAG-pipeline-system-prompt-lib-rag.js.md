---
id: CHAT-9
title: RAG pipeline & system prompt (lib/rag.js)
status: Done
assignee: []
created_date: '2026-10-19 03:29'
labels:
  - core
  - rag
  - llm
dependencies: []
modified_files:
  - lib/rag.js
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full RAG round-trip: embeds question, queries Pinecone top-k, builds system prompt with retrieved context, calls LLM. System prompt defines BarLoLo persona with Burmese/English bilingual support, strict no-citation rules, REMAX contact details policy, and language-matching behavior. Includes citation stripping regex and language-aware fallback answers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 retrieve() embeds question and queries Pinecone with topK, namespace, filter, minScore
- [ ] #2 System prompt defines BarLoLo persona with bilingual Burmese/English support
- [ ] #3 No-citation rules enforced: strips [1], (2), Burmese numeral brackets post-generation
- [ ] #4 Contact info only shown when bot cannot answer or user explicitly asks
- [ ] #5 History limited to last 6 turns to control token usage
<!-- AC:END -->
