# atos

> Agent teamwork in your terminal.

A CLI-first coordination tool for multi-AI-agent teams. Works with **any** agent runtime — Claude Code, OpenCode, GitHub Copilot, Cursor, or your own scripts.

```bash
npx atos-cli team init my-team
npx atos-cli team join --name kira --role cto
npx atos-cli team join --name raven --role devops

ATOS_AGENT=kira npx atos-cli mail send --to raven --subject "Deploy staging" --body "Ship it today"
ATOS_AGENT=raven npx atos-cli mail inbox --unread
ATOS_AGENT=raven npx atos-cli task list --mine
```

## Why

Every multi-agent framework today is either **Python-locked** (CrewAI, AutoGen, LangGraph), **platform-locked** (Claude Code Teams, OpenAI Swarm), or **heavyweight** (requires Docker, databases, web servers).

atos is none of those. It's a single CLI binary that any agent with bash access can use. No framework, no SDK, no server.

| | Existing frameworks | atos |
|---|---|---|
| Interface | Python SDK, Web UI | **CLI** (bash) |
| Runtime | Framework-locked | **Any agent** |
| Install | pip + dependencies + config | **`npx atos-cli`** |
| Storage | Databases, servers | **SQLite** (zero-config) |
| Complexity | Graphs, DAGs, hierarchies | **Messages + Tasks** |

## Install

```bash
# Use directly (no install needed)
npx atos-cli <command>

# Or install globally
npm install -g atos-cli
atos <command>
```

Requires Node.js >= 18.

## Quick Start

### 1. Initialize a team

```bash
atos team init my-team
```

This creates a `.atos/` directory with a SQLite database.

### 2. Register agents

```bash
atos team join --name hub --role coordinator
atos team join --name kira --role cto
atos team join --name raven --role devops
atos team members
```

### 3. Set agent identity

Each agent identifies itself via the `ATOS_AGENT` environment variable:

```bash
# In Claude Code's CLAUDE.md:
export ATOS_AGENT=kira

# Or use the --agent flag:
atos --agent kira mail inbox
```

### 4. Send messages

```bash
# Kira sends a task to Raven
ATOS_AGENT=kira atos mail send \
  --to raven \
  --subject "Deploy staging" \
  --body "Deploy the latest build to staging today" \
  --priority P1

# Raven checks inbox
ATOS_AGENT=raven atos mail inbox --unread
# → JSON array of messages

# Raven reads and replies
ATOS_AGENT=raven atos mail read 1
ATOS_AGENT=raven atos mail reply 1 --body "Done, deployed at 14:30"
```

### 5. Track tasks

```bash
# Create a task
ATOS_AGENT=kira atos task create \
  --title "Fix auth errors" \
  --assignee raven \
  --priority P0

# Raven checks assigned tasks
ATOS_AGENT=raven atos task list --mine

# Mark done
ATOS_AGENT=raven atos task done 1 --note "Fixed null pointer in auth middleware"
```

## Commands

### Team

| Command | Description |
|---------|-------------|
| `atos team init <name>` | Initialize a new team |
| `atos team join --name <n> --role <r>` | Register an agent |
| `atos team members` | List all team members |
| `atos team remove <name>` | Remove an agent |

### Mail

| Command | Description |
|---------|-------------|
| `atos mail send --to <agent> --subject <s> --body <b>` | Send a message |
| `atos mail inbox [--unread] [--from <agent>]` | List inbox messages |
| `atos mail read <id>` | Read a message (marks as read) |
| `atos mail reply <id> --body <b>` | Reply to a message |
| `atos mail count` | Count total/unread messages |

### Task

| Command | Description |
|---------|-------------|
| `atos task create --title <t> [--assignee <a>]` | Create a task |
| `atos task list [--mine] [--status open\|done\|blocked]` | List tasks |
| `atos task show <id>` | Show task details |
| `atos task update <id> --status <s>` | Update a task |
| `atos task done <id> [--note <text>]` | Mark task as done |

### Global Options

```
--dir <path>      .atos directory location (default: auto-detect)
--format <fmt>    Output format: json (default) | human
--agent <name>    Act as this agent (or set ATOS_AGENT env var)
--quiet           Suppress non-essential output
```

## Output

All commands output **structured JSON** by default — designed for AI agents to parse reliably.

```bash
$ atos team members
[
  {"agent": "kira", "role": "cto", "persona_file": null, "joined_at": "2026-03-12 07:05:21"},
  {"agent": "raven", "role": "devops", "persona_file": null, "joined_at": "2026-03-12 07:05:28"}
]

$ atos --format human team members
agent  role    persona_file  joined_at
-----  ------  ------------  -------------------
kira   cto                   2026-03-12 07:05:21
raven  devops                2026-03-12 07:05:28
```

## Storage

All data lives in `.atos/atos.db` (SQLite). No server, no configuration.

```
.atos/
├── atos.db        # SQLite: messages, tasks, team config
├── personas/      # Markdown: agent persona files
└── sops/          # Markdown: standard operating procedures
```

The `.atos/` directory can be committed to git for team sync and audit trail.

## Use with AI Agent Runtimes

### Claude Code

Add to your project's `CLAUDE.md`:

```markdown
## Agent Coordination
This project uses atos for multi-agent coordination.
Set `export ATOS_AGENT=<your-name>` before running commands.
Check `atos mail inbox --unread` at the start of each session.
```

### Any agent with bash access

If your agent can run shell commands, it can use atos:

```bash
# Check for new messages
atos mail inbox --unread

# Create a task
atos task create --title "Implement feature X" --assignee other-agent

# Report completion
atos task done 3 --note "Implemented and tested"
```

## Architecture

```
Any Agent Runtime (Claude Code, OpenCode, Copilot, ...)
    │
    ├── Has MCP support  → MCP Server (Phase 2, thin wrapper)
    │
    └── Has Bash access  → atos CLI directly
                              │
                         ┌────▼────┐
                         │ atos CLI │  JSON output, exit codes, idempotent
                         └────┬────┘
                              │
                       ┌──────▼──────┐
                       │  .atos/     │  SQLite + Markdown files
                       │  atos.db    │  Git for sync & audit
                       └─────────────┘
```

## Roadmap

- [x] **Phase 1**: Core CLI — team, mail, task (current)
- [ ] **Phase 2**: MCP server + presence + SOPs + git sync
- [ ] **Phase 3**: Knowledge integration (OpenViking) + remote server
- [ ] **Phase 4**: Ecosystem (runtime templates, dashboard UI, plugins)

See [docs/v2-architecture.md](docs/v2-architecture.md) for the full design.

## Design Docs

- [Architecture RFC](docs/v2-architecture.md) — CLI design, storage, implementation plan
- [Output Format RFC](docs/v2-output-format-rfc.md) — Why JSON, research findings
- [Competitive Landscape](docs/v2-competitive-landscape.md) — How atos compares to CrewAI, AutoGen, A2A, etc.

## Prior Art (v1)

atos evolved from Agent Team OS v1, a documentation/convention framework for multi-agent teams. The v1 guides are still useful for team design:

- [Persona Design Guide](docs/persona-design-guide.md)
- [Mailbox Protocol](docs/mailbox-protocol.md)
- [SOP Design Guide](docs/sop-design-guide.md)
- [Scaling Guide](docs/scaling-guide.md)

## Contributing

PRs welcome. This project is based on real production experience running a multi-AI-agent team for a one-person company.

## License

MIT

---

Built by [Warren Wu](https://github.com/warren-wupeng)
