/** 中性归档 Repository：保留历史物理表名，以真实身份列查询，不持有浏览器或操作媒体目录。 */
import {
  isContentArchiveItem,
  isContentArchiveListQuery,
  parseXhsContentText,
  toContentArchiveListItem,
  type ArchivePlatform,
  type ContentArchiveItem,
  type ContentArchiveListQuery,
  type ContentArchiveListResponse
} from "@toolbox/shared";
import { archiveIdentity } from "../../database/archive-identity";
import type { ToolboxDatabase } from "../../database/toolbox-database";

type Row = { payload_json: string; platform: ArchivePlatform; content_id: string };

export class ContentArchiveRepository {
  constructor(private readonly database: ToolboxDatabase) {}

  get(id: string) {
    const row = this.database.connection
      .prepare("SELECT payload_json, platform, content_id FROM xhs_archives WHERE id = ?")
      .get(id) as Row | undefined;
    return row ? decode(row) : undefined;
  }

  findBySource(platform: ArchivePlatform, contentId: string) {
    archiveIdentity({ platform, contentId });
    const row = this.database.connection
      .prepare("SELECT payload_json, platform, content_id FROM xhs_archives WHERE platform = ? AND content_id = ?")
      .get(platform, contentId) as Row | undefined;
    return row ? decode(row) : undefined;
  }

  list(options: ContentArchiveListQuery = {}): ContentArchiveListResponse {
    if (!isContentArchiveListQuery(options)) throw new Error("ARCHIVE_QUERY_INVALID");
    const platform = options.platform ?? "all";
    const rows = this.database.connection
      .prepare(
        `SELECT payload_json, platform, content_id FROM xhs_archives ${platform === "all" ? "" : "WHERE platform = ?"} ORDER BY updated_at DESC, id ASC`
      )
      .all(...(platform === "all" ? [] : [platform])) as Row[];
    const keyword = options.keyword?.trim().toLowerCase();
    const items = rows
      .map(decode)
      .filter((item) => !options.type || options.type === "all" || item.type === options.type)
      .filter(
        (item) =>
          !keyword ||
          [
            item.title,
            item.description,
            item.rawText,
            item.author?.name,
            item.contentId,
            ...item.topics.map((topic) => topic.source),
            item.translation?.title.machine,
            item.translation?.title.edited,
            item.translation?.description?.machine,
            item.translation?.description?.edited,
            ...(item.translation?.topics.flatMap((topic) => [topic.machine, topic.edited]) ?? [])
          ].some((text) => text?.toLowerCase().includes(keyword))
      );
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 12;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize).map(toContentArchiveListItem),
      total: items.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(items.length / pageSize))
    };
  }

  save(item: ContentArchiveItem) {
    if (!isContentArchiveItem(item)) throw new Error("ARCHIVE_PAYLOAD_INVALID");
    // 同一归档不能被转换到另一平台/作品；刷新必须继续使用稳定本地 ID。
    this.database.transaction(() => {
      const current = this.get(item.id);
      if (current && (current.platform !== item.platform || current.contentId !== item.contentId))
        throw new Error("ARCHIVE_IDENTITY_IMMUTABLE");
      this.database.upsert({
        id: item.id,
        kind: "xhs-archive",
        status: item.status,
        payload: structuredClone(item),
        createdAt: current?.fetchedAt ?? item.fetchedAt,
        updatedAt: item.updatedAt
      });
    });
    return this.get(item.id)!;
  }
}

function decode(row: Row): ContentArchiveItem {
  const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
  const identity = archiveIdentity(payload);
  if (identity.platform !== row.platform || identity.contentId !== row.content_id)
    throw new Error("ARCHIVE_IDENTITY_MISMATCH");
  const { noteId: _noteId, ...rest } = payload;
  // v1 小红书清单尚无 topics；仅在读取旧载荷时补默认值，不改存储正文，也不对抖音应用 XHS 文本规则。
  const legacy = payload.platform === undefined && identity.platform === "xiaohongshu";
  const item = {
    ...rest,
    ...identity,
    ...(legacy && payload.topics === undefined
      ? {
          topics: parseXhsContentText(typeof payload.description === "string" ? payload.description : undefined).topics
        }
      : {}),
    ...(legacy && payload.warnings === undefined ? { warnings: [] } : {})
  };
  if (!isContentArchiveItem(item)) throw new Error("ARCHIVE_PAYLOAD_INVALID");
  return item;
}
