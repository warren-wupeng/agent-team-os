import { Command } from "commander";
import { openDatabase } from "../db.js";
import { getAgent } from "../utils/config.js";
import { output, type Format } from "../utils/output.js";

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: string;
  assignee: string | null;
  priority: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function registerTaskCommands(
  program: Command,
  getFormat: () => Format,
  getDir: () => string | undefined,
  getAgentFlag: () => string | undefined
): void {
  const task = program.command("task").description("Task board");

  task
    .command("create")
    .requiredOption("--title <title>", "Task title")
    .option("--assignee <agent>", "Assign to agent")
    .option("--priority <level>", "Priority (P0-P3)", "P2")
    .option("--description <text>", "Task description", "")
    .description("Create a task")
    .action(
      (opts: {
        title: string;
        assignee?: string;
        priority: string;
        description: string;
      }) => {
        const agent = getAgent(getAgentFlag());
        const db = openDatabase(getDir());
        const result = db
          .prepare(
            "INSERT INTO tasks (title, description, status, assignee, priority, created_by) VALUES (?, ?, 'open', ?, ?, ?)"
          )
          .run(
            opts.title,
            opts.description,
            opts.assignee || null,
            opts.priority,
            agent
          );
        const row = db
          .prepare("SELECT * FROM tasks WHERE id = ?")
          .get(result.lastInsertRowid) as TaskRow;
        db.close();
        output(row, getFormat());
      }
    );

  task
    .command("list")
    .option("--mine", "Show only my tasks")
    .option("--status <status>", "Filter by status (open|done|blocked)")
    .option("--assignee <agent>", "Filter by assignee")
    .description("List tasks")
    .action(
      (opts: { mine?: boolean; status?: string; assignee?: string }) => {
        const db = openDatabase(getDir());
        let sql =
          "SELECT id, title, status, assignee, priority, created_by, created_at FROM tasks WHERE 1=1";
        const params: unknown[] = [];
        if (opts.mine) {
          const agent = getAgent(getAgentFlag());
          sql += " AND assignee = ?";
          params.push(agent);
        }
        if (opts.status) {
          sql += " AND status = ?";
          params.push(opts.status);
        }
        if (opts.assignee) {
          sql += " AND assignee = ?";
          params.push(opts.assignee);
        }
        sql += " ORDER BY priority ASC, created_at ASC";
        const rows = db.prepare(sql).all(...params);
        db.close();
        output(rows, getFormat());
      }
    );

  task
    .command("show")
    .argument("<id>", "Task ID")
    .description("Show task details")
    .action((id: string) => {
      const db = openDatabase(getDir());
      const row = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(Number(id)) as TaskRow | undefined;
      if (!row) {
        process.stderr.write(`Error: Task #${id} not found.\n`);
        db.close();
        process.exit(1);
      }
      db.close();
      output(row, getFormat());
    });

  task
    .command("update")
    .argument("<id>", "Task ID")
    .option("--status <status>", "New status (open|done|blocked)")
    .option("--assignee <agent>", "Assign to agent")
    .option("--priority <level>", "New priority (P0-P3)")
    .option("--title <title>", "New title")
    .description("Update a task")
    .action(
      (
        id: string,
        opts: {
          status?: string;
          assignee?: string;
          priority?: string;
          title?: string;
        }
      ) => {
        const db = openDatabase(getDir());
        const row = db
          .prepare("SELECT * FROM tasks WHERE id = ?")
          .get(Number(id)) as TaskRow | undefined;
        if (!row) {
          process.stderr.write(`Error: Task #${id} not found.\n`);
          db.close();
          process.exit(1);
        }
        const sets: string[] = ["updated_at = datetime('now')"];
        const params: unknown[] = [];
        if (opts.status) {
          sets.push("status = ?");
          params.push(opts.status);
        }
        if (opts.assignee) {
          sets.push("assignee = ?");
          params.push(opts.assignee);
        }
        if (opts.priority) {
          sets.push("priority = ?");
          params.push(opts.priority);
        }
        if (opts.title) {
          sets.push("title = ?");
          params.push(opts.title);
        }
        params.push(Number(id));
        db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(
          ...params
        );
        const updated = db
          .prepare("SELECT * FROM tasks WHERE id = ?")
          .get(Number(id)) as TaskRow;
        db.close();
        output(updated, getFormat());
      }
    );

  task
    .command("done")
    .argument("<id>", "Task ID")
    .option("--note <text>", "Completion note")
    .description("Mark a task as done")
    .action((id: string, opts: { note?: string }) => {
      const db = openDatabase(getDir());
      const row = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(Number(id)) as TaskRow | undefined;
      if (!row) {
        process.stderr.write(`Error: Task #${id} not found.\n`);
        db.close();
        process.exit(1);
      }
      const desc = opts.note
        ? `${row.description}\n\n[Done] ${opts.note}`.trim()
        : row.description;
      db.prepare(
        "UPDATE tasks SET status = 'done', description = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(desc, Number(id));
      const updated = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(Number(id)) as TaskRow;
      db.close();
      output(updated, getFormat());
    });
}
