# atos

> Agent teamwork in your terminal.

A CLI-first coordination tool for multi-AI-agent teams. Works with **any** agent runtime — Claude Code, OpenCode, GitHub Copilot, Cursor, or your own scripts. Now with **MCP Server** for native tool integration.

```bash
npx @warren-wu/atos-cli team init my-team
npx @warren-wu/atos-cli team join --name kira --role cto
npx @warren-wu/atos-cli team join --name raven --role devops

ATOS_AGENT=kira npx @warren-wu/atos-cli mail send --to raven --subject "Deploy staging" --body "Ship it today"
ATOS_AGENT=raven npx @warren-wu/atos-cli mail inbox --unread
```

## Why

Every multi-agent framework today is either **Python-locked** (CrewAI, AutoGen, LangGraph), **platform-locked** (Claude Code Teams, OpenAI Swarm), or **heavyweight** (requires Docker, databases, web servers).

atos is none of those. It's a single CLI binary that any agent with bash access can use. No framework, no SDK, no server.

| | Existing frameworks | atos |
|---|---|---|
| Interface | Python SDK, Web UI | **CLI** + **MCP** |
| Runtime | Framework-locked | **Any agent** |
| Install | pip + dependencies + config | **`npx @warren-wu/atos-cli`** |
| Storage | Databases, servers | **SQLite** (zero-config) |
| Complexity | Graphs, DAGs, hierarchies | **Messages + Tasks + SOPs** |

## Install

```bash
# Use directly (no install needed)
npx @warren-wu/atos-cli <command>

# Or install globally
npm install -g @warren-wu/atos-cli
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

# Or read body from a file (for long messages)
ATOS_AGENT=kira atos mail send \
  --to raven \
  --subject "Sprint report" \
  --body-file report.md

# Raven checks inbox
ATOS_AGENT=raven atos mail inbox --unread

# Filter by time
ATOS_AGENT=raven atos mail inbox --since 1h

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

### 6. Search messages and tasks

```bash
# Full-text search across messages
atos mail search "pagination"
atos mail search "deploy" --from raven

# Full-text search across tasks
atos task search "auth" --status open
atos task search "API" --assignee bolt
```

### 7. Standard Operating Procedures

```bash
# List available SOPs
atos sop list
atos sop list --role bolt

# View raw SOP markdown
atos sop show bolt-hourly

# Get structured steps for agent execution
atos sop start bolt-hourly
# → JSON with steps: [{id, title, commands, guidance}, ...]
```

### 8. Team config

```bash
atos config set hub.agent echo
atos config get hub.agent
atos config list
atos config delete hub.agent
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
| `atos mail send --to <a> --subject <s> --body <b>` | Send a message |
| `atos mail send --to <a> --subject <s> --body-file <path>` | Send from file |
| `atos mail inbox [--unread] [--from <a>] [--since <t>]` | List inbox |
| `atos mail read <id>` | Read message (marks as read) |
| `atos mail reply <id> --body <b>` | Reply to a message |
| `atos mail search <query> [--from <a>] [--to <a>]` | Full-text search |
| `atos mail count` | Count total/unread messages |

### Task

| Command | Description |
|---------|-------------|
| `atos task create --title <t> [--assignee <a>] [--priority P0-P3]` | Create a task |
| `atos task list [--mine] [--status open\|done\|blocked]` | List tasks |
| `atos task show <id>` | Show task details |
| `atos task update <id> [--status <s>] [--assignee <a>]` | Update a task |
| `atos task done <id> [--note <text>]` | Mark task as done |
| `atos task search <query> [--status <s>] [--assignee <a>]` | Full-text search |

### SOP

| Command | Description |
|---------|-------------|
| `atos sop list [--role <role>]` | List available SOPs |
| `atos sop show <name>` | Show SOP markdown |
| `atos sop start <name>` | Parse SOP into structured steps |

### Config

| Command | Description |
|---------|-------------|
| `atos config get <key>` | Get a config value |
| `atos config set <key> <value>` | Set a config value |
| `atos config list` | List all config values |
| `atos config delete <key>` | Delete a config value |

### Global Options

```
--dir <path>      .atos directory location (default: auto-detect)
--format <fmt>    Output format: json (default) | human
--agent <name>    Act as this agent (or set ATOS_AGENT env var)
```

## MCP Server

atos includes an MCP (Model Context Protocol) server for native integration with Claude Code, Claude Desktop, and other MCP-compatible clients.

### Setup

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "atos": {
      "command": "atos-mcp",
      "args": ["--dir", "/path/to/project/.atos", "--agent", "bolt"]
    }
  }
}
```

Or with npx:

```json
{
  "mcpServers": {
    "atos": {
      "command": "npx",
      "args": ["@warren-wu/atos-cli", "atos-mcp", "--agent", "bolt"]
    }
  }
}
```

### Available MCP Tools

19 tools covering all atos functionality:

| Tool | Description |
|------|-------------|
| `mail_inbox` | Check inbox with filters |
| `mail_read` | Read a message |
| `mail_send` | Send a message |
| `mail_reply` | Reply to a message |
| `mail_count` | Count unread/total |
| `mail_search` | Full-text search messages |
| `task_list` | List tasks with filters |
| `task_show` | Show task details |
| `task_create` | Create a task |
| `task_update` | Update task fields |
| `task_done` | Mark task complete |
| `task_search` | Full-text search tasks |
| `sop_list` | List SOPs |
| `sop_show` | Show SOP content |
| `sop_start` | Parse SOP into steps |
| `config_get` | Get config value |
| `config_set` | Set config value |
| `config_list` | List all config |
| `team_members` | List team agents |

## Output

All commands output **structured JSON** by default — designed for AI agents to parse reliably.

```bash
$ atos mail count
{"unread": 3, "total": 15}

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
├── atos.db        # SQLite: messages, tasks, team config, FTS5 indexes
├── personas/      # Markdown: agent persona files
└── sops/          # Markdown: standard operating procedures
```

The `.atos/` directory can be committed to git for team sync and audit trail.

## Agent Prompt Templates

atos ships with prompt templates for integrating agents:

| Template | File | Use Case |
|----------|------|----------|
| System Prompt | `templates/agent-system-prompt.md` | Full prompt for any LLM |
| CLAUDE.md | `templates/CLAUDE.md` | Claude Code project config |
| Claude Skill | `templates/skill/SKILL.md` | Claude Code skill (on-demand) |
| Example (Bolt) | `templates/examples/bolt-system-prompt.md` | Concrete backend dev example |

## Architecture

```
Any Agent Runtime (Claude Code, OpenCode, Copilot, ...)
    │
    ├── Has MCP support  → atos-mcp (JSON-RPC/stdio, 19 tools)
    │
    └── Has Bash access  → atos CLI (JSON output, exit codes)
                              │
                         ┌────▼────┐
                         │ atos CLI │
                         └────┬────┘
                              │
                       ┌──────▼──────┐
                       │  .atos/     │  SQLite + FTS5 + Markdown
                       │  atos.db    │  Git for sync & audit
                       └─────────────┘
```

## Roadmap

- [x] **Phase 1**: Core CLI — team, mail, task
- [x] **Phase 1.1**: Config, --since, --body-file, search (FTS5)
- [x] **Phase 1.2**: SOP commands (list/show/start)
- [x] **Phase 2**: MCP Server (19 tools over JSON-RPC/stdio)
- [x] **Phase 2.1**: Agent prompt templates (system prompt, CLAUDE.md, skill)
- [ ] **Phase 2.2**: Presence + heartbeat
- [ ] **Phase 2.3**: Git sync
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
