---
id: CHAT-28
title: Support free OpenRouter models with smart defaults and rate-limit fallbacks
status: Done
assignee: []
created_date: '2026-10-19 04:09'
updated_date: '2026-10-19 04:11'
labels:
  - openrouter
  - free-models
  - llm
  - resilience
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable seamless use of free OpenRouter models (:free) for chat and vision OCR, with USE_FREE_MODELS toggle, recommended free model defaults (meta-llama/llama-3.3-70b-instruct:free and google/gemini-2.0-flash-lite:free), and automatic fallback across free models on 429 rate limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 config.openrouterModel and config.visionModel support USE_FREE_MODELS=true or direct :free model IDs
- [x] #2 lib/openrouter.js implements fallback handling across free models when 429 rate limits occur on :free models
- [x] #3 Updated .env.example, docker-compose.yml, and docs with recommended free model configurations
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented support for free OpenRouter models with USE_FREE_MODELS=true toggle, recommended high-performing free defaults (meta-llama/llama-3.3-70b-instruct:free for chat and google/gemini-2.0-flash-lite:free for vision OCR), automatic fallback across alternative free models upon 429 rate limits in lib/openrouter.js, and updated .env.example, docker-compose.yml, and docs.
<!-- SECTION:FINAL_SUMMARY:END -->
