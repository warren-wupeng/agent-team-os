# atos v2 Architecture — CLI-First Agent Teamwork Infrastructure

> Status: RFC (Request for Comments)
> Date: 2026-03-12
> Author: Warren Wu

## Vision

Turn Agent Team OS from a documentation/convention framework into a **runnable CLI tool** that any AI agent runtime can use to coordinate with other agents.

```
Any Agent Runtime (Claude Code, OpenCode, Copilot, OpenClaw, ...)
    │
    ├── Has MCP support  → MCP Server (thin wrapper, calls CLI internally)
    │
    └── Has Bash access  → atos CLI directly
                              │
                         ┌────▼────┐
                         │ atos CLI │  AI-friendly: structured output, clear exit codes
                         └────┬────┘
                              │
                       ┌──────▼──────┐
                       │  .atos/ dir  │  SQLite for structured data
                       │  atos.db +   │  Markdown files for documents
                       │  *.md files  │  Git for sync & audit trail
                       └─────────────┘
```

**Why CLI-first, not MCP-first:**

- Every agent runtime has bash/shell access. Not every one supports MCP.
- CLI is the lowest common denominator — universal compatibility.
- MCP server becomes a trivial thin wrapper around CLI commands.
- Humans can also use the CLI directly for debugging and observation.

## Design Principles

### 1. AI-Friendly Output

All commands output structured data by default (format TBD — see [Output Format RFC](./v2-output-format-rfc.md)).

Requirements:
- Deterministic, parseable output — agents must be able to reliably extract fields
- Clear error structure — errors are structured too, not just stderr text
- Exit codes — 0 success, non-zero failure (agents check `$?`)
- Idempotent operations — safe to retry on failure
- `--format human` flag for human-readable output when needed

### 2. SQLite-First, Files for Documents

Structured operational data (messages, tasks, presence) lives in SQLite. Human-authored documents (personas, SOPs) stay as markdown files.

```
.atos/
├── atos.db                # SQLite: messages, tasks, presence, team config
├── personas/              # Markdown: agent persona files (human-authored)
│   ├── hub.md
│   ├── cto.md
│   └── devops.md
└── sops/                  # Markdown: standard operating procedures (human-authored)
    ├── hub-daily.md
    └── devops-hourly.md
```

**Why SQLite for structured data:**
- Single file, zero-config, no server process
- ACID transactions — no race conditions when two agents write simultaneously
- Rich queries out of the box (`--from hub --since 2026-03-01 --unread`)
- Full-text search for message bodies and task descriptions
- Scales to thousands of messages/tasks without performance degradation
- `.db` file can be committed to git (binary, but small and portable)

**Why markdown files for documents:**
- Personas and SOPs are authored by humans, reviewed in PRs
- Git diff/blame is meaningful for prose content
- Agents read these files directly — no query layer needed
- Natural fit for the L0/L1/L2 progressive loading pattern (see SOP section)

**Git as sync layer (not storage layer):**
- `atos sync` commits `.atos/` and pushes — the entire state travels via git
- Audit trail via git history (who changed what, when)
- Works offline — agents operate on local `.atos/`, sync when ready
- Merge conflicts are rare: SQLite is a single binary file, and `atos sync` uses a pull-rebase-push strategy with automatic conflict resolution at the application layer

### 3. Hub-and-Spoke by Default

Preserves the proven architecture from v1:
- All messages route through Hub by default
- Direct channels are opt-in exceptions
- Communication matrix is explicit and auditable

### 4. Progressive Enhancement

```
Level 0: Mailbox + tasks (2 agents, SQLite, local)
Level 1: + Presence + SOPs (3-5 agents, git sync)
Level 2: + MCP server + knowledge integration (5-8 agents)
Level 3: + Remote server + federation (distributed teams across machines)
```

## CLI Design

### Global Options

```bash
atos [command] [flags]

Global flags:
  --dir <path>       # .atos directory location (default: auto-detect up to git root)
  --format <fmt>     # Output format: json (default) | human | yaml
  --agent <name>     # Act as this agent (default: from ATOS_AGENT env var)
  --quiet            # Suppress non-essential output
```

### Commands

#### Team Management

```bash
# Initialize a new team
atos team init <team-name>
# → Creates .atos/ directory with team.json skeleton

# Join the team as an agent
atos team join --name <name> --role <role> [--persona <file>]
# → Registers agent in team.json, copies persona to .atos/personas/

# List team members
atos team members
# → [{name, role, status, persona, lastSeen, joinedAt}]

# Show team structure (communication matrix)
atos team matrix
# → Communication matrix showing who talks to whom

# Remove an agent
atos team remove <name>
```

#### Mailbox

```bash
# Send a message
atos mail send --to <agent> --subject <subject> --body <body> [--priority P0|P1|P2|P3]
# → {messageId, from, to, subject, timestamp}

# Read inbox
atos mail inbox [--unread] [--from <agent>] [--limit N]
# → [{messageId, from, subject, date, priority, read}]

# Read a specific message (marks as read)
atos mail read <message-id>
# → {messageId, from, to, date, subject, body, references}

# Reply to a message
atos mail reply <message-id> --body <body>
# → {messageId, inReplyTo, ...}

# Count unread
atos mail count
# → {unread: 3, total: 12}
```

#### Task Board

```bash
# Create a task
atos task create --title <title> [--assignee <agent>] [--priority P0-P3] [--description <text>]
# → {taskId, title, status, assignee, priority, createdAt, createdBy}

# List tasks
atos task list [--mine] [--status open|done|blocked] [--assignee <agent>]
# → [{taskId, title, status, assignee, priority, createdAt}]

# Update task
atos task update <id> --status <status>
atos task update <id> --assignee <agent>
# → {taskId, ...updated fields}

# Quick-complete a task
atos task done <id> [--note <completion-note>]

# Show task details
atos task show <id>
```

#### SOP (L0/L1/L2 Progressive Loading)

SOPs use a tiered loading pattern to minimize token consumption:

```bash
# L0: Abstract — list available SOPs (minimal tokens, ~10 per SOP)
atos sop list
# → [{name, frequency, role, description, lastRun}]

# L1: Overview — step titles + expected outcomes (~100 tokens per SOP)
atos sop show <name>
# → {name, steps: [{step, description, expectedOutput}]}

# L2: Full — complete instructions with commands (~500+ tokens per SOP)
atos sop start <name>
# → {runId, sop, startedAt, agent, steps: [{step, description, command, expectedOutput, ifFailed}]}

# Record SOP step completion
atos sop step <run-id> --step <N> --result <pass|fail|skip> [--note <text>]

# Complete SOP run with report
atos sop complete <run-id> [--report <text>]
```

This pattern is inspired by OpenViking's L0/L1/L2 tiered context model and applies broadly: `mail count` (L0) → `mail inbox` (L1) → `mail read` (L2), and `task list` (L0) → `task show` (L1).

#### Presence & Status

```bash
# Report online
atos status online
# → {agent, status: "online", since: "..."}

# Report offline
atos status offline

# Heartbeat (for long-running agents)
atos status heartbeat
# → Updates lastSeen timestamp

# Who's online?
atos who
# → [{name, role, status, lastSeen}]
```

#### Sync (for distributed setups)

```bash
# Pull latest state from git remote
atos sync pull
# → git pull on .atos/ directory

# Push local changes to git remote
atos sync push
# → git add .atos/ && git commit && git push

# Full sync (pull + push)
atos sync
```

## Agent Identity

Each agent identifies itself via the `ATOS_AGENT` environment variable or `--agent` flag:

```bash
# In Claude Code's CLAUDE.md or session startup:
export ATOS_AGENT=kira

# Then all commands know who "I" am:
atos mail inbox          # → Kira's inbox
atos task list --mine    # → Kira's tasks
atos status online       # → Kira is online
```

This means the same CLI binary serves all agents. Identity is contextual, not compiled-in.

## Storage Architecture

### SQLite (Primary)

All structured operational data lives in `.atos/atos.db`:

```sql
-- Core tables
messages (id, from_agent, to_agent, subject, body, priority, read, created_at, in_reply_to)
tasks    (id, title, description, status, assignee, priority, created_by, created_at, updated_at)
presence (agent, status, last_seen, metadata)
team     (agent, role, persona_file, joined_at)
comm_matrix (from_agent, to_agent, channel_type)  -- hub-routed vs direct

-- Indexes for common agent queries
CREATE INDEX idx_messages_to_unread ON messages(to_agent, read);
CREATE INDEX idx_tasks_assignee_status ON tasks(assignee, status);
CREATE INDEX idx_presence_agent ON presence(agent);

-- Full-text search
CREATE VIRTUAL TABLE messages_fts USING fts5(subject, body, content=messages);
CREATE VIRTUAL TABLE tasks_fts USING fts5(title, description, content=tasks);
```

**Why SQLite over file-based:**

| Concern | File-based | SQLite |
|---------|-----------|--------|
| Concurrent writes | Race conditions (two agents write same file) | ACID transactions, WAL mode |
| Query performance | Read every file, filter in app code | SQL indexes, instant filtering |
| Full-text search | Not possible without external tool | FTS5 built-in |
| Storage overhead | One file per entity (inode overhead) | Single file, compact |
| Git friendliness | Great diffs, but merge conflicts | Binary file, no diffs (acceptable trade-off) |
| Setup complexity | Zero | Zero (SQLite is embedded, no server) |

### Markdown Files (Documents)

Human-authored content stays as files for git-friendly collaboration:

```
.atos/personas/*.md    — Agent personas (read by agents at startup)
.atos/sops/*.md        — Standard operating procedures (read on demand)
```

These are read-only from the CLI's perspective — humans author and review them in PRs. The CLI reads them via `atos sop show` and `atos team members --persona`.

### Git Sync Strategy

Git is the **sync layer**, not the storage layer:

```bash
atos sync pull
# 1. git pull --rebase on .atos/ directory
# 2. If atos.db conflicts (binary): keep remote, replay local uncommitted operations
# 3. Markdown files: normal git merge (text, rarely conflicts)

atos sync push
# 1. git add .atos/
# 2. git commit -m "atos: sync $(date) by ${ATOS_AGENT}"
# 3. git push (retry with pull --rebase on conflict)
```

**SQLite merge conflict resolution:**
When two agents modify the database concurrently and push:
1. The second pusher's `sync pull` detects a binary conflict on `atos.db`
2. atos keeps the remote version of `atos.db`
3. atos replays the local agent's uncommitted operations (stored in a WAL journal or operation log table)
4. This is similar to CRDTs — operations are replayed, not states merged

### Remote Server (Future, Level 3)

For distributed teams where agents run on different machines:

```bash
atos config set remote https://atos.example.com --token <api-key>
# → All commands proxy to remote HTTP API
# → SQLite replaced by server-side PostgreSQL
# → Real-time message delivery via SSE/WebSocket
```

## Knowledge Integration (Optional, Phase 3+)

atos solves **structured coordination** (messages, tasks, presence). It does not solve **semantic knowledge retrieval** — finding relevant context from large unstructured corpora.

For teams that need knowledge retrieval, atos can integrate with external knowledge systems like ByteDance's [OpenViking](https://github.com/AIOrchestraLab/OpenViking).

### What OpenViking Does (and Doesn't Overlap)

| Capability | atos | OpenViking |
|-----------|------|------------|
| Send/receive messages | Yes | No |
| Track tasks | Yes | No |
| Agent presence | Yes | No |
| Semantic search over documents | No | Yes |
| Tiered context loading (L0/L1/L2) | Borrowed for SOP design | Core architecture |
| RAG pipeline | No | Yes |
| Agent coordination protocol | Yes | No |

**They solve different layers.** atos is the coordination bus; OpenViking (or similar) is the knowledge retrieval layer. They can coexist.

### Integration Approach

```bash
# Optional: register a knowledge backend
atos config set knowledge viking --endpoint http://localhost:8080

# Query knowledge from CLI (proxies to backend)
atos knowledge search "deployment best practices for staging"
# → [{docId, title, relevance, snippet}]

# Ingest team artifacts into knowledge base
atos knowledge ingest --source .atos/sops/
# → Indexes SOP documents for semantic retrieval
```

### L0/L1/L2 Progressive Loading (Borrowed from OpenViking)

OpenViking's tiered context model maps well to how agents consume SOPs:

```
L0 (Abstract)  — atos sop list
                  → Just names + descriptions + last-run time
                  → Agent decides which SOP to run
                  → ~10 tokens per SOP

L1 (Overview)  — atos sop show <name>
                  → Step titles + expected outcomes
                  → Agent understands scope without full detail
                  → ~100 tokens per SOP

L2 (Full)      — atos sop start <name>
                  → Complete step-by-step instructions with commands
                  → Agent executes each step
                  → ~500+ tokens per SOP
```

This prevents token waste: agents don't load 500-token SOPs into context until they actually need to execute them. The same pattern applies to messages (`mail count` → `mail inbox` → `mail read`) and tasks (`task list` → `task show`).

## MCP Server (Phase 2)

Thin wrapper around CLI — literally spawns `atos` commands:

```typescript
// Pseudocode
server.tool("atos_mail_send", async ({ to, subject, body }) => {
  const result = execSync(
    `atos mail send --to ${to} --subject '${subject}' --body '${body}' --format json`
  );
  return JSON.parse(result.stdout);
});
```

This means:
- MCP server is a ~200 line wrapper file
- All logic lives in the CLI
- CLI improvements automatically benefit MCP users
- Can run as `npx @anthropic/mcp-server-atos` or similar

## Migration from v1

v1 users have file-based mailboxes:
```
mailbox/hub-to-cto/20260307-1400-deploy-task.json
```

v2 migration imports these into SQLite:
```bash
atos migrate v1 --source ./mailbox
# → Reads all JSON message files from v1 directory structure
# → Inserts messages into .atos/atos.db (messages table)
# → Infers team.json from directory structure (sender/receiver pairs)
# → Copies persona .md files to .atos/personas/
# → Original v1 files are preserved (not deleted)
```

## Implementation Plan

### Phase 1: Core CLI (MVP)

Scope: `team init/join/members` + `mail send/inbox/read/reply` + `task create/list/done/update`

Tech stack:
- TypeScript (Node.js)
- Commander.js for CLI parsing
- better-sqlite3 for embedded SQLite (sync API, prebuilt binaries, 177k+ dependents)
- SQLite journal mode: DELETE (default, zero-config, perfectly git-friendly)
- Publish as `npx atos-cli` / `npm i -g atos-cli` (bin name: `atos`)

Storage: SQLite (`atos.db`) from day one. No file-based fallback — SQLite is the only structured storage backend.

Message limits: Soft limit 4KB (warning), hard limit 16KB (reject). Configurable via `atos config set message.maxSize`.

Deliverable: Any agent with bash access can send messages and track tasks.

### Phase 2: MCP + Presence + SOPs

Scope: MCP server wrapper + `status/who` + `sop list/show/start/step/complete` + `sync` commands

MCP server is a thin wrapper (~200 lines) that calls CLI commands internally.

SQLite upgrade: Switch to WAL mode for better write performance. `atos sync` runs `PRAGMA wal_checkpoint(TRUNCATE)` before committing to ensure only `atos.db` (no `-wal`/`-shm` files) enters git.

### Phase 3: Knowledge Integration + Remote

Scope:
- Optional knowledge backend integration (`atos knowledge search/ingest`)
- Generic `KnowledgeBackend` adapter interface with OpenViking as reference implementation
- Remote server mode (`atos config set remote`) for distributed teams
- Server-side storage (PostgreSQL) for remote mode
- Optional message encryption (AES-256-GCM) for sensitive environments

### Phase 4: Ecosystem

Scope:
- Pre-built integrations (Claude Code CLAUDE.md template, OpenCode config, Copilot setup, etc.)
- `atos init --runtime claude-code` scaffolding
- Dashboard UI for human observation (read-only web view of team state)
- Plugin system for custom storage/knowledge backends

## Resolved Questions

1. ~~**Output format**~~ **→ JSON**. See [Output Format RFC](./v2-output-format-rfc.md).
2. ~~**Package name**~~ **→ `atos-cli`** (npm). `atos` is taken (inactive Express framework, last updated 2022). Alternatives `atos-cli`, `agent-atos`, `atos-agent`, `agent-team-os` are all available. Use `atos-cli` with `"bin": {"atos": ...}` so the command remains `atos`.
3. ~~**Conflict resolution**~~ **→ SQLite + operation replay**. See Storage Architecture.
4. ~~**Message size limits**~~ **→ Soft 4KB, hard 16KB**. 4KB ≈ 1000 tokens, reasonable per-message context cost. Over 4KB: CLI warns on stderr. Over 16KB: CLI rejects, suggests file attachment. Configurable: `atos config set message.maxSize <bytes>`.
5. ~~**Encryption**~~ **→ Phase 1: none. Phase 3: optional AES-256-GCM**. atos is local project coordination, not cross-network secure messaging. For sensitive repos, use `git-crypt` or `age` to encrypt the entire `.atos/` directory. Per-message encryption deferred to Phase 3 as opt-in feature.
6. ~~**SQLite WAL mode**~~ **→ Phase 1: DELETE mode. Phase 2: WAL + checkpoint before sync**. DELETE mode is zero-config and perfectly git-friendly (no extra files). In Phase 2, switch to WAL for better write performance; `atos sync` runs `PRAGMA wal_checkpoint(TRUNCATE)` to merge WAL back into main `.db` file before `git add`. `.gitignore` always excludes `*.db-wal` and `*.db-shm` as safety net.
7. ~~**Knowledge backend interface**~~ **→ Generic interface, OpenViking reference impl**. Define a `KnowledgeBackend` TypeScript interface with 3 methods (`search`, `ingest`, `status`). Ship OpenViking adapter as the first (and possibly only) implementation. Interface cost is near-zero; prevents coupling to one vendor.
8. ~~**better-sqlite3 vs sql.js**~~ **→ better-sqlite3**. Sync API is perfect for CLI (no async overhead). Prebuilt binaries cover 95%+ of Node.js LTS users. 11-24x faster than sql.js. 177k+ npm dependents prove ecosystem reliability. sql.js (Wasm) loads entire DB into RAM and has async API — poor fit for CLI. Trade-off: rare installation failures on edge platforms (WSL/Nix); document node-gyp prerequisites.

## .gitignore (recommended)

```
.atos/*.db-journal
.atos/*.db-wal
.atos/*.db-shm
```
