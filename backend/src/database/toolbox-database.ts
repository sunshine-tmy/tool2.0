import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DATABASE_SCHEMA_VERSION = 3;

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

type EntityTableColumn = {
  name: string;
  pk: number;
};

type LegacyEntityRow = Omit<EntityRow, "kind"> & { kind?: string | null };

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
    try {
      this.connection.pragma("journal_mode = WAL");
      this.connection.pragma("foreign_keys = ON");
      this.connection.pragma("busy_timeout = 5000");
      this.connection.pragma("trusted_schema = OFF");
      this.migrate();
      this.recoverInterruptedTasks();
    } catch (error) {
      this.connection.close();
      throw error;
    }
  }

  close() {
    if (this.connection.open) this.connection.close();
  }

  checkpoint() {
    return this.connection.pragma("wal_checkpoint(TRUNCATE)") as Array<{
      busy: number;
      log: number;
      checkpointed: number;
    }>;
  }

  ready() {
    return this.connection.prepare("SELECT 1 AS ready").get() as { ready: 1 };
  }

  verifyQuick() {
    const integrity = this.connection.pragma("quick_check(1)", { simple: true }) as string;
    const foreignKeys = this.connection.pragma("foreign_key_check") as unknown[];
    return { integrity, foreignKeys };
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

  hasCompletedLegacyMigration() {
    return Boolean(this.connection.prepare("SELECT 1 FROM legacy_migrations WHERE status = 'completed' LIMIT 1").get());
  }

  recordLegacyMigration(input: { backupId: string; sourceCount: number; recordCount: number; totalBytes: number }) {
    this.connection
      .prepare(
        `INSERT INTO legacy_migrations
           (backup_id, status, source_count, record_count, total_bytes, completed_at)
         VALUES (@backupId, 'completed', @sourceCount, @recordCount, @totalBytes, @completedAt)`
      )
      .run({ ...input, completedAt: new Date().toISOString() });
  }

  verify() {
    const integrity = this.connection.pragma("integrity_check", { simple: true }) as string;
    const foreignKeys = this.connection.pragma("foreign_key_check") as unknown[];
    const counts = ["entities", "files", "audit_events", ...DOMAIN_TABLES].map((table) => ({
      kind: table,
      count: (this.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
    }));
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
      CREATE TABLE IF NOT EXISTS legacy_migrations (
        backup_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK(status IN ('completed')),
        source_count INTEGER NOT NULL CHECK(source_count >= 0),
        record_count INTEGER NOT NULL CHECK(record_count >= 0),
        total_bytes INTEGER NOT NULL CHECK(total_bytes >= 0),
        completed_at TEXT NOT NULL
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
    `);
    this.migrateEntitiesTable();
    this.connection.exec(`
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

  private migrateEntitiesTable() {
    const columns = this.connection.pragma("table_info(entities)") as EntityTableColumn[];
    const primaryKey = columns
      .filter((column) => column.pk > 0)
      .sort((left, right) => left.pk - right.pk)
      .map((column) => column.name);
    if (columns.some((column) => column.name === "kind") && primaryKey.join(",") === "kind,id") return;

    const requiredColumns = ["id", "status", "payload_json", "created_at", "updated_at"];
    if (requiredColumns.some((name) => !columns.some((column) => column.name === name))) {
      throw new Error("Unsupported entities table schema; existing data was not modified");
    }

    this.connection.transaction(() => {
      const rows = this.connection
        .prepare("SELECT id, status, payload_json, created_at, updated_at FROM entities")
        .all() as LegacyEntityRow[];
      this.connection.exec(`
        CREATE TABLE entities_schema_v3 (
          id TEXT NOT NULL,
          kind TEXT NOT NULL,
          status TEXT,
          payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(kind, id)
        ) WITHOUT ROWID;
      `);
      const insert = this.connection.prepare(
        `INSERT INTO entities_schema_v3 (id, kind, status, payload_json, created_at, updated_at)
         VALUES (@id, @kind, @status, @payload_json, @created_at, @updated_at)`
      );
      for (const row of rows) insert.run({ ...row, kind: inferLegacyEntityKind(row.payload_json) });

      const migratedCount = (
        this.connection.prepare("SELECT COUNT(*) AS count FROM entities_schema_v3").get() as { count: number }
      ).count;
      if (migratedCount !== rows.length) throw new Error("Entities table migration row count mismatch");

      this.connection.exec(`
        DROP TABLE entities;
        ALTER TABLE entities_schema_v3 RENAME TO entities;
      `);
    })();
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

function inferLegacyEntityKind(payloadJson: string) {
  try {
    const payload = JSON.parse(payloadJson) as { kind?: unknown; source?: unknown };
    if (typeof payload.kind === "string" && payload.kind.trim()) return payload.kind.trim();
    if (typeof payload.source === "string") {
      const source = payload.source.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
      const legacyKind = LEGACY_SOURCE_KINDS[source];
      if (legacyKind) return legacyKind;
    }
  } catch {
    // The existing CHECK constraint normally guarantees valid JSON. Keep a safe
    // fallback so a recoverable legacy row never has to be discarded.
  }
  return "legacy:unknown";
}

const LEGACY_SOURCE_KINDS: Record<string, string> = {
  "lan-transfer/index.json": "legacy:lan-transfer",
  "lan-transfer/notes/index.json": "legacy:lan-notes",
  "lan-transfer/uploads/index.json": "legacy:lan-uploads",
  "xhs-archive/index.json": "legacy:xhs-archive"
};
