---
id: CHAT-34
title: Add RULES.md to project root and load RAG rules dynamically into chatbot
status: Done
assignee: []
created_date: '2026-10-19 04:52'
updated_date: '2026-10-19 04:54'
labels:
  - rag
  - rules
  - prompt
  - ai
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create RULES.md at project root containing all chatbot RAG rules (persona, reference knowledge grounding, strict no inline citations, language standards, support escalation). Update lib/rag.js to load rules dynamically from RULES.md so the AI model reads the rules first and obeys them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create RULES.md at project root with complete RAG rules and constraints
- [x] #2 Update lib/rag.js to load rules dynamically from RULES.md with fallback
- [x] #3 Ensure Dockerfile copies RULES.md for container runtime
- [x] #4 Verify with npm run check and test live RAG answer
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created RULES.md at project root containing full persona, grounding, strict citation prohibition, language/Unicode, and escalation rules. Integrated dynamic loader in lib/rag.js and updated Dockerfile and AGENTS.md. Verified with npm run check and live /api/chat invocation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added RULES.md at project root with complete RAG rules for the chatbot. Configured lib/rag.js to dynamically load RULES.md on every question before answering. Added COPY RULES.md to Dockerfile, updated AGENTS.md, and verified live chat responses.
<!-- SECTION:FINAL_SUMMARY:END -->
