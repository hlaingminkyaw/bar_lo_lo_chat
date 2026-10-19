# Agent Rules & Guidelines: BarLoLo Chat

All AI agents working on this project must strictly comply with the following rules.

---

## 1. Task Management Rules (Backlog.md)

All tasks must strictly follow the official Backlog.md workflow and standards (`https://github.com/MrLesk/Backlog.md.git`).

### 1.0 Golden Rule: Always Create a Task Before ANY Code Change
> **CRITICAL MANDATE: ZERO CODE CHANGES WITHOUT AN ACTIVE TASK.**
> - You **MUST ALWAYS** create a Backlog task **BEFORE** writing or modifying any code or project files.
> - Even for minor fixes, documentation updates, or refactors, creating a task is non-negotiable.
> - **The Strict Sequence**:
>   1. **Create Task**: Run `backlog task create` with a clear title, description (`-d`), acceptance criteria (`--ac`), and `-s "In Progress"`.
>   2. **Execute Changes**: Modify the code according to the task scope.
>   3. **Verify**: Test changes and verify with `npm run check`.
>   4. **Mark Done & Archive**: Edit status to `Done` with `--final-summary`, then run `backlog task complete <taskId>`.

### 1.1 Four-Step Task Creation Process
1. **Search First**:
   - Always check if the work is already tracked before creating a task:
     ```bash
     backlog search "<keyword>" --plain
     backlog task list --status "To Do" --plain
     ```
2. **Assess Scope**:
   - Determine if the work is a single atomic task or a multi-task feature requiring subtasks (`-p <parentTaskId>`) or sequential dependencies (`--dep <taskId>`).
3. **Structured Task Definition**:
   - Every task **must** include:
     - Clear, actionable title.
     - Description (`-d` / `--description`) explaining the outcome and why it matters.
     - Acceptance criteria (`--ac`) that are testable, specific, and independent.
     - Appropriate labels (`-l`) and priority (`--priority high|medium|low`).
   - Standard creation command:
     ```bash
     backlog task create "<Title>" \
       -d "<Clear description explaining outcome and context>" \
       -s "In Progress" \
       --priority high \
       -l "<comma-separated-labels>" \
       --ac "<Specific testable criterion 1>" \
       --ac "<Specific testable criterion 2>" \
       --plain
     ```
4. **Subtasks & Dependencies**:
   - For complex features, use parent-child relationships:
     ```bash
     backlog task create -p CHAT-10 "Child task title" -d "..." --ac "..." --plain
     ```
   - For sequential blockers:
     ```bash
     backlog task create "Subsequent task" --dep CHAT-11 -d "..." --ac "..." --plain
     ```

### 1.2 Execution & Progress Tracking
- Record implementation plans for non-trivial work:
  ```bash
  backlog task edit <taskId> --plan "1. Step one\n2. Step two"
  ```
- Track progress notes and check off acceptance criteria as completed:
  ```bash
  backlog task edit <taskId> --append-notes "Implemented feature and verified tests"
  backlog task edit <taskId> --check-ac 1
  ```

### 1.3 Completion & Archiving
1. Mark status as `Done` and record a concise, descriptive final summary:
   ```bash
   backlog task edit <taskId> -s "Done" --final-summary "Summary of changes and verification" --plain
   ```
2. **Move Completed Tasks to `backlog/completed/`**:
   - Immediately archive terminal-status tasks using the completion CLI:
     ```bash
     backlog task complete <taskId>
     ```
   - Never leave completed tasks sitting in `backlog/tasks/`.
3. **Never Edit Markdown Files Directly**:
   - Never edit files in `backlog/tasks/`, `backlog/drafts/`, or `backlog/completed/` manually. Always use Backlog CLI commands so metadata, timestamps, and indexes stay consistent.

---

## 2. Documentation Rules

1. **Documentation Directory**:
   - When the user asks for "docs" or when creating technical documentation, **always create files under the project root `docs/` (`<project-root>/docs/`)**.
   - **DO NOT create documentation inside `backlog/docs/`**.
2. **README.md Location**:
   - **DO NOT put `README.md` inside `docs/`**.
   - `README.md` must stay exclusively at the project root (`./README.md`).
3. **Keep Docs Maintained**:
   - Place all necessary specifications, guides, and architectural references in `docs/` (e.g., `docs/architecture-overview.md`, `docs/api-reference.md`, `docs/deployment-and-configuration.md`, `docs/data-ingestion-and-knowledge-base.md`).

---

## 3. Technology Stack & Coding Standards

1. **Environment & Runtime**:
   - Node.js 20+ with native ES Modules (`import/export` syntax).
   - Serverless Functions located in `api/*.js`, deployed on Vercel with a 60-second execution limit (`vercel.json`).
   - Shared business logic and utilities in `lib/*.js`.
   - Local automation and CLI tooling in `scripts/*.js`.
2. **Vector DB (Pinecone & Qdrant)**:
   - Configurable via `VECTOR_DB=pinecone` (default) or `VECTOR_DB=qdrant`.
   - **Pinecone**: Serverless index on `aws/us-east-1` (dimension 1024 for `llama-text-embed-v2` or 1536 for `text-embedding-3-small`).
   - **Qdrant**: Local container via `docker compose up -d` (zero-cost setup) or Qdrant Cloud. Points use deterministic UUIDs mapped to `_recordId`.
   - Embeddings must separate query embedding (`input_type: "query"`) from document chunk embedding (`input_type: "passage"`).
   - Ingestion must use deterministic document IDs (`upload_<slug>_<hash>`) to allow idempotent replacements.
3. **LLM & Vision (Pluggable AI_PROVIDER)**:
   - Configurable via `AI_PROVIDER=openrouter` (default), `gemini`, `openai`, `groq`, `ollama`, or `custom`.
   - Dispatches requests using standard OpenAI-compatible completions format.
   - For OpenRouter, supports free models via `USE_FREE_MODELS=true` or `:free` model IDs with automatic rate-limit fallbacks.
   - Image OCR model defaults to `google/gemini-2.5-flash` or `google/gemini-2.0-flash-lite:free` (`VISION_MODEL`) for accurate Burmese script reading.
4. **Language & Punctuation (Burmese Unicode)**:
   - Strict standard Myanmar Unicode (U+1000–U+109F) only. Never use or generate Zawgyi.
   - Text chunking must respect Burmese sentence punctuation (`။` - U+104B and `၊` - U+104A).
   - Output token limits (`MAX_TOKENS`) must be at least 4096 due to higher token consumption of Burmese script.
5. **No Inline Citations**:
   - Answers generated for users must be direct, polite, conversational, and natural.
   - Never output inline bracketed citations like `[1]`, `(1)`, `[၁]`, or `(၁)` in answer text.
   - Sources are provided exclusively via the structured `sources` array in API responses.
6. **Upload Limits**:
   - Keep file uploads under `MAX_UPLOAD_MB` (default 4 MB) to prevent exceeding Vercel's 4.5 MB request payload limit.
7. **Chatbot System Rules (`RULES.md`)**:
   - The authoritative rules and system instructions for the RAG chatbot are defined in `./RULES.md` at project root.
   - The chatbot AI model dynamically loads `./RULES.md` at runtime before answering any user question.
   - Any AI agent or developer modifying prompts, personas, or RAG behavior MUST read and obey `./RULES.md`.

---

## 4. Verification & Testing

- Before concluding any coding task, verify offline sanity checks using:
  ```bash
  npm run check
  ```
- Verify git status to ensure untracked files or scratch files are cleaned up:
  ```bash
  git status --short
  ```
