/** Database implementation detail; public callers continue through ToolboxDatabase. */
import type Database from "better-sqlite3";
import { migrateArchiveIdentity, migrateArchivePlatforms } from "./archive-identity";
import { DATABASE_SCHEMA_VERSION, DOMAIN_TABLES } from "./schema";
import type { EntityTableColumn, LegacyEntityRow } from "./types";
export function migrateSchema(connection: Database.Database) {
  // 迁移采用幂等 DDL，并保留 payload_json 作为旧版本恢复载荷；升级失败会在构造函数中关闭连接并拒绝启动。
  connection.exec(`
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
  migrateEntitiesTable(connection);
  connection.exec(`
      CREATE INDEX IF NOT EXISTS entities_status_created_idx ON entities(kind, status, created_at DESC);
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        entity_kind TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        relative_path TEXT NOT NULL UNIQUE,
        byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
        sha256 TEXT,
        media_type TEXT,
        owner TEXT,
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
  migrateFileMetadata(connection);
  for (const table of DOMAIN_TABLES) {
    connection.exec(`
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
  migrateDomainRelations(connection);
  migrateArchiveIdentity(connection);
  migrateArchivePlatforms(connection);
  connection
    .prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)")
    .run(DATABASE_SCHEMA_VERSION, new Date().toISOString());
}

function migrateFileMetadata(connection: Database.Database) {
  const columns = connection.pragma("table_info(files)") as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "owner")) {
    connection.exec("ALTER TABLE files ADD COLUMN owner TEXT");
  }
  connection.exec(`
      CREATE INDEX IF NOT EXISTS files_entity_idx ON files(entity_kind, entity_id);
      CREATE INDEX IF NOT EXISTS files_owner_idx ON files(owner);
    `);
}

function migrateDomainRelations(connection: Database.Database) {
  const columns: Array<{ table: string; name: string; definition: string }> = [
    { table: "xhs_media", name: "archive_id", definition: "TEXT REFERENCES xhs_archives(id) ON DELETE CASCADE" },
    { table: "xhs_media", name: "media_index", definition: "INTEGER" },
    { table: "translations", name: "archive_id", definition: "TEXT REFERENCES xhs_archives(id) ON DELETE CASCADE" },
    {
      table: "chatterbox_batches",
      name: "voice_id",
      definition: "TEXT REFERENCES chatterbox_voices(id) ON DELETE SET NULL"
    },
    {
      table: "chatterbox_items",
      name: "batch_id",
      definition: "TEXT REFERENCES chatterbox_batches(id) ON DELETE CASCADE"
    },
    { table: "chatterbox_items", name: "item_order", definition: "INTEGER" }
  ];
  for (const column of columns) {
    const existing = connection.pragma(`table_info(${column.table})`) as Array<{ name: string }>;
    if (!existing.some((entry) => entry.name === column.name)) {
      connection.exec(`ALTER TABLE ${column.table} ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
  connection.exec(`
      CREATE INDEX IF NOT EXISTS xhs_media_archive_idx ON xhs_media(archive_id, media_index);
      CREATE INDEX IF NOT EXISTS translations_archive_idx ON translations(archive_id);
      CREATE INDEX IF NOT EXISTS chatterbox_batches_voice_idx ON chatterbox_batches(voice_id);
      CREATE INDEX IF NOT EXISTS chatterbox_items_batch_order_idx ON chatterbox_items(batch_id, item_order);
    `);
}

function migrateEntitiesTable(connection: Database.Database) {
  const columns = connection.pragma("table_info(entities)") as EntityTableColumn[];
  const primaryKey = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);
  if (columns.some((column) => column.name === "kind") && primaryKey.join(",") === "kind,id") return;

  const requiredColumns = ["id", "status", "payload_json", "created_at", "updated_at"];
  if (requiredColumns.some((name) => !columns.some((column) => column.name === name))) {
    throw new Error("Unsupported entities table schema; existing data was not modified");
  }

  connection.transaction(() => {
    const rows = connection
      .prepare("SELECT id, status, payload_json, created_at, updated_at FROM entities")
      .all() as LegacyEntityRow[];
    connection.exec(`
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
    const insert = connection.prepare(
      `INSERT INTO entities_schema_v3 (id, kind, status, payload_json, created_at, updated_at)
         VALUES (@id, @kind, @status, @payload_json, @created_at, @updated_at)`
    );
    for (const row of rows) insert.run({ ...row, kind: inferLegacyEntityKind(row.payload_json) });

    const migratedCount = (
      connection.prepare("SELECT COUNT(*) AS count FROM entities_schema_v3").get() as { count: number }
    ).count;
    if (migratedCount !== rows.length) throw new Error("Entities table migration row count mismatch");

    connection.exec(`
        DROP TABLE entities;
        ALTER TABLE entities_schema_v3 RENAME TO entities;
      `);
  })();
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
