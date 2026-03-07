# Team Architecture — 3-Person Starter

> Team Size: 3 | Architecture: Hub-and-Spoke
> Use this as your starting point. Scale when the Hub gets overloaded.

## Team Members

| Role | Name | Responsibilities | Persona File |
|------|------|-----------------|--------------|
| Chief Assistant (Hub) | [Your Hub name] | Task decomposition, coordination, reporting | `team-personas/hub.md` |
| Tech Lead | [Your Tech name] | Architecture, code, technical decisions | `team-personas/tech-lead.md` |
| Content Lead | [Your Content name] | Writing, narrative, external communication | `team-personas/content-lead.md` |

## Architecture

```
              ┌─────────────┐
              │     You     │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │     Hub     │
              │  (Central)  │
              └──┬───────┬──┘
                 │       │
          ┌──────▼──┐ ┌──▼───────┐
          │  Tech   │ │ Content  │
          │  Lead   │ │  Lead    │
          └─────────┘ └──────────┘
```

## Communication Matrix

| From ↓ \ To → | Hub | Tech Lead | Content Lead |
|----------------|-----|-----------|--------------|
| **Hub** | - | hub-to-tech | hub-to-content |
| **Tech Lead** | tech-to-hub | - | tech-to-content |
| **Content Lead** | content-to-hub | content-to-tech | - |

## Mailbox Directories to Create

```bash
mkdir -p mailbox/{hub-to-tech,tech-to-hub,hub-to-content,content-to-hub,tech-to-content,content-to-tech}
```

## Collaboration Protocol

1. **You → Hub**: Give instructions, ask questions, set priorities
2. **Hub → Agents**: Decomposed tasks with full context
3. **Tech ↔ Content**: Direct channel for technical accuracy in content
4. **Hub → You**: Synthesized results, status reports, decision requests

## When to Scale to 4-5

- Hub's incoming messages are 2-3x outgoing → Add **Coordinator**
- Tech Lead spending 30%+ on deployment/monitoring → Add **DevOps**
- Multiple projects running simultaneously → Add **Coordinator**
