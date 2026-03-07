# Team Architecture — 5-Person Growth

> Team Size: 5 | Architecture: Hub-and-Spoke with Departments
> Scaled from 3-person starter. Added DevOps and Coordinator.

## Team Members

| Role | Name | Department | Responsibilities |
|------|------|-----------|-----------------|
| Chief Assistant (Hub) | [Name] | - | Task decomposition, coordination, reporting |
| Tech Lead / CTO | [Name] | Tech | Architecture, code, technical decisions |
| DevOps Engineer | [Name] | Tech | Deployment, monitoring, infrastructure, security |
| Content Lead / CMO | [Name] | Business | Writing, narrative, external communication |
| Project Coordinator | [Name] | - (Cross-cutting) | Issue tracking, progress sync, risk alerts |

## Architecture

```
                    ┌─────────────┐
                    │     You     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     Hub     │
                    │  (Central)  │
                    └──┬──┬──┬───┘
                       │  │  │
          ┌────────────┘  │  └────────────┐
          │               │               │
   ┌──────▼──────┐  ┌────▼─────┐  ┌──────▼──────┐
   │  Tech Dept  │  │Coordinator│  │Business Dept│
   │             │  │(Cross-cut)│  │             │
   │ CTO ──→ Ops │  └──────────┘  │ CMO         │
   └─────────────┘                 └─────────────┘
```

## Communication Matrix

| From ↓ \ To → | Hub | CTO | DevOps | CMO | Coordinator |
|----------------|-----|-----|--------|-----|-------------|
| **Hub** | - | ✓ | ✓ | ✓ | ✓ |
| **CTO** | ✓ | - | ✓ (direct) | ✓ | - |
| **DevOps** | ✓ | ✓ (direct) | - | - | - |
| **CMO** | ✓ | ✓ | - | - | - |
| **Coordinator** | ✓ | ✓ | ✓ | ✓ | - |

## Mailbox Directories

```bash
mkdir -p mailbox/{hub-to-cto,cto-to-hub}
mkdir -p mailbox/{hub-to-devops,devops-to-hub}
mkdir -p mailbox/{hub-to-cmo,cmo-to-hub}
mkdir -p mailbox/{hub-to-coordinator,coordinator-to-hub}
mkdir -p mailbox/{cto-to-devops,devops-to-cto}
mkdir -p mailbox/{cto-to-cmo,cmo-to-cto}
mkdir -p mailbox/{coordinator-to-cto,coordinator-to-cmo,coordinator-to-devops}
```

## Collaboration Protocol

1. **You → Hub**: Strategic direction, priorities, decisions
2. **Hub → All Agents**: Decomposed tasks with context
3. **CTO → DevOps**: Architecture decisions → deployment execution
4. **CTO ↔ CMO**: Technical accuracy ↔ narrative power
5. **Coordinator → All**: Progress tracking, blocker alerts, status syncs
6. **Hub → You**: Synthesized results, consolidated status reports

## SOPs

| Agent | Daily SOP | Hourly SOP |
|-------|-----------|------------|
| Hub | Status report, mailbox, issues | - |
| CTO | Code review queue, PR status | - |
| DevOps | Infrastructure health report | Service monitoring, key checks |
| CMO | Content pipeline status | - |
| Coordinator | Project dashboard, risk scan | Mailbox scan, progress update |

## Governance

1. **No vague acceleration** — "Do it faster" requires specifying what to sacrifice
2. **Quality baseline non-negotiable** — All outputs self-reviewed before delivery
3. **External actions require human confirmation** — Publish, send, deploy = ask first
