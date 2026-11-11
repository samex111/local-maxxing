# Local-Maxxing MVP Architecture

**Status:** Proposed MVP  
**Product:** Local-first developer project execution infrastructure  
**Primary coding harness:** OpenCode  
**Model provider:** NVIDIA NIM (configured in OpenCode)  
**Interface:** Model Context Protocol (MCP)

## 1. The problem we are solving

Coding agents can write code, but real projects are not single prompts. They require discovery, current technical research, sensible decomposition, implementation, end-to-end verification, and continuity across sessions.

Our target failure modes are:

1. The agent tries to build too much in one session.
2. A new session loses the reasoning behind earlier work.
3. The agent chooses work that is not the highest-priority unfinished feature.
4. The agent confuses "code was written" with "the feature works".
5. Research is repeated, shallow, or disconnected from the implementation.
6. The project is left in a broken or undocumented state.

**MVP outcome:** A developer can open a real repository in OpenCode, get a grounded next task, research unfamiliar implementation details, build one small feature, verify it, save a useful handoff, close the session, and resume later without reconstructing the project history manually.

Local-Maxxing is not another coding agent. It is the project-state and research layer around an existing coding harness.

## 2. Product boundaries

### What each component does

| Component | Responsibility |
|---|---|
| OpenCode | The agent harness: reads and edits code, runs terminal commands, manages the coding loop and uses MCP tools. |
| NVIDIA NIM | Model inference for OpenCode. Select a model with reliable tool calling, streaming and sufficient context for the coding workload. |
| Local-Maxxing MCP server | Project bootstrap, structured task state, session handoffs, research tools and source storage. |
| SearXNG | Searches the web and returns candidate sources. |
| Crawl4AI | Fetches selected pages and extracts readable Markdown and metadata. |
| Git | Version history and durable checkpoints for both code and project state. |

**Important decision:** In v1, Local-Maxxing does not run its own autonomous LLM loop and does not call NVIDIA NIM separately. OpenCode already has the model and agent loop. The agent decides what to search, interprets results, plans the feature and writes code. Local-Maxxing gives it reliable tools and persistent state. This avoids building two competing orchestrators and paying for duplicate model calls.

NVIDIA NIM is configured as an OpenCode provider, not as a dependency of the MCP server. NIM exposes an OpenAI-compatible chat-completions API; OpenCode documents custom OpenAI-compatible providers and configurable endpoints. Model-level tool-calling behavior must still be tested before choosing a model.

## 3. MVP architecture

\`\`\`text
                         Developer
                             |
                             v
                    OpenCode + NVIDIA NIM
                    (the coding agent loop)
                      /       |        \\
                     /        |         \\
          Native file/    MCP tools    Native terminal /
          repo editing       |        browser testing
                             v
                  Local-Maxxing MCP Server
                    /          |          \\
                   /           |           \\
          Project State    Research API    Workspace Guard
             Adapter        Adapters       (path policy)
                |              |
                v          +---+---+
         .local-maxxing/   |       |
         inside each repo  v       v
                        SearXNG  Crawl4AI
                        search   extraction
                            \     /
                             \   /
                       saved source files
                       in project research/
                             |
                             v
                       Git checkpoint
\`\`\`

### Design principle

- **OpenCode owns execution.** It edits application code and runs project commands using its existing tools.
- **Local-Maxxing owns continuity.** It maintains the project manifest, feature backlog, decisions, research sources and session handoff.
- **Research remains evidence-based.** Search finds sources; crawling extracts them; the coding agent uses the source material to make decisions.
- **The repository is the source of truth.** Project state lives in files inside the project and can be inspected, versioned and reviewed in Git.

## 4. The project workspace contract

Each repository initialized with Local-Maxxing gets a tracked directory:

\`\`\`text
your-project/
├── .local-maxxing/
│   ├── project.json
│   ├── features.json
│   ├── progress.md
│   ├── decisions.md
│   └── research/
│       ├── index.md
│       └── sources/
│           └── <source-id>.md
└── ... existing application code ...
\`\`\`

Do not move or duplicate the application's source code into Local-Maxxing.

### project.json

Contains the project goal, current state, stack discovered from the repository, important constraints, test/build commands, and links to the key project documents. It should describe the project, not contain a transcript of every agent conversation.

### features.json

The structured backlog. Each feature/task should be small enough to complete and verify in one focused coding session. Large features must be split into smaller vertical slices.

Suggested record:

\`\`\`json
{
  "id": "AUTH-001",
  "title": "User can sign in with valid credentials",
  "objective": "Complete one observable user capability",
  "priority": 1,
  "status": "ready",
  "dependsOn": [],
  "acceptanceCriteria": [
    "A user can submit valid credentials",
    "The application navigates to the authenticated area",
    "An invalid credential displays a useful error"
  ],
  "verification": [
    "Run the relevant authentication tests",
    "Exercise the login flow in a browser"
  ],
  "evidence": []
}
\`\`\`

Allowed task states:

- \`backlog\`: not ready to start.
- \`ready\`: dependencies are satisfied and the task can be selected.
- \`in_progress\`: currently being implemented.
- \`blocked\`: a dependency or external decision prevents progress.
- \`implemented\`: code has been written, but verification is not yet recorded.
- \`verified\`: acceptance criteria have been tested and evidence has been recorded.
- \`deferred\`: intentionally moved out of the current scope.

Never mark a task \`verified\` just because files changed or the model says it is done. Record the verification command or user journey, its result, and any relevant output or screenshot path. In v1 this is auditable agent-reported evidence; it is not cryptographic proof that a test ran. A dedicated verification runner can be added later.

### progress.md

The latest session handoff, not a chat transcript. Keep it short and actionable:

- What was completed in this session.
- What was tested and what failed.
- Current branch and relevant commit.
- Known blockers or risky areas.
- Exact next task and first suggested action.

### decisions.md

Record durable architectural and product decisions with the reason, date and consequences. Do not re-open settled decisions every session without new evidence.

### research/

Store the full extracted source material and concise research notes close to the project that uses them. Preserve the original URL, page title, retrieval date and extraction status. This makes implementation decisions reviewable and prevents the next session from repeating the same research.

## 5. The session workflow

### A. First session: initialize

1. Developer opens the target repository in OpenCode and provides the product goal and constraints.
2. OpenCode inspects the existing repository: README, package manifests, source structure, Git status and available tests.
3. The model proposes a project brief, feature breakdown, acceptance criteria and verification plan.
4. The developer reviews the scope before it is written.
5. Local-Maxxing validates and creates the \`.local-maxxing/\` files.
6. OpenCode runs baseline checks and records the starting Git state.

The initializer should not blindly generate 200 speculative features. It should create a realistic, prioritized MVP backlog. Requirements not grounded in the brief or repository must be marked as assumptions or questions.

### B. Every subsequent session: resume and build

1. Call \`get_project_context\` to load project facts, latest handoff, decisions and Git status.
2. Call \`get_next_task\` to select one ready task by priority and dependency order.
3. Run the project's baseline checks before changing code when practical.
4. Research only the unknowns that affect the selected task. Prefer official documentation, release notes and relevant issue discussions.
5. Implement one vertical slice. Do not start unrelated features.
6. Run the relevant tests and, for user-facing behavior, exercise the actual browser flow using the available browser automation.
7. Record evidence and update the task to \`implemented\` or \`verified\`.
8. Update the session handoff and make a descriptive Git commit when the working tree is clean.

If the feature cannot be completed safely in one session, split it and leave the current branch in a coherent state. Do not claim the entire project is complete because a few features pass.

## 6. MCP tool surface for v1

Keep the server small. These are the initial tools:

| Tool | Purpose |
|---|---|
| \`initialize_project\` | Validate and write a reviewed project manifest and initial feature backlog. |
| \`get_project_context\` | Return project summary, current task, latest handoff, decisions and check commands. |
| \`get_next_task\` | Return the highest-priority ready task with acceptance criteria and dependencies. |
| \`update_task\` | Change task state and append implementation notes; prevent invalid state transitions. |
| \`record_verification\` | Store test commands, results, summaries and evidence paths for a task. |
| \`record_handoff\` | Write the concise end-of-session summary and recommended next action. |
| \`web_search\` | Query SearXNG and return ranked results with URLs and snippets. |
| \`crawl_urls\` | Use Crawl4AI to extract selected pages, save full Markdown under project research, and return compact source references. |
| \`read_source\` | Retrieve a saved source or a bounded section without flooding the model context. |

Tools should return compact, structured responses. Full page contents belong in files and are fetched through \`read_source\` when needed. Do not return dozens of entire crawled pages in a single MCP response.

### What is deliberately not an MCP tool in v1

- Editing application source code: OpenCode already does this.
- Arbitrary shell execution: OpenCode already has terminal capabilities and permission controls.
- Git commit/push/deploy: use OpenCode's native tools and normal approval workflow.
- Browser automation: reuse an existing browser/Playwright integration.
- A second autonomous coding agent: unnecessary until the single-agent workflow is reliable.

## 7. Minimal implementation stack

| Area | MVP choice | Reason |
|---|---|---|
| Runtime | Node.js + TypeScript | Matches the user's existing development stack and works well for a local MCP process. |
| MCP | Official MCP TypeScript server SDK | Standard tool interface; keep the core independent from OpenCode. |
| Validation | Zod schemas | Validate all tool inputs and persisted project state. |
| Project storage | JSON + Markdown files in \`.local-maxxing/\` | Transparent, Git-versioned and sufficient for the first user/project workflow. |
| Search | Existing SearXNG HTTP API | Reuse the user's running search service. |
| Extraction | Existing Crawl4AI REST API | Reuse the user's running crawler; authenticate with its bearer token. |
| Model | NVIDIA NIM through OpenCode | Avoid a second model client and agent loop in v1. |
| Tests | Unit tests + MCP integration tests | Verify task selection, state transitions, path safety and service adapters. |

**No database in v1.** SQLite becomes useful when we need cross-project dashboards, queryable research history, job queues or analytics. It is not required to preserve one project's state across sessions.

**No queue in v1.** Synchronous search and crawling are enough to prove the first workflow. Add a durable worker only when real research jobs regularly exceed a normal tool-call window.

**No vector database in v1.** First make source capture, metadata, project notes and exact retrieval useful. Add semantic retrieval only when real usage shows that file-based retrieval is insufficient.

## 8. Initial repository layout

Keep the implementation as one TypeScript application. Do not create a monorepo yet.

\`\`\`text
local-maxxing/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── config.ts
│   ├── tools/
│   │   ├── project.ts
│   │   ├── tasks.ts
│   │   └── research.ts
│   ├── core/
│   │   ├── project-manifest.ts
│   │   ├── task-selector.ts
│   │   ├── state-transitions.ts
│   │   └── workspace-guard.ts
│   ├── adapters/
│   │   ├── searxng.ts
│   │   └── crawl4ai.ts
│   └── storage/
│       └── project-files.ts
├── tests/
│   ├── task-selector.test.ts
│   ├── state-transitions.test.ts
│   ├── workspace-guard.test.ts
│   └── adapters/
├── docs/
│   └── MVP_ARCHITECTURE.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
\`\`\`

## 9. Security and reliability boundaries

This server can read and write project state, and it can fetch arbitrary web content unless constrained. Treat both as real trust boundaries.

1. **Workspace allowlist:** Configure one or more allowed root directories. Resolve every project path and reject traversal or symlink escapes outside an allowed root.
2. **Narrow write access:** Local-Maxxing writes only to the project's \`.local-maxxing/\` directory. OpenCode remains responsible for application source-code changes.
3. **Crawler SSRF protection:** Accept only HTTP/HTTPS URLs. Reject localhost, private, link-local and otherwise non-public IP destinations by default; re-check redirects and resolved addresses. Never let a search result silently authorize access to a local service.
4. **Secrets:** Keep NIM and Crawl4AI tokens in environment variables, never in project state, logs, Git or MCP tool responses.
5. **No arbitrary command runner:** Do not add an unrestricted shell tool to Local-Maxxing. Use OpenCode's existing command approval model.
6. **Untrusted web content:** Treat crawled pages, repository issues and snippets as data, not instructions. They must never override system, developer or user instructions.
7. **Backups and recovery:** Persist state atomically (write temporary file then rename), validate JSON before use and rely on Git history for recovery.
8. **Human review:** The developer approves the initial feature plan and all destructive actions, deployment, credential changes and external writes.

## 10. Build sequence

### Milestone 1 — Project continuity (first working product)

- MCP server starts locally and connects to OpenCode.
- Initialize a repository with \`.local-maxxing/\` state.
- Read project context at the beginning of a session.
- Select one dependency-ready feature.
- Update task state and record a session handoff.
- Reopen OpenCode and resume from the saved state.

**Acceptance test:** Close the first OpenCode session after completing one feature. Start a new session in the same repository. The agent must identify the next correct task, explain what changed previously and avoid repeating completed work without relying on the previous chat transcript.

### Milestone 2 — Research in the coding loop

- Connect SearXNG.
- Connect authenticated Crawl4AI.
- Save extracted source Markdown and metadata into project research.
- Read saved sources by ID and keep MCP responses compact.
- Add source references to implementation decisions where relevant.

**Acceptance test:** Ask the agent to investigate an unfamiliar library/API. It finds relevant current sources, crawls the authoritative pages, saves them and uses the findings to implement one small feature.

### Milestone 3 — Verification discipline

- Add verification records to each feature.
- Require relevant test output or browser evidence before setting a feature to \`verified\`.
- Detect dirty working trees and failed checks during handoff.
- Test a full user journey with the existing browser automation integration.

**Acceptance test:** A feature with passing unit tests but a failing user journey stays unverified until the end-to-end failure is fixed.

## 11. Explicitly out of scope until the MVP proves useful

- Multiple autonomous coding, QA and reviewer agents.
- Long-running research queues and scheduled jobs.
- Redis, BullMQ, Postgres, vector databases or embeddings.
- A web dashboard and multi-user accounts.
- Automatic code edits outside OpenCode.
- Automatic commits, pushes, deployments or infrastructure changes.
- Cross-project global memory and analytics.

These are future options, not prerequisites.

## 12. MVP success metric

The MVP is successful when it helps ship a real feature in an existing project and makes the next session measurably easier to start.

Track these practical measures:

- Time from opening a repository to starting the correct next task.
- Number of sessions that repeat already-completed research or implementation.
- Percentage of completed tasks with recorded verification evidence.
- Number of sessions ending with a clean, documented handoff.
- Features that pass an actual user journey, not merely compile.

Do not optimize for agent count, tool count, token volume or autonomous runtime. Optimize for **verified project progress per development session**.

## References

- [OpenCode: Providers](https://opencode.ai/docs/providers/) — custom OpenAI-compatible providers and endpoint configuration.
- [OpenCode: Models](https://opencode.ai/docs/models/) — provider/model configuration.
- [NVIDIA NIM: LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis) — hosted LLM inference API.
- [Model Context Protocol: TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — official TypeScript server implementation.
- [Crawl4AI: Self-hosting](https://docs.crawl4ai.com/core/self-hosting/) — local REST service, authentication and API usage.
