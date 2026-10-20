---
id: CHAT-36
title: Add concise length rules and strict not-found reply to chatbot RULES.md
status: Done
assignee: []
created_date: '2026-10-20 04:40'
updated_date: '2026-10-20 04:43'
labels:
  - rag
  - prompt
  - rules
dependencies: []
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Apply the BarLoLo Assistant customer-service prompt: concise answers by default (under 60-80 words, 1-3 sentences), longer answers up to 200 words only when the user asks for details/steps/all items, no introductory fluff, and a fixed Burmese reply when the answer is not in the reference knowledge. Replaces the old 'thorough and complete' guidance in RULES.md and keeps the DEFAULT_SYSTEM_PROMPT fallback in lib/rag.js consistent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 RULES.md identifies the bot as BarLoLo Assistant, a customer service AI
- [x] #2 RULES.md enforces concise default answers (under 60-80 words, 1-3 short sentences) and allows up to 200 words only on explicit request for details, steps, all items, or in-depth explanation
- [x] #3 RULES.md forbids introductory fluff and requires the exact reply 'အချက်အလက် မတွေ့ရှိပါခင်ဗျာ။' when the answer is not in the reference knowledge
- [x] #4 DEFAULT_SYSTEM_PROMPT fallback in lib/rag.js reflects the same rules
- [x] #5 npm run check passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
RULES.md now names the bot BarLoLo Assistant, adds Strict Token & Length Rules (concise 60-80 words / 1-3 sentences by default, up to 200 words on explicit request for details/steps/all items, no intro fluff), restricts answers to reference knowledge, and replaces the polite-decline + escalation behaviour with the fixed reply 'အချက်အလက် မတွေ့ရှိပါခင်ဗျာ။'. Support contacts are now shared only when the user asks for them. DEFAULT_SYSTEM_PROMPT fallback in lib/rag.js updated to match. npm run check passes.
<!-- SECTION:FINAL_SUMMARY:END -->
