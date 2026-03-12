import { Command } from "commander";
import { readFileSync } from "node:fs";
import { openDatabase } from "../db.js";
import { getAgent } from "../utils/config.js";
import { output, checkMessageSize, type Format } from "../utils/output.js";

/** Format Date as SQLite-compatible datetime string (YYYY-MM-DD HH:MM:SS) */
function toSqliteDatetime(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

/** Parse --since value: ISO 8601 string or relative shorthand (1h, 30m, 2d) */
function parseSince(value: string): string {
  const match = value.match(/^(\d+)([mhd])$/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    const ms = unit === "m" ? amount * 60_000 : unit === "h" ? amount * 3_600_000 : amount * 86_400_000;
    return toSqliteDatetime(new Date(Date.now() - ms));
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    process.stderr.write(`Error: Invalid --since value "${value}". Use ISO 8601 or relative (e.g. 1h, 30m, 2d).\n`);
    process.exit(1);
  }
  return toSqliteDatetime(d);
}

interface MessageRow {
  id: number;
  from_agent: string;
  to_agent: string;
  subject: string;
  body: string;
  priority: string;
  read: number;
  in_reply_to: number | null;
  created_at: string;
}

export function registerMailCommands(
  program: Command,
  getFormat: () => Format,
  getDir: () => string | undefined,
  getAgentFlag: () => string | undefined
): void {
  const mail = program.command("mail").description("Mailbox");

  mail
    .command("send")
    .requiredOption("--to <agent>", "Recipient agent")
    .requiredOption("--subject <subject>", "Message subject")
    .option("--body <body>", "Message body")
    .option("--body-file <path>", "Read message body from file")
    .option("--priority <level>", "Priority (P0-P3)", "P2")
    .description("Send a message")
    .action(
      (opts: {
        to: string;
        subject: string;
        body?: string;
        bodyFile?: string;
        priority: string;
      }) => {
        let body: string;
        if (opts.bodyFile) {
          body = readFileSync(opts.bodyFile, "utf-8");
        } else if (opts.body) {
          body = opts.body;
        } else {
          process.stderr.write("Error: Either --body or --body-file is required.\n");
          process.exit(1);
        }
        const agent = getAgent(getAgentFlag());
        checkMessageSize(body);
        const db = openDatabase(getDir());
        const result = db
          .prepare(
            "INSERT INTO messages (from_agent, to_agent, subject, body, priority) VALUES (?, ?, ?, ?, ?)"
          )
          .run(agent, opts.to, opts.subject, body, opts.priority);
        db.close();
        output(
          {
            messageId: result.lastInsertRowid,
            from: agent,
            to: opts.to,
            subject: opts.subject,
            priority: opts.priority,
            timestamp: new Date().toISOString(),
          },
          getFormat()
        );
      }
    );

  mail
    .command("inbox")
    .option("--unread", "Show only unread messages")
    .option("--from <agent>", "Filter by sender")
    .option("--since <datetime>", "Show messages after this datetime (ISO 8601 or relative: 1h, 30m, 2d)")
    .option("--limit <n>", "Limit results", "20")
    .description("Read inbox")
    .action(
      (opts: { unread?: boolean; from?: string; since?: string; limit: string }) => {
        const agent = getAgent(getAgentFlag());
        const db = openDatabase(getDir());
        let sql = "SELECT id, from_agent, subject, created_at, priority, read FROM messages WHERE to_agent = ?";
        const params: unknown[] = [agent];
        if (opts.unread) {
          sql += " AND read = 0";
        }
        if (opts.from) {
          sql += " AND from_agent = ?";
          params.push(opts.from);
        }
        if (opts.since) {
          sql += " AND created_at >= ?";
          params.push(parseSince(opts.since));
        }
        sql += " ORDER BY created_at DESC LIMIT ?";
        params.push(Number(opts.limit));
        const rows = db.prepare(sql).all(...params);
        db.close();
        output(rows, getFormat());
      }
    );

  mail
    .command("read")
    .argument("<id>", "Message ID")
    .description("Read a specific message (marks as read)")
    .action((id: string) => {
      const db = openDatabase(getDir());
      const row = db
        .prepare("SELECT * FROM messages WHERE id = ?")
        .get(Number(id)) as MessageRow | undefined;
      if (!row) {
        process.stderr.write(`Error: Message #${id} not found.\n`);
        db.close();
        process.exit(1);
      }
      db.prepare("UPDATE messages SET read = 1 WHERE id = ?").run(Number(id));
      db.close();
      output({ ...row, read: 1 }, getFormat());
    });

  mail
    .command("reply")
    .argument("<id>", "Message ID to reply to")
    .requiredOption("--body <body>", "Reply body")
    .description("Reply to a message")
    .action((id: string, opts: { body: string }) => {
      const agent = getAgent(getAgentFlag());
      checkMessageSize(opts.body);
      const db = openDatabase(getDir());
      const original = db
        .prepare("SELECT * FROM messages WHERE id = ?")
        .get(Number(id)) as MessageRow | undefined;
      if (!original) {
        process.stderr.write(`Error: Message #${id} not found.\n`);
        db.close();
        process.exit(1);
      }
      const subject = original.subject.startsWith("Re: ")
        ? original.subject
        : `Re: ${original.subject}`;
      const result = db
        .prepare(
          "INSERT INTO messages (from_agent, to_agent, subject, body, priority, in_reply_to) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(
          agent,
          original.from_agent,
          subject,
          opts.body,
          original.priority,
          Number(id)
        );
      // Mark original as read
      db.prepare("UPDATE messages SET read = 1 WHERE id = ?").run(Number(id));
      db.close();
      output(
        {
          messageId: result.lastInsertRowid,
          from: agent,
          to: original.from_agent,
          subject,
          inReplyTo: Number(id),
          timestamp: new Date().toISOString(),
        },
        getFormat()
      );
    });

  mail
    .command("search")
    .argument("<query>", "Full-text search query")
    .option("--from <agent>", "Filter by sender")
    .option("--to <agent>", "Filter by recipient")
    .option("--limit <n>", "Limit results", "20")
    .description("Full-text search across messages")
    .action(
      (query: string, opts: { from?: string; to?: string; limit: string }) => {
        const db = openDatabase(getDir());
        let sql = `SELECT m.id, m.from_agent, m.to_agent, m.subject, m.created_at, m.priority, m.read,
          snippet(messages_fts, 1, '>>>', '<<<', '...', 32) as snippet
          FROM messages_fts fts
          JOIN messages m ON m.id = fts.rowid
          WHERE messages_fts MATCH ?`;
        const params: unknown[] = [query];
        if (opts.from) {
          sql += " AND m.from_agent = ?";
          params.push(opts.from);
        }
        if (opts.to) {
          sql += " AND m.to_agent = ?";
          params.push(opts.to);
        }
        sql += " ORDER BY fts.rank LIMIT ?";
        params.push(Number(opts.limit));
        const rows = db.prepare(sql).all(...params);
        db.close();
        output(rows, getFormat());
      }
    );

  mail
    .command("count")
    .description("Count messages")
    .action(() => {
      const agent = getAgent(getAgentFlag());
      const db = openDatabase(getDir());
      const total = db
        .prepare("SELECT COUNT(*) as count FROM messages WHERE to_agent = ?")
        .get(agent) as { count: number };
      const unread = db
        .prepare(
          "SELECT COUNT(*) as count FROM messages WHERE to_agent = ? AND read = 0"
        )
        .get(agent) as { count: number };
      db.close();
      output({ unread: unread.count, total: total.count }, getFormat());
    });
}
