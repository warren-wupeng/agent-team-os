# RFC: AI-Friendly CLI Output Format

> Status: Open
> Date: 2026-03-12
> Related: [v2-architecture.md](./v2-architecture.md)

## Question

What output format should `atos` CLI default to for maximum AI agent compatibility?

This document collects research and arguments for each candidate format.

## Candidates

### 1. JSON

```json
{"messageId": "msg-001", "from": "hub", "to": "cto", "subject": "Deploy task", "date": "2026-03-12T14:00:00Z", "unread": true}
```

**Pros:**
- Universal parsing support in all languages
- MCP standard uses JSON-RPC
- Every LLM has been trained extensively on JSON
- Unambiguous structure (no indentation sensitivity)
- Tools ecosystem: `jq`, `fx`, `gron`

**Cons:**
- Token-heavy: braces, quotes, commas consume tokens
- Deeply nested JSON is harder for LLMs to navigate
- Long JSON blobs can push useful content out of context window
- Keys repeat for every object in arrays

**Token cost example (3 messages inbox):**
```json
[{"id":"msg-001","from":"hub","subject":"Deploy staging","unread":true},{"id":"msg-002","from":"devops","subject":"CI green","unread":false},{"id":"msg-003","from":"hub","subject":"Review PR #42","unread":true}]
```
~65 tokens

### 2. Markdown Table

```
| id      | from   | subject         | unread |
|---------|--------|-----------------|--------|
| msg-001 | hub    | Deploy staging  | true   |
| msg-002 | devops | CI green        | false  |
| msg-003 | hub    | Review PR #42   | true   |
```

**Pros:**
- Extremely natural for LLMs (trained on tons of markdown)
- Compact for tabular data
- Human-readable without any processing
- LLMs can reason about table contents directly

**Cons:**
- Not machine-parseable without custom parser
- Column alignment is fragile
- Can't represent nested/hierarchical data
- Escaping issues with `|` in content

**Token cost:** ~45 tokens (30% fewer than JSON for tabular data)

### 3. YAML

```yaml
- id: msg-001
  from: hub
  subject: Deploy staging
  unread: true
- id: msg-002
  from: devops
  subject: CI green
  unread: false
```

**Pros:**
- More readable than JSON
- Less token overhead (no braces/quotes for keys)
- Good for configuration-like data

**Cons:**
- Indentation-sensitive (LLMs sometimes get indentation wrong)
- Ambiguous type coercion (`yes`/`no` vs `true`/`false`)
- Multiple syntax styles cause confusion
- Less universally parsed than JSON

**Token cost:** ~50 tokens

### 4. Line-Delimited Key-Value

```
[msg-001] from=hub subject="Deploy staging" unread=true
[msg-002] from=devops subject="CI green" unread=false
[msg-003] from=hub subject="Review PR #42" unread=true
```

**Pros:**
- Extremely compact
- One item per line (grep-friendly)
- LLMs parse this easily
- Minimal token overhead

**Cons:**
- No standard specification
- Escaping complex values is ad-hoc
- Can't represent nested data
- Custom parser needed

**Token cost:** ~35 tokens (46% fewer than JSON)

### 5. Hybrid: JSON for single items, Table for lists

```bash
# Single item → JSON (structured, complete)
$ atos mail read msg-001
{"id": "msg-001", "from": "hub", "to": "cto", "subject": "Deploy staging", "body": "Please deploy PR #42 to staging...", "date": "2026-03-12T14:00:00Z"}

# List → compact table
$ atos mail inbox
id       from    subject          unread  date
msg-001  hub     Deploy staging   true    2026-03-12T14:00
msg-002  devops  CI green         false   2026-03-12T14:30
msg-003  hub     Review PR #42    true    2026-03-12T15:00

3 messages (2 unread)
```

**Pros:**
- Best of both worlds: structured detail for single items, compact overview for lists
- Matches how humans and AIs naturally consume data
- JSON for programmatic access, table for at-a-glance understanding

**Cons:**
- Inconsistent format complicates automated parsing
- Need `--format json` override for scripts that always want JSON

## Community Research Findings

### Industry Standard: JSON Dominates

**What major tools use:**
- **GitHub CLI (`gh`)**: `--json` flag with jq filtering and Go templates
- **kubectl**: `-o json` and `-o yaml` as machine-readable options
- **MCP protocol**: JSON-RPC (all MCP servers use JSON)
- **OpenAI / Anthropic / Google function calling**: All JSON-based
- **LangChain, Instructor, Outlines**: Pydantic models serialized to JSON

**clig.dev (Command Line Interface Guidelines) recommends:**
1. Human-readable output by default (plain text)
2. Add `--json` flag for machine-readable output
3. JSON is the recommended machine format for structured data

### Token Efficiency Reality Check

For typical CLI output (~100 tokens worth of data):
- JSON compact: ~100 tokens
- YAML: ~95-105 tokens
- Plain text: ~90-100 tokens
- XML: ~150-200 tokens

**The difference is negligible** (5-10%). Format validity matters more than raw token savings.

### LLM Parsing Accuracy

From Anthropic's "Building Effective Agents" research:

> "Some formats are much more difficult for an LLM to write than others... JSON requires extra newline and quote escaping compared to markdown code blocks."

Key insight: The distinction is between LLMs **reading** vs **writing** structured formats:
- **Reading JSON**: LLMs are excellent at this (extensively trained on JSON)
- **Writing JSON**: LLMs sometimes generate invalid JSON (trailing commas, unescaped quotes)
- **Reading plain text**: Also excellent, more forgiving
- **Writing plain text**: Trivially reliable

For a CLI tool, we control the output (writing). The consumer (LLM) only reads. So **writing accuracy is our problem, reading accuracy is the LLM's** — and LLMs read JSON well.

### What Claude Code Does (Empirical)

Claude Code's own tools use mixed formats:
- `Read` tool: Returns file contents as plain text with line numbers
- `Grep` tool: Returns structured results with file paths and line content
- `Bash` tool: Returns raw stdout/stderr as-is
- Internal complex operations: Structured objects

This suggests: **match the format to the data's natural structure**, not one-size-fits-all.

### Anthropic's XML Tag Recommendation

Anthropic recommends XML tags **in prompts** (not outputs) because:
- Clear hierarchical boundaries
- Less common in user text (fewer collisions)
- Easy to extract with regex

However, this is for prompt engineering, not tool output design.

## Recommendation

**Default: JSON for all structured output. `--format human` for human-readable mode.**

Rationale:

1. **JSON is what agents expect.** Every function-calling API, every MCP server, every tool framework uses JSON. Swimming against this current creates friction.

2. **Token efficiency difference is negligible.** 5-10% savings from alternative formats doesn't justify the compatibility cost.

3. **We control the writing side.** Since `atos` generates the output (not the LLM), JSON validity is guaranteed — the LLM's occasional JSON writing issues don't apply.

4. **`jq` integration is free.** Users get `atos mail inbox | jq '.[] | select(.unread)'` for zero implementation cost.

5. **MCP wrapper is trivial.** JSON output → JSON MCP response requires no transformation.

6. **One format, one parser.** Agent developers don't need to handle format-switching logic.

### Output Convention

```bash
# Structured data → compact JSON (one line for simple, formatted for complex)
$ atos mail inbox --unread
[{"id":"msg-001","from":"hub","subject":"Deploy staging","date":"2026-03-12T14:00:00Z"}]

# Single item → formatted JSON
$ atos mail read msg-001
{
  "id": "msg-001",
  "from": "hub",
  "to": "cto",
  "subject": "Deploy staging",
  "body": "Please deploy PR #42 to staging and run smoke tests.",
  "date": "2026-03-12T14:00:00Z",
  "priority": "P1"
}

# Status/action confirmation → JSON with status field
$ atos mail send --to hub --subject "Done" --body "Deployed."
{"ok": true, "messageId": "msg-004"}

# Errors → JSON to stderr
$ atos mail read nonexistent
{"error": "message_not_found", "message": "No message with id 'nonexistent'"}

# Human mode → pretty-printed
$ atos mail inbox --format human
  INBOX (2 unread)
  msg-001  [P1] hub     Deploy staging   2026-03-12 14:00  *NEW*
  msg-002       devops  CI green         2026-03-12 14:30
```

### JSON Design Rules for AI Friendliness

1. **Flat over nested.** Prefer `{"userName": "kira"}` over `{"user": {"name": "kira"}}`
2. **Consistent field names.** Same field = same name across all commands
3. **ISO 8601 dates.** Always `"2026-03-12T14:00:00Z"`, never Unix timestamps in output
4. **Booleans over strings.** `"unread": true` not `"unread": "yes"`
5. **Arrays for lists, objects for items.** Never a single item wrapped in an array
6. **Include a summary line for lists.** After JSON array, add `\n// 3 messages (2 unread)` as a non-JSON comment line — LLMs read this naturally, JSON parsers ignore lines starting with `//`

## References

- Anthropic, "Building Effective Agents" research article
- clig.dev — Command Line Interface Guidelines
- GitHub CLI docs: cli.github.com/manual/gh_help_formatting
- Kubernetes docs: kubectl output format reference
- Eugene Yan, "LLM Patterns for Production"
