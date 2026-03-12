import Database from "better-sqlite3";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team (
  agent        TEXT PRIMARY KEY,
  role         TEXT NOT NULL,
  persona_file TEXT,
  joined_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comm_matrix (
  from_agent   TEXT NOT NULL,
  to_agent     TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'hub-routed',
  PRIMARY KEY (from_agent, to_agent)
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent  TEXT NOT NULL,
  to_agent    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  priority    TEXT NOT NULL DEFAULT 'P2',
  read        INTEGER NOT NULL DEFAULT 0,
  in_reply_to INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (in_reply_to) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_to_unread ON messages(to_agent, read);
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_agent);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',
  assignee    TEXT,
  priority    TEXT NOT NULL DEFAULT 'P2',
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee, status);
`;

const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  subject, body, content=messages, content_rowid=id
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, body) VALUES (new.id, new.subject, new.body);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  title, description, content=tasks, content_rowid=id
);

CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
END;
`;

function findAtosDir(startDir: string): string | null {
  let dir = resolve(startDir);
  while (true) {
    const candidate = resolve(dir, ".atos");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function initDatabase(atosDir: string): Database.Database {
  mkdirSync(atosDir, { recursive: true });
  const dbPath = resolve(atosDir, "atos.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = DELETE");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.exec(FTS_SQL);
  db.prepare("INSERT OR IGNORE INTO _meta (key, value) VALUES (?, ?)").run(
    "schema_version",
    String(SCHEMA_VERSION)
  );
  return db;
}

export function openDatabase(dirOverride?: string): Database.Database {
  const atosDir = dirOverride
    ? resolve(dirOverride)
    : findAtosDir(process.cwd());
  if (!atosDir) {
    process.stderr.write(
      "Error: No .atos directory found. Run `atos team init` first.\n"
    );
    process.exit(1);
  }
  const dbPath = resolve(atosDir, "atos.db");
  if (!existsSync(dbPath)) {
    process.stderr.write(
      `Error: Database not found at ${dbPath}. Run \`atos team init\` first.\n`
    );
    process.exit(1);
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = DELETE");
  db.pragma("foreign_keys = ON");
  return db;
}
