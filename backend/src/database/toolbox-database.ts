import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DATABASE_SCHEMA_VERSION = 1;

type StoredEntity = {
  id: string;
  kind: string;
  status?: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

type EntityRow = {
  id: string;
  kind: string;
  status: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

export class ToolboxDatabase {
  readonly path: string;
  readonly connection: Database.Database;

  constructor(databasePath: string) {
    this.path = databasePath;
    if (databasePath !== ":memory:") fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.connection = new Database(databasePath, {
      timeout: 5_000,
      fileMustExist: false
    });
    this.connection.pragma("journal_mode = WAL");
    this.connection.pragma("foreign_keys = ON");
    this.connection.pragma("busy_timeout = 5000");
    this.connection.pragma("trusted_schema = OFF");
    this.migrate();
    this.recoverInterruptedTasks();
  }

  close() {
    if (this.connection.open) this.connection.close();
  }

  ready() {
    return this.connection.prepare("SELECT 1 AS ready").get() as { ready: 1 };
  }

  transaction<T>(operation: () => T): T {
    return this.connection.transaction(operation)();
  }

  list(kind: string): StoredEntity[] {
    const table = tableForKind(kind);
    const rows = (
      table === "entities"
        ? this.connection
            .prepare(
              "SELECT id, kind, status, payload_json, created_at, updated_at FROM entities WHERE kind = ? ORDER BY created_at DESC"
            )
            .all(kind)
        : this.connection
            .prepare(
              `SELECT id, ? AS kind, status, payload_json, created_at, updated_at FROM ${table} ORDER BY created_at DESC`
            )
            .all(kind)
    ) as EntityRow[];
    return rows.map(deserializeEntity);
  }

  get(kind: string, id: string): StoredEntity | undefined {
    const table = tableForKind(kind);
    const row = (
      table === "entities"
        ? this.connection
            .prepare(
              "SELECT id, kind, status, payload_json, created_at, updated_at FROM entities WHERE kind = ? AND id = ?"
            )
            .get(kind, id)
        : this.connection
            .prepare(`SELECT id, ? AS kind, status, payload_json, created_at, updated_at FROM ${table} WHERE id = ?`)
            .get(kind, id)
    ) as EntityRow | undefined;
    return row ? deserializeEntity(row) : undefined;
  }

  upsert(entity: StoredEntity) {
    const table = tableForKind(entity.kind);
    const values = {
      id: entity.id,
      kind: entity.kind,
      status: entity.status ?? null,
      payloadJson: JSON.stringify(entity.payload),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
    if (table === "entities") {
      this.connection
        .prepare(
          `INSERT INTO entities (id, kind, status, payload_json, created_at, updated_at)
           VALUES (@id, @kind, @status, @payloadJson, @createdAt, @updatedAt)
           ON CONFLICT(kind, id) DO UPDATE SET status = excluded.status,
             payload_json = excluded.payload_json, updated_at = excluded.updated_at`
        )
        .run(values);
    } else {
      this.connection
        .prepare(
          `INSERT INTO ${table} (id, status, payload_json, created_at, updated_at)
           VALUES (@id, @status, @payloadJson, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status,
             payload_json = excluded.payload_json, updated_at = excluded.updated_at`
        )
        .run(values);
    }
  }

  remove(kind: string, id: string) {
    const table = tableForKind(kind);
    return table === "entities"
      ? this.connection.prepare("DELETE FROM entities WHERE kind = ? AND id = ?").run(kind, id).changes > 0
      : this.connection.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
  }

  isDomainInitialized(kind: string) {
    return Boolean(this.connection.prepare("SELECT 1 FROM domain_state WHERE kind = ?").get(kind));
  }

  markDomainInitialized(kind: string) {
    this.connection
      .prepare("INSERT OR IGNORE INTO domain_state(kind, initialized_at) VALUES (?, ?)")
      .run(kind, new Date().toISOString());
  }

  appendAudit(event: { action: string; outcome: string; requestId?: string; actor?: string; details?: unknown }) {
    this.connection
      .prepare(
        `INSERT INTO audit_events (occurred_at, action, outcome, request_id, actor, details_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        new Date().toISOString(),
        event.action,
        event.outcome,
        event.requestId ?? null,
        event.actor ?? null,
        event.details === undefined ? null : JSON.stringify(event.details)
      );
  }

  verify() {
    const integrity = this.connection.pragma("integrity_check", { simple: true }) as string;
    const foreignKeys = this.connection.pragma("foreign_key_check") as unknown[];
    const counts = this.connection
      .prepare("SELECT 'tasks' AS kind, COUNT(*) AS count FROM tasks UNION ALL SELECT 'legacy', COUNT(*) FROM entities")
      .all() as Array<{ kind: string; count: number }>;
    return { integrity, foreignKeys, counts, schemaVersion: DATABASE_SCHEMA_VERSION };
  }

  private migrate() {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS domain_state (
        kind TEXT PRIMARY KEY,
        initialized_at TEXT NOT NULL
      ) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT,
        payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(kind, id)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS entities_status_created_idx ON entities(kind, status, created_at DESC);
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        entity_kind TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        relative_path TEXT NOT NULL UNIQUE,
        byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
        sha256 TEXT,
        media_type TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        request_id TEXT,
        actor TEXT,
        details_json TEXT CHECK(details_json IS NULL OR json_valid(details_json))
      );
    `);
    for (const table of DOMAIN_TABLES) {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id TEXT PRIMARY KEY,
          status TEXT,
          payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ${table}_status_created_idx ON ${table}(status, created_at DESC);
      `);
    }
    this.connection
      .prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)")
      .run(DATABASE_SCHEMA_VERSION, new Date().toISOString());
  }

  private recoverInterruptedTasks() {
    const now = new Date().toISOString();
    this.transaction(() => {
      for (const { table, statuses } of INTERRUPTED_WORK) {
        const placeholders = statuses.map(() => "?").join(", ");
        const rows = this.connection
          .prepare(`SELECT id, payload_json FROM ${table} WHERE status IN (${placeholders})`)
          .all(...statuses) as Array<{ id: string; payload_json: string }>;
        const update = this.connection.prepare(
          `UPDATE ${table} SET status = 'failed', payload_json = ?, updated_at = ? WHERE id = ?`
        );
        for (const row of rows) {
          const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
          update.run(
            JSON.stringify({ ...payload, status: "failed", error: "INTERRUPTED", updatedAt: now }),
            now,
            row.id
          );
        }
      }
    });
  }
}

const DOMAIN_TABLES = [
  "tasks",
  "lan_files",
  "lan_notes",
  "upload_sessions",
  "xhs_archives",
  "xhs_media",
  "translations",
  "edge_tts_tasks",
  "image_ai_tasks",
  "chatterbox_tasks",
  "chatterbox_batches",
  "chatterbox_items",
  "chatterbox_voices"
] as const;
const INTERRUPTED_WORK = [
  { table: "tasks", statuses: ["pending", "running"] },
  { table: "edge_tts_tasks", statuses: ["queued", "processing"] },
  { table: "image_ai_tasks", statuses: ["pending", "running"] },
  { table: "chatterbox_tasks", statuses: ["queued", "processing"] },
  { table: "chatterbox_items", statuses: ["queued", "processing"] }
] as const;

const KIND_TABLE: Record<string, (typeof DOMAIN_TABLES)[number] | "entities"> = {
  task: "tasks",
  "lan-file": "lan_files",
  "lan-note": "lan_notes",
  "upload-session": "upload_sessions",
  "xhs-archive": "xhs_archives",
  "xhs-media": "xhs_media",
  translation: "translations",
  "edge-tts-task": "edge_tts_tasks",
  "image-ai-task": "image_ai_tasks",
  "chatterbox-task": "chatterbox_tasks",
  "chatterbox-batch": "chatterbox_batches",
  "chatterbox-item": "chatterbox_items",
  "chatterbox-voice": "chatterbox_voices"
};

function tableForKind(kind: string) {
  return KIND_TABLE[kind] ?? "entities";
}

function deserializeEntity(row: EntityRow): StoredEntity {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status ?? undefined,
    payload: JSON.parse(row.payload_json) as unknown,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
