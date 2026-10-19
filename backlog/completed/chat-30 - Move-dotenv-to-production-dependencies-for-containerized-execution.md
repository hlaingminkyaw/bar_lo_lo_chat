---
id: CHAT-30
title: Move dotenv to production dependencies for containerized execution
status: Done
assignee: []
created_date: '2026-10-19 04:16'
updated_date: '2026-10-19 04:17'
labels:
  - docker
  - dependencies
  - bugfix
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move dotenv from devDependencies to dependencies in package.json so scripts/dev-server.js can load when built with npm ci --omit=dev in Docker.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dotenv is listed under dependencies in package.json
- [x] #2 npm run check passes and Docker app container starts successfully without missing module errors
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved dotenv to production dependencies in package.json and verified that the Docker app container and Qdrant container run successfully in Docker Compose with healthy status on ports 3000 and 6333.
<!-- SECTION:FINAL_SUMMARY:END -->
