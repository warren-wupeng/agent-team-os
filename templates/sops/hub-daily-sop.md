# Hub Agent Daily SOP

> Version: 1.0
> Frequency: Once per session / Once per day
> Estimated time: 5-10 minutes

## Prerequisites

- [ ] Access to project git repository
- [ ] Access to issue tracker (GitHub Issues or equivalent)

## Steps

### Step 1: Sync Repository

```bash
cd /path/to/project
git pull origin main
```

**Expected**: Latest changes pulled, no conflicts.
**If failed**: Resolve conflicts or report to human.

### Step 2: Check Mailbox

Read all unread messages in `mailbox/*-to-hub/` directories.

For each message:
- If `expects_reply: true` → queue for response
- If informational → note and acknowledge
- If urgent (P0/P1) → flag for immediate action

**Report format**: List new messages with sender, subject, and action needed.

### Step 3: Scan Open Issues

```bash
gh issue list --state open --limit 30
```

Check for:
- New issues since last SOP run
- Issues with no assignee
- Issues stale for 7+ days
- P0/P1 issues with no recent activity

### Step 4: Generate Status Report

Deliver to human:

```markdown
## SOP Report — [Date]

### Repository Status
[Up to date / X new commits]

### New Messages
[List with sender, subject, action needed]

### Issues Status
[X open, any new, any stale]

### Action Items for Human
| # | Item | Priority |
|---|------|----------|
| 1 | ... | P0 |

### Team Notes
[Any observations, blockers, or recommendations]
```

### Step 5: Respond to Pending Messages

Reply to any messages flagged in Step 2. Commit and push.

```bash
git add mailbox/
git commit -m "Hub: daily SOP responses"
git push origin main
```

## Special Situations

- **Agent not responding**: If an agent hasn't replied to a message for 24h+, flag to human.
- **Conflicting instructions**: If two agents report contradictory information, investigate before reporting.
- **Emergency**: If a P0 issue is found, skip remaining SOP steps and address immediately.
