---
id: CHAT-27
title: Support Qdrant vector database alongside Pinecone with Docker Compose setup
status: Done
assignee: []
created_date: '2026-10-19 04:02'
updated_date: '2026-10-19 04:07'
labels:
  - docker
  - qdrant
  - pinecone
  - architecture
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Docker Compose support with local Qdrant container and multi-vector-db abstraction switchable via VECTOR_DB env variable (pinecone | qdrant) while completely preserving the current Pinecone setup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 VECTOR_DB environment variable switches between 'pinecone' (default) and 'qdrant'
- [x] #2 Qdrant vector store implementation supports upsert, query, pagination, and deletion via Qdrant REST API with deterministic UUIDs
- [x] #3 Dockerfile and docker-compose.yml provide a one-command free local setup with app and Qdrant container
- [x] #4 Existing Pinecone setup, Vercel serverless compatibility, and offline checks continue to work without regression
- [x] #5 Documentation in docs/ and AGENTS.md updated with Docker Compose and Qdrant configuration
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented dual vector store support switchable via VECTOR_DB (pinecone | qdrant) with unified vector store factory in lib/vector-store.js, zero-dependency Qdrant REST client with deterministic UUIDs in lib/qdrant.js, Dockerfile and docker-compose.yml for 100% free local containerized setup, updated health endpoint, create-index script, .env.example, docs/deployment-and-configuration.md, docs/architecture-overview.md, and AGENTS.md while fully preserving existing Pinecone and Vercel workflows.
<!-- SECTION:FINAL_SUMMARY:END -->
