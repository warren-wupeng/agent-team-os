# SOP Design Guide

## Why SOPs

AI agents without routines forget things. They optimize for the current prompt and lose context about recurring responsibilities.

SOPs (Standard Operating Procedures) solve this by giving each agent a repeatable checklist to execute on a schedule.

## SOP Types

### Daily SOP
Runs once per day (usually at session start). Covers:
- Sync latest state (git pull)
- Check mailbox for new messages
- Scan open issues/tasks
- Generate status report
- Flag blockers and pending items

### Hourly SOP
Runs every hour for agents with operational responsibilities:
- Check service health
- Process incoming messages
- Update dashboards
- Execute monitoring checks
- Report anomalies

### Event-Triggered SOP
Runs when specific conditions are met:
- New team member onboarding
- Incident response
- Release deployment
- Handover between agents

## SOP Template Structure

```markdown
# [Agent Name] [Frequency] SOP

> Version: 1.0 | Last updated: YYYY-MM-DD
> Estimated time: X minutes

## Prerequisites
- [ ] Access to [system/repo/tool]
- [ ] Environment variables configured

## Steps

### Step 1: [Action Name]
**What**: [Brief description]
**How**:
\`\`\`bash
[Command or instruction]
\`\`\`
**Expected output**: [What success looks like]
**If failed**: [What to do]

### Step 2: ...

## Reporting
After completing all steps, deliver a status report:
- Summary of findings
- Items requiring human action
- Blockers and risks

## Special Situations
- [Condition]: [What to do]
```

## Design Principles

### 1. Idempotent
Running the SOP twice should produce the same result. Don't create duplicate messages or reports.

### 2. Fail-Safe
Every step should have a "if failed" path. Agents should report failures, not silently skip steps.

### 3. Observable
The human should be able to tell whether the SOP ran and what it found, without asking.

### 4. Evolving
SOPs should be updated when new responsibilities are added. Include a version number and last-updated date.

## Common SOPs by Role

| Role | Daily | Hourly | Event |
|------|-------|--------|-------|
| Hub/Chief Assistant | Status report, mailbox, issues | - | Incident coordination |
| Tech Lead | Code review queue, PR status | - | Release checklist |
| DevOps | Infrastructure health | Service monitoring, key checks | Incident response, deploy |
| Coordinator | Project dashboard, risk scan | Mailbox scan, progress update | Onboarding, handover |
| Content Lead | Content pipeline status | - | Publication checklist |

## Examples

See [templates/sops/](../templates/sops/) for ready-to-use SOP templates.
