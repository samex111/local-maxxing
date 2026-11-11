# Local-Maxxing

**Developer intelligence infrastructure for shipping real projects.**

Local-Maxxing is a local-first research and project-continuity layer for coding agents. It helps an existing coding harness such as OpenCode move from project understanding to researched, incremental, tested implementation — and resume cleanly across sessions.

## MVP architecture

See **[docs/MVP_ARCHITECTURE.md](docs/MVP_ARCHITECTURE.md)** for the product boundaries, architecture, project state format, session workflow, MCP tools, OpenCode integration, security boundaries, milestones and acceptance criteria.

## Core principle

- **OpenCode** owns the coding loop, source edits and terminal execution.
- **NVIDIA NIM** supplies model inference to OpenCode.
- **Local-Maxxing** owns persistent project state, research capture, task sequencing and session handoffs.
- **SearXNG** finds sources; **Crawl4AI** extracts them.
- **Git** keeps the project history reviewable and recoverable.

Local-Maxxing is not a second coding agent. The MVP focuses on verified project progress per development session, not agent count or autonomy for its own sake.

## Current status

Architecture is documented. Implementation has not started yet.

## MVP milestones

1. Project continuity: initialize project state, resume sessions, select one task, and record handoffs.
2. Research integration: connect SearXNG and Crawl4AI; save source-backed research in the project.
3. Verification discipline: record test evidence and validate real user journeys.

## Design constraints

- Local-first and single-developer to start.
- One TypeScript MCP server; no monorepo initially.
- JSON and Markdown project state; no database in v1.
- No vector database, queue, dashboard, multi-agent system or autonomous shell execution in v1.
- Preserve existing project instructions and source code.
