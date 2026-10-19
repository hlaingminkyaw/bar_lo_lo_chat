---
id: CHAT-1
title: Project initialization & configuration
status: Done
assignee: []
created_date: '2026-10-19 03:28'
labels:
  - setup
  - config
dependencies: []
modified_files:
  - package.json
  - vercel.json
  - .env.example
  - .gitignore
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up the BarLoLo Chat RAG backend project with Node.js 22, ESM modules, Vercel serverless deployment, and all core dependencies (Pinecone SDK, mammoth, multer, pdf-parse, pdfjs-dist, xlsx). Includes package.json, vercel.json, .env.example, and .gitignore.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 package.json defines all dependencies and scripts (dev, setup-index, ingest, check)
- [ ] #2 vercel.json configures function routing and 60s timeout
- [ ] #3 .env.example documents all environment variables
- [ ] #4 .gitignore excludes node_modules and .env
<!-- AC:END -->
