# Local-Maxxing

**Local-first research and project continuity infrastructure for coding agents.**

Local-Maxxing helps an existing coding harness move from project understanding to researched, incremental, tested implementation — and resume cleanly across sessions.

## What it does

- Maintains a structured, dependency-aware feature backlog inside each project.
- Gives the agent a persistent project brief, decision log and session handoff.
- Records verification evidence against exact acceptance criteria.
- Connects to SearXNG for search and Crawl4AI for page extraction.
- Exposes the workflow through a local Model Context Protocol (MCP) server.

## What it does not do

Local-Maxxing is not a second coding agent. OpenCode owns code editing, terminal commands, browser automation and the coding loop. NVIDIA NIM is configured as OpenCode's model provider. Local-Maxxing provides project continuity and research tools; it does not proxy NIM requests, run tests, commit, push or deploy.

## Architecture and setup

- [MVP architecture](docs/MVP_ARCHITECTURE.md)
- [Getting started: Windows/macOS/Linux, SearXNG, Crawl4AI and OpenCode](docs/GETTING_STARTED.md)
- [Example OpenCode configuration](examples/opencode.jsonc)

## Quick start

Requires Node.js 20.11+ and pnpm 12. Install pnpm globally once with `npm install -g pnpm@12.18.0` (the project itself uses pnpm, not npm).

```powershell
pnpm install
Copy-Item .env.example .env
# Set LOCAL_MAXXING_ALLOWED_ROOTS and CRAWL4AI_API_TOKEN in .env
pnpm build
pnpm test
```

## MCP tools

| Tool | Purpose |
|---|---|
| `local_maxxing_initialize_project` | Create the project brief, feature backlog, progress/decision files and optional AGENTS.md protocol. |
| `local_maxxing_get_project_context` | Load project state, Git snapshot, progress, decisions and task counts. |
| `local_maxxing_get_next_task` | Resume the in-progress task or select the highest-priority ready task. |
| `local_maxxing_update_task` | Update task status with transition and dependency checks. |
| `local_maxxing_record_verification` | Record results against exact acceptance criteria. |
| `local_maxxing_record_handoff` | Persist a session handoff and next action. |
| `local_maxxing_web_search` | Search the configured SearXNG service. |
| `local_maxxing_crawl_urls` | Crawl public pages with Crawl4AI and save extracted Markdown into the project. |
| `local_maxxing_read_source` | Read a saved research source by ID. |

## Project state

Initialized repositories receive:

```text
.local-maxxing/
├── project.json
├── features.json
├── progress.md
├── decisions.md
├── AGENTS_SNIPPET.md        # only when AGENTS integration is declined
└── research/
    ├── index.md
    └── sources/
```

When requested, initialization merges a clearly marked Local-Maxxing protocol into the existing `AGENTS.md` without replacing unrelated instructions.

## Current limitations

- Verification is agent-reported, not independently executed or cryptographically attested.
- Crawl operations are synchronous and limited to a small URL batch.
- File-based state does not support concurrent writers to the same project.
- URL validation is defense-in-depth; isolate the crawler from private/internal networks.
- No vector database, queue, dashboard or multi-agent system in v1.

## License

MIT. See [LICENSE](LICENSE).
