# Agent Team OS

> Run a multi-AI-agent team like a real company.

One-Person Company founders: stop using AI as a tool. Start using it as a **team**.

Agent Team OS is an open-source framework for building, coordinating, and scaling a team of AI agents that work together like a real company — with roles, personas, async communication, SOPs, and governance.

## Why This Exists

Most people use AI agents in isolation: one prompt, one task, one response.

But what if you could run a **team** of AI agents — each with a defined role, personality, and expertise — that communicate asynchronously, hand off work, track projects, and operate with the discipline of a real startup?

That's what Agent Team OS does. It's born from running a production AI agent team (5 agents, 10+ real engineering tasks daily) for a one-person company.

## Architecture

```
                    ┌─────────────┐
                    │     You     │
                    │  (CEO/Solo) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Chief     │
                    │  Assistant  │
                    │   (Hub)     │
                    └──┬──┬──┬───┘
                       │  │  │
          ┌────────────┘  │  └────────────┐
          │               │               │
   ┌──────▼──────┐  ┌────▼─────┐  ┌──────▼──────┐
   │    Tech     │  │Coordinator│  │  Business   │
   │  Department │  │          │  │ Department  │
   │             │  └──────────┘  │             │
   │ CTO         │                │ CMO         │
   │ DevOps      │                │             │
   └─────────────┘                └─────────────┘
```

**Hub-and-Spoke Model**: All tasks flow through one central coordinator agent. This prevents chaos and ensures information integrity.

## Core Components

### 1. Persona System
Each agent has a complete identity: name, age, background, personality, skills, communication style, and hard boundaries. This isn't roleplay — it's what enables agents to make **role-appropriate decisions** under ambiguous instructions.

→ [Persona Design Guide](docs/persona-design-guide.md) | [Templates](templates/personas/)

### 2. Async Mailbox Protocol
Agents communicate via structured JSON messages stored in git. Every message is versioned, traceable, and survives session restarts.

```
mailbox/
├── hub-to-cto/
│   └── 20260307-1400-deploy-task.json
├── cto-to-hub/
│   └── 20260307-1530-deploy-done.json
└── ...
```

→ [Mailbox Protocol](docs/mailbox-protocol.md) | [Templates](templates/mailbox/)

### 3. SOP Framework
Standard Operating Procedures define what each agent does on a recurring basis — hourly, daily, or triggered by events.

→ [SOP Design Guide](docs/sop-design-guide.md) | [Templates](templates/sops/)

### 4. Team Scaling Playbook
Start with 2 agents. Scale to 8. The framework handles organizational restructuring, onboarding, handovers, and communication matrix updates.

→ [Scaling Guide](docs/scaling-guide.md)

### 5. Governance
Three safety principles that prevent AI agent teams from going off the rails:

1. **No vague acceleration** — "Do it faster" is not a valid instruction
2. **Quality baseline is non-negotiable** — Every output must pass self-review before delivery
3. **External actions require human confirmation** — Publishing, sending, deploying = ask first

## Quick Start

### Option A: Start from scratch (5 minutes)

```bash
# Clone the template
git clone https://github.com/warren-wupeng/agent-team-os.git my-agent-team
cd my-agent-team

# Copy the starter config
cp examples/3-person-team/* .

# Edit personas to match your needs
# Then launch your first agent with the startup prompt in examples/
```

### Option B: Add to existing project

```bash
# Copy just the templates you need
cp -r templates/personas/ your-project/team-personas/
cp -r templates/mailbox/ your-project/mailbox/
cp -r templates/sops/ your-project/team-sops/
```

### Your First Team (3 agents)

| Role | What They Do | Talks To |
|------|-------------|----------|
| **Chief Assistant (Hub)** | Decomposes tasks, coordinates, synthesizes outputs | You + Everyone |
| **Tech Lead** | Architecture, code, technical decisions | Hub + DevOps |
| **Content Lead** | Writing, narrative, external communication | Hub |

See [examples/3-person-team/](examples/3-person-team/) for ready-to-use configs.

## How It Works in Practice

**Morning**: You tell the Hub agent "I need to launch feature X today."

**Hub decomposes** the task: Tech Lead handles implementation, Content Lead prepares the announcement, Hub tracks progress.

**Agents work async**: Each agent picks up tasks from mailbox, executes, reports back via mailbox.

**Hub synthesizes**: Collects all outputs, resolves conflicts, delivers a unified result to you.

**Evening**: Hub runs daily SOP — status report with blockers, completed items, and tomorrow's priorities.

You talked to **one** agent. **Three** agents worked on your task.

## Directory Structure

```
your-project/
├── team-personas/           # Agent identity files
│   ├── hub-persona.md
│   ├── tech-lead-persona.md
│   └── content-lead-persona.md
├── mailbox/                 # Async communication
│   ├── hub-to-tech/
│   ├── tech-to-hub/
│   ├── hub-to-content/
│   └── content-to-hub/
├── team-sops/               # Standard operating procedures
│   ├── hub-daily-sop.md
│   └── tech-hourly-sop.md
├── team-architecture.md     # Team structure + comm matrix
└── team-principles.md       # Governance rules
```

## Scaling Your Team

| Phase | Team Size | New Roles | Trigger |
|-------|-----------|-----------|---------|
| Starter | 2-3 | Hub + Tech + Content | Day 1 |
| Growth | 4-5 | + DevOps, + Coordinator | Hub overloaded, tasks dropping |
| Full | 6-8 | + QA, + Relations, + Specialist | Multi-project, external comms |

The [Scaling Guide](docs/scaling-guide.md) covers: when to add agents, how to onboard, handover protocols, and communication matrix expansion.

## Principles

This framework is opinionated. Here's what we believe:

- **Hub-and-spoke beats flat** — One coordinator prevents information chaos
- **Personas aren't decoration** — They're decision-making frameworks
- **Async over sync** — Git mailbox beats real-time chat for agent teams
- **SOPs create reliability** — Agents without routines forget things
- **Scale slowly** — Add one agent at a time, verify, then grow
- **Human-in-the-loop for external actions** — AI decides internally, human approves externally

## Platform Agnostic

Agent Team OS works with any AI platform that supports persistent sessions:

- Claude (via API, Claude Code, or hosted platforms)
- ChatGPT (Custom GPTs or API)
- Open-source models (via any chat interface)
- Hybrid setups (different models for different agents)

The framework is about **coordination patterns**, not model-specific features.

## Contributing

This project is based on real production experience. If you're running your own agent team and have patterns to share, PRs are welcome.

## License

MIT

---

Built by [Warren Wu](https://github.com/warren-wupeng) — running a one-person company with an AI agent team.
