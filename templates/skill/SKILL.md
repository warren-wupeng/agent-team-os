---
name: atos
description: Team coordination for multi-agent workflows. Use when the user asks to check mail, send messages, manage tasks, run SOPs, or coordinate with teammates. Requires ATOS_AGENT env var or --agent flag to identify the acting agent.
---

# atos — Agent Team OS

Coordinate with your team using the atos CLI. All commands return JSON.

## Setup

Your identity MUST be set before using any command:

```bash
# Option 1: environment variable (recommended — set once per session)
export ATOS_AGENT=<your-agent-name>

# Option 2: flag (per-command)
atos --agent <your-agent-name> mail inbox
```

If the project has a `.atos/` directory, atos auto-discovers it. Otherwise specify `--dir <path>`.

## Commands

### Mail — Async messaging

```bash
# Check inbox
atos mail inbox --unread                          # Unread messages only
atos mail inbox --since 1h                        # Messages from last hour
atos mail inbox --since 30m --from echo           # Combine filters
atos mail inbox --limit 50                        # More results (default: 20)

# Read a message (marks as read)
atos mail read <id>

# Send a message
atos mail send --to <agent> --subject "<subject>" --body "<body>"
atos mail send --to <agent> --subject "<subject>" --body-file <path>   # Long messages

# Reply (auto-fills recipient and "Re:" prefix)
atos mail reply <id> --body "<reply>"

# Quick count
atos mail count
# → {"unread": 3, "total": 15}
```

### Task — Shared task board

```bash
# View tasks
atos task list --mine --status open               # My open tasks
atos task list --status open                      # All open tasks
atos task list --assignee bolt --status done       # Bolt's completed tasks
atos task show <id>                               # Full task details

# Create a task
atos task create --title "<title>" --assignee <agent> --priority P1
atos task create --title "<title>" --description "<details>" --priority P0

# Update a task
atos task update <id> --status in-progress
atos task update <id> --status blocked
atos task update <id> --assignee <agent>          # Reassign
atos task update <id> --priority P0               # Escalate

# Complete a task
atos task done <id> --note "Implemented X. Tested on Y."
```

### SOP — Standard Operating Procedures

```bash
# List available SOPs
atos sop list                                     # All SOPs
atos sop list --role bolt                         # SOPs for a specific role

# View SOP content (raw markdown)
atos sop show <name>

# Get structured steps for execution
atos sop start <name>
# Returns JSON:
# {
#   "sop": "bolt-hourly",
#   "role": "bolt",
#   "totalSteps": 6,
#   "steps": [
#     {
#       "id": 1,
#       "title": "Check inbox",
#       "commands": ["atos mail inbox --unread"],
#       "guidance": "Read all unread messages..."
#     }
#   ]
# }
```

**Executing an SOP**: When you get steps from `sop start`, iterate through them:
1. Run each command in `commands` array
2. Read `guidance` and apply your judgment to the results
3. Take action (may require additional atos commands not in the template)
4. Proceed to next step

### Config — Team settings

```bash
atos config list                                  # All settings
atos config get <key>                             # Get one
atos config set <key> <value>                     # Set one
atos config delete <key>                          # Remove one
```

### Team — Team management

```bash
atos team members                                 # List all agents
atos team init <name>                             # Initialize new team
atos team join --name <agent> --role <role>        # Register agent
atos team remove <name>                           # Remove agent
```

## Communication Protocol

1. **Hub routing**: Send messages to the hub agent (usually "echo"), not directly to other agents
2. **Subject tags**: Prefix subjects for routing:
   - `[ACTION]` — requires someone to do something
   - `[INFO]` — informational, no action needed
   - `[STATUS]` — progress report
   - `[BLOCKED]` — needs help / escalation
3. **Priority levels**: P0 (critical) > P1 (high) > P2 (normal) > P3 (low)

## Standard Work Cycle

Every work session should follow this pattern:

```bash
# 1. Check for new messages
atos mail inbox --unread

# 2. Check your tasks
atos task list --mine --status open

# 3. Run your SOP if one exists
atos sop start <your-role>-hourly

# 4. Work on highest priority task
# ... do the actual work ...

# 5. Mark complete and report
atos task done <id> --note "<what you did>"
atos mail send --to echo --subject "[STATUS] Hourly update" --body "<summary>"
```

## When Blocked

```bash
atos task update <id> --status blocked
atos mail send --to echo --subject "[BLOCKED] Task #<id>" --body "Blocked on: <reason>. Need: <what from whom>"
```

Then move to the next available task. Don't wait.

## Output Format

All commands return JSON. Parse the output to make decisions:

```bash
result=$(atos mail count)
# {"unread": 3, "total": 15}

result=$(atos task list --mine --status open)
# [{"id": 1, "title": "...", "priority": "P1", ...}, ...]
```

Use `--format human` for readable table output (useful for debugging, not recommended for programmatic use).
