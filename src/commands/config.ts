import { Command } from "commander";
import { openDatabase } from "../db.js";
import { output, type Format } from "../utils/output.js";

interface MetaRow {
  key: string;
  value: string;
}

export function registerConfigCommands(
  program: Command,
  getFormat: () => Format,
  getDir: () => string | undefined
): void {
  const config = program.command("config").description("Manage team settings");

  config
    .command("get")
    .argument("<key>", "Config key")
    .description("Get a config value")
    .action((key: string) => {
      const db = openDatabase(getDir());
      const row = db
        .prepare("SELECT value FROM _meta WHERE key = ?")
        .get(key) as { value: string } | undefined;
      db.close();
      if (!row) {
        process.stderr.write(`Error: Key "${key}" not found.\n`);
        process.exit(1);
      }
      output({ key, value: row.value }, getFormat());
    });

  config
    .command("set")
    .argument("<key>", "Config key")
    .argument("<value>", "Config value")
    .description("Set a config value")
    .action((key: string, value: string) => {
      const db = openDatabase(getDir());
      db.prepare(
        "INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(key, value);
      db.close();
      output({ key, value, status: "saved" }, getFormat());
    });

  config
    .command("list")
    .description("List all config values")
    .action(() => {
      const db = openDatabase(getDir());
      const rows = db.prepare("SELECT key, value FROM _meta ORDER BY key").all() as MetaRow[];
      db.close();
      output(rows, getFormat());
    });

  config
    .command("delete")
    .argument("<key>", "Config key to remove")
    .description("Delete a config value")
    .action((key: string) => {
      if (key === "schema_version") {
        process.stderr.write("Error: Cannot delete schema_version.\n");
        process.exit(1);
      }
      const db = openDatabase(getDir());
      const result = db.prepare("DELETE FROM _meta WHERE key = ?").run(key);
      db.close();
      if (result.changes === 0) {
        process.stderr.write(`Error: Key "${key}" not found.\n`);
        process.exit(1);
      }
      output({ key, status: "deleted" }, getFormat());
    });
}
