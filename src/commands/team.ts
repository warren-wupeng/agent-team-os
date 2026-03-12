import { Command } from "commander";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { initDatabase, openDatabase } from "../db.js";
import { output, type Format } from "../utils/output.js";

export function registerTeamCommands(
  program: Command,
  getFormat: () => Format,
  getDir: () => string | undefined
): void {
  const team = program.command("team").description("Team management");

  team
    .command("init")
    .argument("<name>", "Team name")
    .description("Initialize a new team")
    .action((name: string) => {
      const dir = getDir() || ".atos";
      const atosDir = resolve(dir);
      if (existsSync(resolve(atosDir, "atos.db"))) {
        process.stderr.write(
          `Error: Team already initialized at ${atosDir}\n`
        );
        process.exit(1);
      }
      mkdirSync(resolve(atosDir, "personas"), { recursive: true });
      mkdirSync(resolve(atosDir, "sops"), { recursive: true });
      const db = initDatabase(atosDir);
      db.prepare("INSERT OR IGNORE INTO _meta (key, value) VALUES (?, ?)").run(
        "team_name",
        name
      );
      db.close();
      output(
        { team: name, dir: atosDir, status: "initialized" },
        getFormat()
      );
    });

  team
    .command("join")
    .requiredOption("--name <name>", "Agent name")
    .requiredOption("--role <role>", "Agent role")
    .option("--persona <file>", "Persona file path")
    .description("Join the team as an agent")
    .action(
      (opts: { name: string; role: string; persona?: string }) => {
        const db = openDatabase(getDir());
        const existing = db
          .prepare("SELECT agent FROM team WHERE agent = ?")
          .get(opts.name);
        if (existing) {
          process.stderr.write(
            `Error: Agent "${opts.name}" already exists.\n`
          );
          db.close();
          process.exit(1);
        }
        db.prepare(
          "INSERT INTO team (agent, role, persona_file) VALUES (?, ?, ?)"
        ).run(opts.name, opts.role, opts.persona || null);
        db.close();
        output(
          {
            agent: opts.name,
            role: opts.role,
            persona: opts.persona || null,
            status: "joined",
          },
          getFormat()
        );
      }
    );

  team
    .command("members")
    .description("List team members")
    .action(() => {
      const db = openDatabase(getDir());
      const rows = db
        .prepare("SELECT agent, role, persona_file, joined_at FROM team ORDER BY joined_at")
        .all();
      db.close();
      output(rows, getFormat());
    });

  team
    .command("remove")
    .argument("<name>", "Agent name to remove")
    .description("Remove an agent from the team")
    .action((name: string) => {
      const db = openDatabase(getDir());
      const result = db
        .prepare("DELETE FROM team WHERE agent = ?")
        .run(name);
      if (result.changes === 0) {
        process.stderr.write(`Error: Agent "${name}" not found.\n`);
        db.close();
        process.exit(1);
      }
      db.prepare("DELETE FROM comm_matrix WHERE from_agent = ? OR to_agent = ?").run(
        name,
        name
      );
      db.close();
      output({ agent: name, status: "removed" }, getFormat());
    });
}
