---
id: CHAT-33
title: Update OpenRouter free models and handle discontinued free model fallbacks
status: Done
assignee: []
created_date: '2026-10-19 04:33'
updated_date: '2026-10-19 04:37'
labels:
  - ai
  - openrouter
  - bugfix
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix 502/404 errors when using OpenRouter free models by updating the default model and fallback list to currently active OpenRouter free models (such as nvidia/nemotron-3.5-lightning:free and nvidia/nemotron-3.5-super-vl:free), and enhancing the fallback logic to catch 404/discontinued model responses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Update default free model and openrouterFreeFallbacks in lib/config.js with active working free models
- [x] #2 Update vision model default to active multimodal free model nvidia/nemotron-3.5-super-vl:free
- [x] #3 Enhance chatCompletion fallback in lib/ai.js to treat 404 discontinued free model errors as fallback triggers and support reasoning output extraction
- [x] #4 Update .env and .env.example with current working free models
- [x] #5 Verify with npm run check and live chat completion test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated default OpenRouter free models to active working endpoints (nvidia/nemotron-3-ultra-550b-a55b:free, nvidia/nemotron-3.5-super-vl:free). Enhanced chatCompletion in lib/ai.js to catch 404 discontinued free models and rotate to next free fallback. Rebuilt Docker container and verified live chat completion with status 200 and natural Burmese output.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced deprecated/discontinued OpenRouter free model slugs with active free endpoints (nvidia/nemotron-3-ultra-550b-a55b:free, nvidia/nemotron-3.5-super-vl:free). Hardened lib/ai.js chatCompletion fallback so any free model error (including 404 discontinued) triggers the next free candidate. Rebuilt Docker container and validated live /api/chat endpoint returning status 200 with Burmese response.
<!-- SECTION:FINAL_SUMMARY:END -->
