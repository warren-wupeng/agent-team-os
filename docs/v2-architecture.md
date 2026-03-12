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
                       │  .atos/ dir  │  Git-friendly file storage (default)
                       │  (or SQLite) │  Optional DB for querying at scale
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

### 2. Git-Native Storage

Default storage is `.atos/` directory, designed to be committed to git:

```
.atos/
├── team.json              # Team definition (name, members, comm matrix)
├── personas/              # Agent persona files
│   ├── hub.md
│   ├── cto.md
│   └── devops.md
├── mailbox/               # Messages
│   ├── hub-to-cto/
│   │   └── 20260312-1400-deploy-task.json
│   └── cto-to-hub/
│       └── 20260312-1530-deploy-done.json
├── tasks/                 # Task board
│   ├── 001-fix-login-bug.json
│   └── 002-deploy-staging.json
├── sops/                  # Standard operating procedures
│   ├── hub-daily.md
│   └── devops-hourly.md
└── presence/              # Agent presence (online/offline/last-seen)
    ├── hub.json
    └── cto.json
```

This means:
- Full audit trail via git history
- Works offline (local files)
- Multi-agent coordination via git push/pull
- Compatible with v1 mailbox protocol (migration path)

### 3. Hub-and-Spoke by Default

Preserves the proven architecture from v1:
- All messages route through Hub by default
- Direct channels are opt-in exceptions
- Communication matrix is explicit and auditable

### 4. Progressive Enhancement

```
Level 0: Just mailbox (2 agents, file-based, git sync)
Level 1: + Tasks + presence (3-5 agents)
Level 2: + SOPs + scheduling (5-8 agents)
Level 3: + MCP server + remote storage (distributed teams)
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

#### SOP

```bash
# List available SOPs for my role
atos sop list
# → [{name, frequency, role, description, lastRun}]

# Get SOP checklist
atos sop show <name>
# → {name, steps: [{step, description, command, expectedOutput}]}

# Record SOP execution start
atos sop start <name>
# → {runId, sop, startedAt, agent}

# Record SOP step completion
atos sop step <run-id> --step <N> --result <pass|fail|skip> [--note <text>]

# Complete SOP run with report
atos sop complete <run-id> [--report <text>]
```

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

### File-Based (Default)

Every entity maps to a JSON file in `.atos/`:

```
Message  → .atos/mailbox/{sender}-to-{receiver}/{timestamp}-{subject-slug}.json
Task     → .atos/tasks/{id}-{title-slug}.json
Presence → .atos/presence/{agent-name}.json
Team     → .atos/team.json
```

Advantages:
- Git-native (diff, blame, history)
- No database dependency
- Works offline
- Human-inspectable

### SQLite (Optional, for scale)

When file-based gets slow (100+ messages, 50+ tasks):

```bash
atos config set storage sqlite
# → Creates .atos/atos.db, migrates existing files
```

SQLite enables:
- Fast queries (`atos mail inbox --from hub --since 2026-03-01`)
- Full-text search
- Aggregation (task statistics, message counts)

### Remote Server (Future, Level 3)

For distributed teams where agents run on different machines:

```bash
atos config set remote https://atos.example.com --token <api-key>
# → All commands proxy to remote server
```

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

v1 users have:
```
mailbox/hub-to-cto/20260307-1400-deploy-task.json
```

v2 migration:
```bash
atos migrate v1 --source ./mailbox
# → Copies messages to .atos/mailbox/ format
# → Creates team.json from existing directory structure
# → Preserves git history
```

## Implementation Plan

### Phase 1: Core CLI (MVP)

Scope: `team init/join/members` + `mail send/inbox/read` + `task create/list/done`

Tech stack:
- TypeScript (Node.js)
- Commander.js for CLI parsing
- File-based storage only
- Publish as `npx atos` / `npm i -g atos`

Deliverable: Any agent with bash access can send messages and track tasks.

### Phase 2: MCP + Presence

Scope: MCP server wrapper + `status/who` + `sop list/run`

### Phase 3: SQLite + Remote

Scope: SQLite storage backend + remote server mode + `sync` commands

### Phase 4: Ecosystem

Scope: Pre-built integrations (Claude Code CLAUDE.md template, OpenCode config, etc.)

## Open Questions

1. **Output format**: Is JSON the best default for AI consumption? Or should we consider alternatives? (See [Output Format RFC](./v2-output-format-rfc.md))
2. **Package name**: Is `atos` available on npm? Fallback names?
3. **Conflict resolution**: When two agents update the same task via file-based storage, how to handle git merge conflicts?
4. **Message size limits**: Should we cap message body length to avoid token bloat?
5. **Encryption**: Should mailbox messages support encryption for sensitive content?
