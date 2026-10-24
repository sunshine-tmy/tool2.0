/** 归档身份校验独立于业务 DTO：旧载荷保留原样，数据库真实列负责跨平台去重。 */
import type Database from "better-sqlite3";

export const CURRENT_SCHEMA_VERSION = 6;
type ArchiveRow = { id: string; payload_json: string };

export function archiveIdentity(payload: unknown) {
  const value = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const platform = value.platform ?? "xiaohongshu";
  const contentId = value.contentId ?? (platform === "xiaohongshu" ? value.noteId : undefined);
  if (
    (platform !== "xiaohongshu" && platform !== "douyin") ||
    typeof contentId !== "string" ||
    !contentId ||
    contentId.length > 256 ||
    contentId.trim() !== contentId ||
    [...contentId].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    (platform === "xiaohongshu" && value.noteId !== undefined && value.noteId !== contentId)
  ) {
    throw new Error("ARCHIVE_IDENTITY_INVALID");
  }
  return { platform, contentId };
}

export function inspectArchiveIdentity(connection: Database.Database) {
  const exists = connection.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'xhs_archives'").get();
  const rows = exists ? (connection.prepare("SELECT id, payload_json FROM xhs_archives").all() as ArchiveRow[]) : [];
  const identities = rows.map((row) => ({ id: row.id, ...archiveIdentity(JSON.parse(row.payload_json)) }));
  const keys = new Set<string>();
  for (const identity of identities) {
    const key = JSON.stringify([identity.platform, identity.contentId]);
    if (keys.has(key)) throw new Error("ARCHIVE_IDENTITY_CONFLICT");
    keys.add(key);
  }
  return identities;
}

/** 调用方须持有事务。DDL、回填、唯一索引和版本号一起提交，失败不会留下半升级列。 */
export function migrateArchiveIdentity(connection: Database.Database) {
  const identities = inspectArchiveIdentity(connection);
  const columns = connection.pragma("table_info(xhs_archives)") as Array<{ name: string }>;
  const hasIdentity =
    columns.some((column) => column.name === "platform") && columns.some((column) => column.name === "content_id");
  if (!columns.some((column) => column.name === "platform")) {
    connection.exec(
      "ALTER TABLE xhs_archives ADD COLUMN platform TEXT NOT NULL DEFAULT 'xiaohongshu' CHECK(platform IN ('xiaohongshu','douyin'))"
    );
  }
  if (!columns.some((column) => column.name === "content_id")) {
    connection.exec(
      "ALTER TABLE xhs_archives ADD COLUMN content_id TEXT NOT NULL DEFAULT '' CHECK(length(content_id) <= 256)"
    );
  }
  if (hasIdentity) {
    // 已升级库只验证，不在每次启动时重写身份。发现载荷与真实列分叉时拒绝启动，保留修复证据。
    const read = connection.prepare("SELECT platform, content_id FROM xhs_archives WHERE id = ?");
    for (const identity of identities) {
      const row = read.get(identity.id) as { platform: string; content_id: string };
      if (row.platform !== identity.platform || row.content_id !== identity.contentId)
        throw new Error("ARCHIVE_IDENTITY_MISMATCH");
    }
  } else {
    const update = connection.prepare("UPDATE xhs_archives SET platform = ?, content_id = ? WHERE id = ?");
    for (const identity of identities) update.run(identity.platform, identity.contentId, identity.id);
  }
  connection.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS archives_platform_content_idx ON xhs_archives(platform, content_id);
    CREATE TRIGGER IF NOT EXISTS archives_identity_insert BEFORE INSERT ON xhs_archives
      WHEN NEW.content_id = '' OR trim(NEW.content_id) != NEW.content_id
      BEGIN SELECT RAISE(ABORT, 'ARCHIVE_IDENTITY_INVALID'); END;
    CREATE TRIGGER IF NOT EXISTS archives_identity_update BEFORE UPDATE OF content_id ON xhs_archives
      WHEN NEW.content_id = '' OR trim(NEW.content_id) != NEW.content_id
      BEGIN SELECT RAISE(ABORT, 'ARCHIVE_IDENTITY_INVALID'); END;
  `);
}
