# Persona Design Guide

## Why Personas Matter

An agent without a persona is a generic chatbot. An agent with a persona makes **role-appropriate decisions** when instructions are ambiguous.

When you say "handle this," a CTO persona will think about architecture trade-offs. A CMO persona will think about narrative impact. A Coordinator persona will think about who's blocked.

## Persona Template

Every persona should define these sections:

### 1. Identity
```yaml
Name: [Full name, feels real]
Age: [25-45, affects experience level and communication style]
Role: [Job title]
```

### 2. Background
A 4-6 bullet career story. Include:
- Education (affects technical depth and communication style)
- 2-3 career stops (shows what shaped their expertise)
- Why they chose this role (motivation)

**Tip**: Backgrounds with specific company/school names feel more real than generic descriptions.

### 3. Core Capabilities
Define 4-5 capability areas with specific examples. Include a "when uncertain" section — this is critical for preventing hallucination.

```yaml
Capabilities:
  1. [Area]: [What they can do, with specifics]
  2. [Area]: [What they can do, with specifics]

When uncertain:
  - "I need to verify this before giving you an answer"
  - "This is outside my core area, but here's my best reasoning..."
```

### 4. Personality & Communication Style
- 3-4 personality traits (specific, not generic)
- 2-3 catchphrases (makes the persona feel alive)
- Communication rules (formal vs casual, verbose vs terse)

### 5. Relationships
Define how this agent relates to:
- The human (CEO/founder)
- The Hub agent
- Other agents they interact with

### 6. Hard Boundaries
Non-negotiable rules:
- Never fabricate facts when uncertain
- Never skip self-review before delivering
- [Role-specific boundaries]

## Design Principles

### Be Specific, Not Generic
Bad: "Experienced software engineer"
Good: "CMU MSCS, 4 years at Databricks on Spark SQL optimizer, then YC startup Tech Lead"

### Include Flaws and Limits
Agents that claim to know everything are less useful. Define what they're NOT good at.

### Match Personality to Role
- Tech roles: precise, evidence-based, low tolerance for vagueness
- Business roles: narrative-driven, audience-aware, socially intuitive
- Coordinator roles: organized, persistent, information-hub mentality

### Test with Ambiguous Instructions
A good persona test: give the agent "handle this" with minimal context. Does it respond in a way that matches its role? If a CTO responds like a copywriter, the persona needs work.

## Examples

See [templates/personas/](../templates/personas/) for ready-to-use templates:
- `hub-chief-assistant.md` — Central coordinator
- `tech-lead-cto.md` — Technical lead
- `content-lead-cmo.md` — Content/business lead
- `devops-engineer.md` — Infrastructure/operations
- `project-coordinator.md` — Project tracking/sync
