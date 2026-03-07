# Scaling Guide

## When to Scale

Don't add agents preemptively. Add them when you see these signals:

| Signal | What It Means | Action |
|--------|--------------|--------|
| Hub's inbox is 3x its outbox | Hub is bottlenecked | Add Coordinator |
| Tech Lead spends 30%+ time on ops | Wrong work allocation | Add DevOps |
| Tasks fall through cracks | No one tracking progress | Add Coordinator |
| External comms delayed | Hub juggling too much | Add Content/Relations |
| Quality issues in releases | No review process | Add QA |

## Scaling Phases

### Phase 0: Solo (1 agent)
Just you and one agent. The agent serves as a general assistant. No mailbox needed — direct conversation.

### Phase 1: Starter (2-3 agents)
```
You → Hub → Tech Lead
              └──→ Content Lead
```
- Hub handles coordination + some execution
- Add mailbox for inter-agent communication
- Add daily SOP for Hub

### Phase 2: Growth (4-5 agents)
```
You → Hub → Tech Lead → DevOps
        │   └──→ Content Lead
        └──→ Coordinator (syncs with all)
```
- Hub focuses purely on coordination, delegates all execution
- DevOps takes operational burden off Tech Lead
- Coordinator tracks cross-agent progress
- Add hourly SOPs for DevOps and Coordinator

### Phase 3: Full (6-8 agents)
```
You → Hub → Tech Dept (CTO + DevOps + QA)
        │   └──→ Business Dept (CMO + Relations + Content)
        └──→ Coordinator
```
- Departments form with internal chains of command
- QA reviews Tech output before delivery
- Relations handles external communication
- Content produces marketing/documentation

## Onboarding Protocol

When adding a new agent:

### 1. Before Launch
- [ ] Write persona file (see [Persona Design Guide](persona-design-guide.md))
- [ ] Create mailbox directories (all required communication channels)
- [ ] Write SOP (daily and/or hourly)
- [ ] Update team architecture document
- [ ] Notify existing agents via mailbox

### 2. Launch
- [ ] Prepare startup prompt with:
  - Persona file content
  - Team context (who else is on the team, what they do)
  - Communication protocol (mailbox location, message format)
  - First-day tasks (3-5 concrete tasks to validate the agent works)
  - SOP to execute

### 3. After Launch
- [ ] New agent sends check-in message to Hub
- [ ] Hub replies with welcome + task confirmation
- [ ] If replacing/augmenting existing agent: initiate handover
- [ ] Coordinator verifies onboarding complete

## Handover Protocol

When one agent takes over responsibilities from another:

1. **Source agent** writes a handover document:
   - Current status of all owned tasks
   - Known issues and pitfalls
   - Access/permission boundaries
   - Pending items

2. **Hub** sends handover document to receiving agent

3. **Receiving agent** confirms:
   - Read and understood the handover
   - Has required access
   - Accepts listed responsibilities

4. **Hub** updates team architecture document

## Communication Matrix Expansion

Every time you add an agent, update the communication matrix:

1. Define which existing agents the new agent needs to talk to
2. Create mailbox directories for each channel
3. Decide: Hub-routed or direct channel?
4. Update `team-architecture.md`

**Rule of thumb**: New agent ↔ Hub is always a direct channel. New agent ↔ others only if there's a clear operational reason (e.g., DevOps ↔ Tech Lead for deployment handoffs).
