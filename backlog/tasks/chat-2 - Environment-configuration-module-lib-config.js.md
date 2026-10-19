---
id: CHAT-2
title: Environment configuration module (lib/config.js)
status: Done
assignee: []
created_date: '2026-10-19 03:28'
labels:
  - core
  - config
dependencies: []
modified_files:
  - lib/config.js
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Central configuration module using lazy getters for all environment variables. Supports Pinecone (API key, index, namespace), OpenRouter (API key, model), vision model, embedding provider/model selection, chunking params, CORS, and app metadata. Includes ConfigError class for missing required vars.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All env vars accessed through lazy getters with sensible defaults
- [ ] #2 ConfigError thrown for missing required vars (PINECONE_API_KEY, PINECONE_INDEX, OPENROUTER_API_KEY)
- [ ] #3 Supports both Pinecone and OpenRouter embedding providers
- [ ] #4 Default model is openai/gpt-4o-mini, vision model is google/gemini-2.5-flash
<!-- AC:END -->
