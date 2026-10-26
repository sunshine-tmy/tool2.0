/**
 * 中文模块说明：后端数据库层，负责 SQLite 连接、Schema、事务和领域 Repository 能力
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { archiveIdentity } from "./archive-identity";
import { backupBeforeSchemaMigration, databaseSchemaVersion } from "./schema-backup";
import type { StoredEntity, EntityRow, FileMetadata } from "./types";
export type { FileMetadata } from "./types";
import { DATABASE_SCHEMA_VERSION, DOMAIN_TABLES, tableForKind } from "./schema";
import { asRecord, textValue, numberValue, deserializeEntity } from "./row-mapping";
import { migrateSchema } from "./migrations";
import { upsertFile, getFile, listFiles, removeFile, removeFilesForEntity } from "./file-records";
import { appendAudit } from "./audit";

export class ToolboxDatabase {
  readonly path: string;
  readonly connection: Database.Database;
  readonly schemaBackupId: string | undefined;

  constructor(databasePath: string) {
    this.path = databasePath;
    const existing = databasePath !== ":memory:" && fs.existsSync(databasePath) && fs.statSync(databasePath).size > 0;
    if (databasePath !== ":memory:") fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.connection = new Database(databasePath, {
      timeout: 5_000,
      fileMustExist: false
    });
    try {
      this.schemaBackupId = existing ? backupBeforeSchemaMigration(this.connection, databasePath) : undefined;
      const upgrading = databaseSchemaVersion(this.connection) < DATABASE_SCHEMA_VERSION;
      // WAL 提升读写并发；外键和 trusted_schema 关闭不可信扩展路径，busy_timeout
      // 为本机短暂并发写入留出等待窗口，所有迁移完成后才允许应用继续启动。
      this.connection.pragma("journal_mode = WAL");
      // A v6 archive CHECK expansion requires a table rebuild without cascading child deletes.
      // The migration transaction validates every FK before commit; normal operation keeps FKs on.
      this.connection.pragma(`foreign_keys = ${upgrading ? "OFF" : "ON"}`);
      this.connection.pragma("busy_timeout = 5000");
      this.connection.pragma("trusted_schema = OFF");
      this.transaction(() => {
        this.migrate();
        if (upgrading && (this.connection.pragma("foreign_key_check") as unknown[]).length)
          throw new Error("DATABASE_MIGRATION_FOREIGN_KEY_INVALID");
      });
      this.connection.pragma("foreign_keys = ON");
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
    // 领域服务通过此入口提交多表变更，保证元数据和关联记录不会半成功。
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
  /** Activity guards must not deserialize potentially large stored payloads. */
  hasStatus(kind: string, statuses: readonly string[]) {
    if (!statuses.length) return false;
    const table = tableForKind(kind);
    const kindFilter = table === "entities" ? "kind = ? AND " : "";
    return Boolean(
      this.connection
        .prepare(`SELECT 1 FROM ${table} WHERE ${kindFilter}status IN (${statuses.map(() => "?").join(",")}) LIMIT 1`)
        .get(...(table === "entities" ? [kind] : []), ...statuses)
    );
  }

  upsertFile(file: FileMetadata) {
    return upsertFile(this.connection, file);
  }

  getFile(id: string): FileMetadata | undefined {
    return getFile(this.connection, id);
  }

  listFiles(filter: { entityKind?: string; entityId?: string; owner?: string } = {}) {
    return listFiles(this.connection, filter);
  }

  removeFile(id: string) {
    return removeFile(this.connection, id);
  }

  removeFilesForEntity(entityKind: string, entityId: string) {
    return removeFilesForEntity(this.connection, entityKind, entityId);
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
    } else if (table === "xhs_archives") {
      const identity = archiveIdentity(entity.payload);
      this.connection
        .prepare(
          `
        INSERT INTO xhs_archives(id, platform, content_id, status, payload_json, created_at, updated_at)
        VALUES (@id, @platform, @contentId, @status, @payloadJson, @createdAt, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET platform = excluded.platform, content_id = excluded.content_id,
          status = excluded.status, payload_json = excluded.payload_json, updated_at = excluded.updated_at
      `
        )
        .run({ ...values, ...identity });
    } else if (table === "chatterbox_items") {
      const payload = asRecord(entity.payload);
      const batchId = textValue(payload.batchId ?? payload.batch_id);
      const itemOrder = numberValue(payload.order ?? payload.item_order);
      this.connection
        .prepare(
          `INSERT INTO chatterbox_items (id, batch_id, item_order, status, payload_json, created_at, updated_at)
           VALUES (@id, @batchId, @itemOrder, @status, @payloadJson, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET batch_id = excluded.batch_id, item_order = excluded.item_order,
             status = excluded.status, payload_json = excluded.payload_json, updated_at = excluded.updated_at`
        )
        .run({ ...values, batchId, itemOrder });
    } else if (table === "xhs_media" || table === "translations") {
      const payload = asRecord(entity.payload);
      const archiveId = textValue(payload.archiveId ?? payload.archive_id);
      const mediaIndex = table === "xhs_media" ? numberValue(payload.index ?? payload.mediaIndex) : undefined;
      const columnList = table === "xhs_media" ? "archive_id, media_index, " : "archive_id, ";
      const valueList = table === "xhs_media" ? "@archiveId, @mediaIndex, " : "@archiveId, ";
      const relationUpdate =
        table === "xhs_media"
          ? "archive_id = excluded.archive_id, media_index = excluded.media_index, "
          : "archive_id = excluded.archive_id, ";
      this.connection
        .prepare(
          `INSERT INTO ${table} (id, ${columnList}status, payload_json, created_at, updated_at)
           VALUES (@id, ${valueList}@status, @payloadJson, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET ${relationUpdate}status = excluded.status,
             payload_json = excluded.payload_json, updated_at = excluded.updated_at`
        )
        .run({ ...values, archiveId, mediaIndex });
    } else if (table === "chatterbox_batches") {
      const payload = asRecord(entity.payload);
      const voiceId = textValue(payload.voiceId ?? payload.voice_id);
      this.connection
        .prepare(
          `INSERT INTO chatterbox_batches (id, voice_id, status, payload_json, created_at, updated_at)
           VALUES (@id, @voiceId, @status, @payloadJson, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET voice_id = excluded.voice_id, status = excluded.status,
             payload_json = excluded.payload_json, updated_at = excluded.updated_at`
        )
        .run({ ...values, voiceId });
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
    return appendAudit(this.connection, event);
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
    return migrateSchema(this.connection);
  }

  private recoverInterruptedTasks() {
    // 进程重启后 queued/processing 任务可能已失去 Worker 上下文，统一标记为可显式重试的 INTERRUPTED。
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

const INTERRUPTED_WORK = [
  { table: "tasks", statuses: ["pending", "running"] },
  { table: "edge_tts_tasks", statuses: ["queued", "processing"] },
  { table: "image_ai_tasks", statuses: ["pending", "running"] },
  { table: "chatterbox_tasks", statuses: ["queued", "processing"] },
  { table: "chatterbox_items", statuses: ["queued", "processing"] }
] as const;
