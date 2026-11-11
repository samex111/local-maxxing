# Getting started

Run Local-Maxxing as a local MCP server for OpenCode on Windows, macOS or Linux.

## Requirements

- Node.js 20.11+ and npm.
- Git and OpenCode.
- SearXNG (default URL: http://127.0.0.1:8080).
- Self-hosted Crawl4AI 0.9+ (default URL: http://127.0.0.1:11235).

Local-Maxxing connects to these services; it does not host them.

## 1. Install

PowerShell example:

```powershell
cd D:\samx
git clone https://github.com/samex111/local-maxxing.git
cd local-maxxing
npm install
Copy-Item .env.example .env
# Edit .env with your actual allowed project roots and Crawl4AI token.
npm run build
npm test
```

Set `LOCAL_MAXXING_ALLOWED_ROOTS` to the parent directory containing repositories Local-Maxxing may manage. Separate multiple roots with the OS path separator (semicolon on Windows, colon on macOS/Linux). Never commit `.env`.

The MCP process loads `.env` from the Local-Maxxing installation directory, even though OpenCode launches it with the workspace as its current directory.

## 2. Configure SearXNG

The SearXNG Search API returns JSON only when `json` is enabled under `search.formats`. Add it to your mounted `settings.yml`, preserving other settings:

```yaml
search:
  formats:
    - html
    - json
```

Restart SearXNG and test:

```powershell
Invoke-RestMethod "http://127.0.0.1:8080/search?q=typescript&format=json"
```

A 403 response usually means JSON format is disabled.

## 3. Configure Crawl4AI

Crawl4AI 0.9+ self-hosted deployments require an API token. Set the same token in the container and Local-Maxxing's `CRAWL4AI_API_TOKEN` value in `.env`.

Verify health (the health endpoint does not require the bearer token):

```powershell
Invoke-RestMethod "http://127.0.0.1:11235/health"
```

Open `http://127.0.0.1:11235/playground`, set the token in its token bar and test a public page.

**Network safety:** Local-Maxxing rejects common private/local URL targets before sending a crawl. That validation is defense-in-depth, not a complete SSRF boundary: DNS rebinding and redirects are ultimately handled by the crawler process. Run Crawl4AI in a network environment that cannot reach your private LAN, cloud metadata endpoints or internal services. Do not expose the authenticated crawler API publicly.

## 4. Connect OpenCode

OpenCode's current configuration places local MCP servers under `mcp.servers`. Merge the entry from `examples/opencode.jsonc` into the OpenCode config for your workspace. Replace the example absolute path with the location where you cloned Local-Maxxing.

Example for `D:\samx\local-maxxing`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "local-maxxing": {
        "type": "local",
        "command": ["node", "D:/samx/local-maxxing/dist/src/index.js"],
        "environment": {
          "LOCAL_MAXXING_ALLOWED_ROOTS": "D:/samx"
        }
      }
    }
  }
}
```

The server reads its other service settings and Crawl4AI token from the installation's `.env`. Restart OpenCode and check:

```powershell
opencode mcp list
```

The server uses stdio. Do not run `npm run dev` in the same terminal that OpenCode uses for protocol communication.

### NVIDIA NIM

Configure NVIDIA NIM separately as the model provider in OpenCode using its OpenAI-compatible endpoint and API key. Local-Maxxing does not proxy model calls and does not need the NIM API key.

## 5. Initialize a project

Open the target repository in OpenCode. Ask the coding agent to inspect the repository and propose a small, prioritized backlog with acceptance criteria. It should call `local_maxxing_initialize_project` with:

- `name` and `goal`.
- `features`: unique IDs, priorities, objectives, dependencies and acceptance criteria.
- `installAgentInstructions`: true to merge the managed session protocol into `AGENTS.md`; false to write `.local-maxxing/AGENTS_SNIPPET.md`.

Optional `projectPath` defaults to the MCP process working directory (the OpenCode workspace) and must be within an allowed root.

Initialization refuses to overwrite an existing non-empty `.local-maxxing/` directory. Review or back up any existing project state before attempting a reset.

## 6. Daily workflow

At session start:

1. Call `local_maxxing_get_project_context`.
2. Inspect Git status and recent commits.
3. Call `local_maxxing_get_next_task`.
4. Mark a newly selected task `in_progress` using `local_maxxing_update_task`.
5. Implement one focused vertical slice.

For research:

1. Call `local_maxxing_web_search`.
2. Select relevant primary or authoritative sources.
3. Call `local_maxxing_crawl_urls` to save Markdown into the project.
4. Call `local_maxxing_read_source` using the returned source ID.

Before ending:

1. Run relevant tests and user-facing checks in OpenCode.
2. Record each result using `local_maxxing_record_verification`, listing the exact acceptance criteria covered.
3. Mark a task `verified` only after every acceptance criterion has passing evidence.
4. Call `local_maxxing_record_handoff` with completed tasks, checks, blockers and the next action.
5. Review the diff and commit with OpenCode's normal Git tools.

Local-Maxxing records evidence; it does not execute tests, edit application source code, commit, push or deploy.

## Troubleshooting

- **MCP does not connect:** rebuild with `npm run build`, check the configured absolute entry-point path and run `opencode mcp list`.
- **Project path rejected:** add its parent directory to `LOCAL_MAXXING_ALLOWED_ROOTS` and restart OpenCode.
- **SearXNG 403:** enable JSON under `search.formats` and restart SearXNG.
- **Crawl4AI 401/403:** verify the `.env` bearer token matches the container token.
- **Cannot mark verified:** record passing evidence for every exact acceptance criterion first.

## Current limitations

- Verification is agent-reported, not independently executed or cryptographically attested.
- Crawling is synchronous and bounded to a small number of URLs per call.
- Project state is JSON/Markdown files; concurrent writers to the same project are not supported.
- URL checks are not a replacement for crawler network isolation.
- No vector database, job queue, dashboard or multi-agent orchestration in v1.
