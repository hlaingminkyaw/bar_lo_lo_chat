---
id: CHAT-31
title: Support configurable AI provider via AI_PROVIDER in environment
status: Done
assignee: []
created_date: '2026-10-19 04:18'
updated_date: '2026-10-19 04:22'
labels:
  - ai-provider
  - llm
  - config
  - architecture
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to choose the LLM/AI provider via AI_PROVIDER in .env (supporting openrouter, gemini/google, openai, groq, ollama, and custom endpoints) with automatic base URLs, provider-specific API keys, and default models, while preserving existing OpenRouter behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AI_PROVIDER environment variable selects the AI backend (openrouter, gemini, openai, groq, ollama, custom)
- [x] #2 Unified chatCompletion client dispatches to the selected provider's OpenAI-compatible endpoint with correct headers and credentials
- [x] #3 lib/config.js provides provider defaults for API keys, base URLs, chat models, and vision OCR models
- [x] #4 Health check endpoint api/health.js reports the active AI provider and credential status
- [x] #5 Documentation in docs/ and AGENTS.md updated with AI_PROVIDER configuration
- [x] #6 npm run check passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented configurable AI_PROVIDER (openrouter, gemini, openai, groq, ollama, custom) with universal OpenAI-compatible client in lib/ai.js, provider configuration defaults in lib/config.js, health reporting in api/health.js, docker-compose.yml environment propagation, and comprehensive documentation in docs/ and AGENTS.md.
<!-- SECTION:FINAL_SUMMARY:END -->
