---
id: CHAT-7
title: OpenRouter chat completion client (lib/openrouter.js)
status: Done
assignee: []
created_date: '2026-10-19 03:29'
labels:
  - core
  - llm
dependencies: []
modified_files:
  - lib/openrouter.js
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
OpenAI-compatible chat completion wrapper for OpenRouter API. Features configurable model/temperature/maxTokens, 50s timeout via AbortSignal, attribution headers (X-Title, HTTP-Referer), rate-limit aware error handling (429→429, else→502), truncation warnings, and chain-of-thought stripping for free reasoning models.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Calls OpenRouter chat completions with configurable model, temperature, maxTokens
- [ ] #2 50s AbortSignal timeout prevents hanging requests
- [ ] #3 Rate-limit errors (429) passed through; other failures become 502
- [ ] #4 Chain-of-thought <think> tags stripped from free reasoning model outputs
<!-- AC:END -->
