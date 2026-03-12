#!/usr/bin/env node

/**
 * atos MCP Server — exposes atos team coordination as MCP tools.
 *
 * Usage:
 *   node dist/mcp.js [--dir <path>] [--agent <name>]
 *
 * Or in claude_desktop_config.json / .claude/settings.json:
 *   { "command": "npx", "args": ["@warren-wu/atos-cli-mcp", "--dir", "/path/to/.atos", "--agent", "bolt"] }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openDatabase, initDatabase } from "./db.js";
import { resolve } from "node:path";
import { readFileSync, readdirSync, existsSync } from "node:fs";

// Parse CLI args for --dir and --agent
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const DIR_OVERRIDE = getArg("dir");
const AGENT_OVERRIDE = getArg("agent") || process.env.ATOS_AGENT;

function getAgent(agentParam?: string): string {
  const agent = agentParam || AGENT_OVERRIDE;
  if (!agent) {
    throw new Error("Agent identity required. Set ATOS_AGENT env var, use --agent flag, or pass agent parameter.");
  }
  return agent;
}

function getDir(): string | undefined {
  return DIR_OVERRIDE;
}

/** Find .atos/sops/ directory */
function findSopsDir(): string | null {
  if (DIR_OVERRIDE) {
    const p = resolve(DIR_OVERRIDE, "sops");
    return existsSync(p) ? p : null;
  }
  let dir = resolve(process.cwd());
  while (true) {
    const candidate = resolve(dir, ".atos", "sops");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Parse frontmatter from SOP markdown */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: match[2] };
}

/** Split markdown into step sections respecting code blocks */
function splitStepSections(body: string): string[] {
  const sections: string[] = [];
  let current = "";
  let inCodeBlock = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("```")) inCodeBlock = !inCodeBlock;
    if (!inCodeBlock && /^## Step\s+\d+/.test(line)) {
      if (current.trim()) sections.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim()) sections.push(current);
  return sections;
}

/** Parse SOP steps */
function parseSopSteps(body: string) {
  const sections = splitStepSections(body);
  return sections
    .map((section) => {
      const headerMatch = section.match(/^## Step\s+(\d+)[:\s]+(.+)/);
      if (!headerMatch) return null;
      const commands: string[] = [];
      const codeBlockRe = /```bash\n([\s\S]*?)```/g;
      let m;
      while ((m = codeBlockRe.exec(section)) !== null) {
        for (const line of m[1].split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) commands.push(trimmed);
        }
      }
      const guidance = section
        .replace(/^## Step\s+\d+[:\s]+.+\n?/, "")
        .replace(/```bash\n[\s\S]*?```/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return {
        id: Number(headerMatch[1]),
        title: headerMatch[2].trim(),
        commands,
        guidance,
      };
    })
    .filter(Boolean);
}

// ── Create MCP Server ────────────────────────────────────────────

const server = new McpServer(
  { name: "atos", version: "0.3.0" },
  { capabilities: { tools: {} } }
);

// ── Mail Tools ───────────────────────────────────────────────────

server.tool(
  "mail_inbox",
  "Check inbox for messages. Returns list of messages with id, from, subject, priority, read status.",
  {
    agent: z.string().optional().describe("Agent identity (defaults to server --agent)"),
    unread: z.boolean().optional().describe("Only unread messages"),
    from: z.string().optional().describe("Filter by sender agent"),
    since: z.string().optional().describe("Messages after this time (ISO 8601 or relative: 1h, 30m, 2d)"),
    limit: z.number().optional().default(20).describe("Max results"),
  },
  async ({ agent, unread, from, since, limit }) => {
    const a = getAgent(agent);
    const db = openDatabase(getDir());
    let sql = "SELECT id, from_agent, subject, created_at, priority, read FROM messages WHERE to_agent = ?";
    const params: unknown[] = [a];
    if (unread) { sql += " AND read = 0"; }
    if (from) { sql += " AND from_agent = ?"; params.push(from); }
    if (since) { sql += " AND created_at >= ?"; params.push(parseSinceValue(since)); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    const rows = db.prepare(sql).all(...params);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  "mail_read",
  "Read a specific message by ID. Marks it as read.",
  { id: z.number().describe("Message ID") },
  async ({ id }) => {
    const db = openDatabase(getDir());
    const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
    if (!row) { db.close(); return { content: [{ type: "text", text: `Error: Message #${id} not found.` }], isError: true }; }
    db.prepare("UPDATE messages SET read = 1 WHERE id = ?").run(id);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify({ ...(row as object), read: 1 }, null, 2) }] };
  }
);

server.tool(
  "mail_send",
  "Send a message to another agent.",
  {
    agent: z.string().optional().describe("Sender agent identity (defaults to server --agent)"),
    to: z.string().describe("Recipient agent name"),
    subject: z.string().describe("Message subject"),
    body: z.string().describe("Message body"),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional().default("P2").describe("Priority level"),
  },
  async ({ agent, to, subject, body, priority }) => {
    const a = getAgent(agent);
    const bodyBytes = Buffer.byteLength(body, "utf-8");
    if (bodyBytes > 16384) {
      return { content: [{ type: "text", text: `Error: Message body (${bodyBytes} bytes) exceeds 16KB limit.` }], isError: true };
    }
    const db = openDatabase(getDir());
    const result = db
      .prepare("INSERT INTO messages (from_agent, to_agent, subject, body, priority) VALUES (?, ?, ?, ?, ?)")
      .run(a, to, subject, body, priority);
    db.close();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ messageId: result.lastInsertRowid, from: a, to, subject, priority, timestamp: new Date().toISOString() }, null, 2),
      }],
    };
  }
);

server.tool(
  "mail_reply",
  "Reply to a message. Auto-fills recipient and 'Re:' prefix.",
  {
    agent: z.string().optional().describe("Sender agent identity"),
    id: z.number().describe("Message ID to reply to"),
    body: z.string().describe("Reply body"),
  },
  async ({ agent, id, body }) => {
    const a = getAgent(agent);
    const db = openDatabase(getDir());
    const original = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!original) { db.close(); return { content: [{ type: "text", text: `Error: Message #${id} not found.` }], isError: true }; }
    const subject = String(original.subject).startsWith("Re: ") ? String(original.subject) : `Re: ${original.subject}`;
    const result = db
      .prepare("INSERT INTO messages (from_agent, to_agent, subject, body, priority, in_reply_to) VALUES (?, ?, ?, ?, ?, ?)")
      .run(a, original.from_agent, subject, body, original.priority, id);
    db.prepare("UPDATE messages SET read = 1 WHERE id = ?").run(id);
    db.close();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ messageId: result.lastInsertRowid, from: a, to: original.from_agent, subject, inReplyTo: id, timestamp: new Date().toISOString() }, null, 2),
      }],
    };
  }
);

server.tool(
  "mail_count",
  "Count unread and total messages in inbox.",
  { agent: z.string().optional().describe("Agent identity") },
  async ({ agent }) => {
    const a = getAgent(agent);
    const db = openDatabase(getDir());
    const total = db.prepare("SELECT COUNT(*) as count FROM messages WHERE to_agent = ?").get(a) as { count: number };
    const unread = db.prepare("SELECT COUNT(*) as count FROM messages WHERE to_agent = ? AND read = 0").get(a) as { count: number };
    db.close();
    return { content: [{ type: "text", text: JSON.stringify({ unread: unread.count, total: total.count }) }] };
  }
);

server.tool(
  "mail_search",
  "Full-text search across message subjects and bodies.",
  {
    query: z.string().describe("Search query"),
    from: z.string().optional().describe("Filter by sender"),
    to: z.string().optional().describe("Filter by recipient"),
    limit: z.number().optional().default(20).describe("Max results"),
  },
  async ({ query, from, to, limit }) => {
    const db = openDatabase(getDir());
    let sql = `SELECT m.id, m.from_agent, m.to_agent, m.subject, m.created_at, m.priority, m.read,
      snippet(messages_fts, 1, '>>>', '<<<', '...', 32) as snippet
      FROM messages_fts fts JOIN messages m ON m.id = fts.rowid WHERE messages_fts MATCH ?`;
    const params: unknown[] = [query];
    if (from) { sql += " AND m.from_agent = ?"; params.push(from); }
    if (to) { sql += " AND m.to_agent = ?"; params.push(to); }
    sql += " ORDER BY fts.rank LIMIT ?";
    params.push(limit);
    const rows = db.prepare(sql).all(...params);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

// ── Task Tools ───────────────────────────────────────────────────

server.tool(
  "task_list",
  "List tasks on the shared task board.",
  {
    agent: z.string().optional().describe("Agent identity (for --mine filter)"),
    mine: z.boolean().optional().describe("Only tasks assigned to me"),
    status: z.string().optional().describe("Filter by status (open|done|blocked|in-progress)"),
    assignee: z.string().optional().describe("Filter by assignee"),
  },
  async ({ agent, mine, status, assignee }) => {
    const db = openDatabase(getDir());
    let sql = "SELECT id, title, status, assignee, priority, created_by, created_at FROM tasks WHERE 1=1";
    const params: unknown[] = [];
    if (mine) { const a = getAgent(agent); sql += " AND assignee = ?"; params.push(a); }
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (assignee) { sql += " AND assignee = ?"; params.push(assignee); }
    sql += " ORDER BY priority ASC, created_at ASC";
    const rows = db.prepare(sql).all(...params);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  "task_show",
  "Show full details of a task.",
  { id: z.number().describe("Task ID") },
  async ({ id }) => {
    const db = openDatabase(getDir());
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!row) { db.close(); return { content: [{ type: "text", text: `Error: Task #${id} not found.` }], isError: true }; }
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }] };
  }
);

server.tool(
  "task_create",
  "Create a new task on the shared task board.",
  {
    agent: z.string().optional().describe("Creator agent identity"),
    title: z.string().describe("Task title"),
    description: z.string().optional().default("").describe("Task description"),
    assignee: z.string().optional().describe("Assign to agent"),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional().default("P2").describe("Priority level"),
  },
  async ({ agent, title, description, assignee, priority }) => {
    const a = getAgent(agent);
    const db = openDatabase(getDir());
    const result = db
      .prepare("INSERT INTO tasks (title, description, status, assignee, priority, created_by) VALUES (?, ?, 'open', ?, ?, ?)")
      .run(title, description, assignee || null, priority, a);
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }] };
  }
);

server.tool(
  "task_update",
  "Update a task's status, assignee, priority, or title.",
  {
    id: z.number().describe("Task ID"),
    status: z.string().optional().describe("New status (open|in-progress|blocked|done)"),
    assignee: z.string().optional().describe("Reassign to agent"),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional().describe("New priority"),
    title: z.string().optional().describe("New title"),
  },
  async ({ id, status, assignee, priority, title }) => {
    const db = openDatabase(getDir());
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!row) { db.close(); return { content: [{ type: "text", text: `Error: Task #${id} not found.` }], isError: true }; }
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];
    if (status) { sets.push("status = ?"); params.push(status); }
    if (assignee) { sets.push("assignee = ?"); params.push(assignee); }
    if (priority) { sets.push("priority = ?"); params.push(priority); }
    if (title) { sets.push("title = ?"); params.push(title); }
    params.push(id);
    db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
  }
);

server.tool(
  "task_done",
  "Mark a task as done with an optional completion note.",
  {
    id: z.number().describe("Task ID"),
    note: z.string().optional().describe("Completion note"),
  },
  async ({ id, note }) => {
    const db = openDatabase(getDir());
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) { db.close(); return { content: [{ type: "text", text: `Error: Task #${id} not found.` }], isError: true }; }
    const desc = note ? `${row.description}\n\n[Done] ${note}`.trim() : String(row.description);
    db.prepare("UPDATE tasks SET status = 'done', description = ?, updated_at = datetime('now') WHERE id = ?").run(desc, id);
    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
  }
);

server.tool(
  "task_search",
  "Full-text search across task titles and descriptions.",
  {
    query: z.string().describe("Search query"),
    status: z.string().optional().describe("Filter by status"),
    assignee: z.string().optional().describe("Filter by assignee"),
    limit: z.number().optional().default(20).describe("Max results"),
  },
  async ({ query, status, assignee, limit }) => {
    const db = openDatabase(getDir());
    let sql = `SELECT t.id, t.title, t.status, t.assignee, t.priority, t.created_by, t.created_at,
      snippet(tasks_fts, 1, '>>>', '<<<', '...', 32) as snippet
      FROM tasks_fts fts JOIN tasks t ON t.id = fts.rowid WHERE tasks_fts MATCH ?`;
    const params: unknown[] = [query];
    if (status) { sql += " AND t.status = ?"; params.push(status); }
    if (assignee) { sql += " AND t.assignee = ?"; params.push(assignee); }
    sql += " ORDER BY fts.rank LIMIT ?";
    params.push(limit);
    const rows = db.prepare(sql).all(...params);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

// ── SOP Tools ────────────────────────────────────────────────────

server.tool(
  "sop_list",
  "List available Standard Operating Procedures.",
  { role: z.string().optional().describe("Filter by agent role") },
  async ({ role }) => {
    const sopsDir = findSopsDir();
    if (!sopsDir) return { content: [{ type: "text", text: "[]" }] };
    const files = readdirSync(sopsDir).filter((f) => f.endsWith(".md"));
    const sops = files.map((f) => {
      const raw = readFileSync(resolve(sopsDir, f), "utf-8");
      const { meta } = parseFrontmatter(raw);
      return {
        name: meta.name || f.replace(".md", ""),
        role: meta.role || "",
        frequency: meta.frequency || "",
        description: meta.description || "",
      };
    });
    const filtered = role ? sops.filter((s) => s.role === role) : sops;
    return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
  }
);

server.tool(
  "sop_show",
  "Show raw SOP markdown content.",
  { name: z.string().describe("SOP name (filename without .md)") },
  async ({ name }) => {
    const sopsDir = findSopsDir();
    if (!sopsDir) return { content: [{ type: "text", text: `Error: No .atos/sops directory found.` }], isError: true };
    const filePath = resolve(sopsDir, `${name}.md`);
    if (!existsSync(filePath)) return { content: [{ type: "text", text: `Error: SOP "${name}" not found.` }], isError: true };
    const content = readFileSync(filePath, "utf-8");
    return { content: [{ type: "text", text: content }] };
  }
);

server.tool(
  "sop_start",
  "Parse SOP into structured steps for agent execution. Returns steps with commands and guidance.",
  { name: z.string().describe("SOP name to execute") },
  async ({ name }) => {
    const sopsDir = findSopsDir();
    if (!sopsDir) return { content: [{ type: "text", text: `Error: No .atos/sops directory found.` }], isError: true };
    const filePath = resolve(sopsDir, `${name}.md`);
    if (!existsSync(filePath)) return { content: [{ type: "text", text: `Error: SOP "${name}" not found.` }], isError: true };
    const raw = readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const steps = parseSopSteps(body);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          sop: meta.name || name,
          role: meta.role || "",
          totalSteps: steps.length,
          steps,
        }, null, 2),
      }],
    };
  }
);

// ── Config Tools ─────────────────────────────────────────────────

server.tool(
  "config_get",
  "Get a team config value.",
  { key: z.string().describe("Config key") },
  async ({ key }) => {
    const db = openDatabase(getDir());
    const row = db.prepare("SELECT value FROM _meta WHERE key = ?").get(key) as { value: string } | undefined;
    db.close();
    if (!row) return { content: [{ type: "text", text: `Error: Key "${key}" not found.` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify({ key, value: row.value }) }] };
  }
);

server.tool(
  "config_set",
  "Set a team config value.",
  {
    key: z.string().describe("Config key"),
    value: z.string().describe("Config value"),
  },
  async ({ key, value }) => {
    const db = openDatabase(getDir());
    db.prepare("INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
    db.close();
    return { content: [{ type: "text", text: JSON.stringify({ key, value, status: "saved" }) }] };
  }
);

server.tool(
  "config_list",
  "List all team config values.",
  {},
  async () => {
    const db = openDatabase(getDir());
    const rows = db.prepare("SELECT key, value FROM _meta ORDER BY key").all();
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

// ── Team Tools ───────────────────────────────────────────────────

server.tool(
  "team_members",
  "List all agents on the team.",
  {},
  async () => {
    const db = openDatabase(getDir());
    const rows = db.prepare("SELECT agent, role, persona_file, joined_at FROM team ORDER BY joined_at ASC").all();
    db.close();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

// ── Helper ───────────────────────────────────────────────────────

function toSqliteDatetime(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function parseSinceValue(value: string): string {
  const match = value.match(/^(\d+)([mhd])$/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    const ms = unit === "m" ? amount * 60_000 : unit === "h" ? amount * 3_600_000 : amount * 86_400_000;
    return toSqliteDatetime(new Date(Date.now() - ms));
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new Error(`Invalid --since value "${value}"`);
  return toSqliteDatetime(d);
}

// ── Start Server ─────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
