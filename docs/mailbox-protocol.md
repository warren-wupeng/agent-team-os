# Mailbox Protocol

## Overview

Agents communicate via structured JSON messages stored in a git repository. This gives you:

- **Persistence**: Messages survive session restarts
- **Traceability**: Full audit trail via git history
- **Async**: Agents don't need to be online simultaneously
- **Cross-platform**: Works with any AI platform that can read/write files

## Directory Structure

```
mailbox/
├── hub-to-tech/           # Hub → Tech Lead
│   ├── 20260307-1400-deploy-task.json
│   └── 20260307-1600-bug-fix-request.json
├── tech-to-hub/           # Tech Lead → Hub
│   └── 20260307-1530-deploy-done.json
├── hub-to-content/        # Hub → Content Lead
├── content-to-hub/        # Content Lead → Hub
└── ...
```

**Naming convention**: `{sender}-to-{receiver}/`

**File naming**: `YYYYMMDD-HHmm-{brief-subject}.json`

## Message Format

```json
{
  "from": "Hub",
  "to": "Tech Lead",
  "date": "2026-03-07T14:00:00+08:00",
  "subject": "[Task] Deploy payment service to staging",
  "priority": "P1",
  "body": "Tech Lead, the payment service PR #42 has been approved. Please deploy to staging and run smoke tests.\n\nAcceptance criteria:\n1. Service starts without errors\n2. Health endpoint returns 200\n3. Payment flow smoke test passes\n\nReport back when done.",
  "references": [
    "https://github.com/org/repo/pull/42"
  ],
  "expects_reply": true
}
```

### Required Fields
- `from`: Sender agent name
- `to`: Receiver agent name
- `date`: ISO 8601 timestamp with timezone
- `subject`: Brief description, prefix with `[Task]`, `[Info]`, `[Question]`, `[Reply]`
- `body`: Message content (string or array of strings for readability)

### Optional Fields
- `priority`: P0 (critical) / P1 (high) / P2 (normal) / P3 (low)
- `references`: Related URLs, file paths, or issue numbers
- `expects_reply`: Boolean, helps receiver prioritize

## Communication Rules

### 1. Hub Routes Everything (Default)
By default, all messages go through the Hub:
```
You → Hub → Tech Lead → Hub → You
```

### 2. Direct Channels (Exception)
Some agent pairs can communicate directly to reduce latency:
```
Tech Lead ↔ DevOps (technical handoffs)
Coordinator → Everyone (status syncs)
```

Define allowed direct channels in your `team-architecture.md`.

### 3. Communication Matrix

| From → To | Hub | Tech | Content | DevOps | Coordinator |
|-----------|-----|------|---------|--------|-------------|
| **Hub** | - | ✓ | ✓ | ✓ | ✓ |
| **Tech** | ✓ | - | ✓ | ✓ | - |
| **Content** | ✓ | ✓ | - | - | - |
| **DevOps** | ✓ | ✓ | - | - | - |
| **Coordinator** | ✓ | ✓ | ✓ | ✓ | - |

### 4. Reading Protocol

Every agent should, at the start of each session:
1. `git pull` to get latest messages
2. Read all messages in their `*-to-{self}/` directories
3. Process and respond to any that `expects_reply: true`

### 5. Commit Protocol

After writing messages:
```bash
git add mailbox/
git commit -m "Agent: brief description of messages"
git push
```

## Anti-Patterns

- **Don't broadcast** — Send targeted messages, not mass notifications
- **Don't skip the Hub** — Unless the direct channel is explicitly defined
- **Don't send empty acks** — If you have nothing to add, don't reply
- **Don't put secrets in mailbox** — Use environment variables for credentials
