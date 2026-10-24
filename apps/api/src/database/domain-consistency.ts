/**
 * 中文模块说明：后端数据库层，负责 领域孤儿记录对账、清理后元数据同步和审计记录
 */
import fsp from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "./toolbox-database";

type DomainConsistencyResult = {
  checked: number;
  removed: number;
  missing: number;
  failures: Array<{ kind: string; id: string; reason: string }>;
};

type DomainName = "xhs-archive" | "chatterbox" | "edge-tts" | "image-ai";
type ReconcileDomainOptions = {
  /** 启动期间只能报告问题；只有显式清理任务才允许删除已确认被清除的元数据。 */
  mode?: "report" | "remove";
  /** 将破坏性同步严格限制在用户刚刚清理的领域，避免影响未勾选的数据。 */
  domains?: readonly DomainName[];
};

// 运行中的任务可能尚未落盘工件，对账时不能视为孤儿记录。
const ACTIVE_STATUSES = new Set(["pending", "running", "queued", "processing", "generating"]);

// 领域记录的标识必须能安全映射为 storage 子路径，超出该集合的记录无法被领域模块管理。
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * 移除指向已删除工件的领域记录（与 storage-consistency / file-consistency 同属启动对账族）。
 * 清理脚本只删除 storage 文件；该对账器负责让 SQLite 中的记录与文件系统重新一致，
 * 避免列表继续展示媒体已丢失的幽灵记录。
 */
export async function reconcileDomainRecords(
  config: AppConfig,
  database: ToolboxDatabase,
  options: ReconcileDomainOptions = {}
): Promise<DomainConsistencyResult> {
  const result: DomainConsistencyResult = { checked: 0, removed: 0, missing: 0, failures: [] };
  const mode = options.mode ?? "remove";
  const domains = new Set(options.domains ?? ["xhs-archive", "chatterbox", "edge-tts", "image-ai"]);

  if (domains.has("xhs-archive")) await reconcileXhsArchive(config, database, result, mode);
  if (domains.has("chatterbox")) await reconcileChatterbox(config, database, result, mode);
  if (domains.has("edge-tts")) await reconcileEdgeTts(config, database, result, mode);
  if (domains.has("image-ai")) await reconcileImageAi(config, database, result, mode);

  if (result.removed > 0 || result.failures.length > 0) {
    database.appendAudit({
      action: "storage.domain_record_consistency",
      outcome: result.failures.length ? "partial" : "success",
      details: { checked: result.checked, removed: result.removed, missing: result.missing, failures: result.failures }
    });
  }
  return result;
}

async function reconcileXhsArchive(
  config: AppConfig,
  database: ToolboxDatabase,
  result: DomainConsistencyResult,
  mode: "report" | "remove"
) {
  // 根目录整体缺失说明存储被移动或未挂载，保守跳过而不是清空全部元数据。
  if (!(await directoryExists(config.xhsArchiveDir))) return;
  // 先取媒体行快照：归档行被删除时，media 行会被外键级联一起删除，事后无法再枚举。
  const mediaEntities = database.list("xhs-media");
  const removedArchives = new Set<string>();
  for (const entity of database.list("xhs-archive")) {
    result.checked += 1;
    if (!SAFE_ID_PATTERN.test(entity.id)) {
      result.failures.push({ kind: "xhs-archive", id: entity.id, reason: "INVALID_ID" });
      continue;
    }
    const manifestPath = path.join(config.xhsArchiveItemsDir, entity.id, "manifest.json");
    if (await fileExists(manifestPath)) continue;
    if (removeOrReport(database, result, mode, "xhs-archive", entity.id, "MANIFEST_MISSING")) {
      removedArchives.add(entity.id);
    }
  }
  for (const entity of mediaEntities) {
    result.checked += 1;
    const payload = entity.payload as { archiveId?: string; fileName?: string } | null;
    const archiveId = typeof payload?.archiveId === "string" ? payload.archiveId : undefined;
    if (!archiveId) continue;
    if (removedArchives.has(archiveId)) {
      // 归档被移除时媒体行已随外键级联消失（或仍存在则手动删除），两种情况都计入移除数。
      if (database.get("xhs-media", entity.id)) database.remove("xhs-media", entity.id);
      result.removed += 1;
      continue;
    }
    if (typeof payload?.fileName !== "string") continue;
    const mediaPath = path.join(config.xhsArchiveItemsDir, archiveId, path.basename(payload.fileName));
    if (await fileExists(mediaPath)) continue;
    if (database.get("xhs-media", entity.id))
      removeOrReport(database, result, mode, "xhs-media", entity.id, "MEDIA_MISSING");
  }
}

async function reconcileChatterbox(
  config: AppConfig,
  database: ToolboxDatabase,
  result: DomainConsistencyResult,
  mode: "report" | "remove"
) {
  if (!(await directoryExists(config.chatterboxDir))) return;
  const batchesRoot = path.join(config.chatterboxDir, "batches");
  const voicesRoot = path.join(config.chatterboxDir, "voices");
  // 先取条目快照：批次行被删除时，条目行会被外键级联一起删除，事后无法再枚举。
  const itemEntities = database.list("chatterbox-item");

  const removedBatches = new Set<string>();
  const removedItemIds = new Set<string>();
  for (const entity of database.list("chatterbox-batch")) {
    result.checked += 1;
    if (!SAFE_ID_PATTERN.test(entity.id)) {
      result.failures.push({ kind: "chatterbox-batch", id: entity.id, reason: "INVALID_ID" });
      continue;
    }
    if (isActive(entity.status)) continue;
    const metaPath = path.join(batchesRoot, entity.id, "meta.json");
    if (await fileExists(metaPath)) continue;
    if (removeOrReport(database, result, mode, "chatterbox-batch", entity.id, "MANIFEST_MISSING")) {
      // 批次的统一任务随批次一起回收，与批次存储自身的删除行为保持一致。
      database.remove("task", entity.id);
      removedBatches.add(entity.id);
      for (const item of itemEntities) {
        const payload = item.payload as { batchId?: string } | null;
        if (payload?.batchId !== entity.id) continue;
        removedItemIds.add(item.id);
      }
    }
  }
  result.removed += removedItemIds.size;

  for (const entity of itemEntities) {
    if (removedItemIds.has(entity.id)) continue;
    result.checked += 1;
    const payload = entity.payload as { batchId?: string } | null;
    if (typeof payload?.batchId !== "string" || !SAFE_ID_PATTERN.test(payload.batchId)) {
      result.failures.push({ kind: "chatterbox-item", id: entity.id, reason: "MISSING_BATCH_ID" });
      continue;
    }
    const itemDir = path.join(batchesRoot, payload.batchId, "items", entity.id);
    if (await directoryExists(itemDir)) continue;
    if (database.get("chatterbox-item", entity.id))
      removeOrReport(database, result, mode, "chatterbox-item", entity.id, "ITEM_DIRECTORY_MISSING");
  }

  for (const entity of database.list("chatterbox-voice")) {
    result.checked += 1;
    if (!SAFE_ID_PATTERN.test(entity.id)) {
      result.failures.push({ kind: "chatterbox-voice", id: entity.id, reason: "INVALID_ID" });
      continue;
    }
    const metaPath = path.join(voicesRoot, entity.id, "meta.json");
    if (await fileExists(metaPath)) continue;
    removeOrReport(database, result, mode, "chatterbox-voice", entity.id, "MANIFEST_MISSING");
  }
}

async function reconcileEdgeTts(
  config: AppConfig,
  database: ToolboxDatabase,
  result: DomainConsistencyResult,
  mode: "report" | "remove"
) {
  if (!(await directoryExists(config.edgeTtsDir))) return;
  for (const entity of database.list("edge-tts-task")) {
    result.checked += 1;
    if (!SAFE_ID_PATTERN.test(entity.id)) {
      result.failures.push({ kind: "edge-tts-task", id: entity.id, reason: "INVALID_ID" });
      continue;
    }
    if (isActive(entity.status)) continue;
    const metaPath = path.join(config.edgeTtsTasksDir, entity.id, "meta.json");
    if (await fileExists(metaPath)) continue;
    if (removeOrReport(database, result, mode, "edge-tts-task", entity.id, "MANIFEST_MISSING")) {
      database.remove("task", entity.id);
    }
  }
}

async function reconcileImageAi(
  config: AppConfig,
  database: ToolboxDatabase,
  result: DomainConsistencyResult,
  mode: "report" | "remove"
) {
  if (!(await directoryExists(config.imageAiDir))) return;
  for (const entity of database.list("image-ai-task")) {
    result.checked += 1;
    if (!SAFE_ID_PATTERN.test(entity.id)) {
      result.failures.push({ kind: "image-ai-task", id: entity.id, reason: "INVALID_ID" });
      continue;
    }
    if (isActive(entity.status)) continue;
    const inputsDir = path.join(config.imageAiInputsDir, entity.id);
    const outputsDir = path.join(config.imageAiOutputsDir, entity.id);
    const manifestPath = path.join(config.imageAiTasksDir, `${entity.id}.json`);
    if ((await pathExists(inputsDir)) || (await pathExists(outputsDir)) || (await fileExists(manifestPath))) {
      continue;
    }
    if (removeOrReport(database, result, mode, "image-ai-task", entity.id, "ARTIFACTS_MISSING")) {
      database.remove("task", entity.id);
    }
  }
}

function removeOrReport(
  database: ToolboxDatabase,
  result: DomainConsistencyResult,
  mode: "report" | "remove",
  kind: string,
  id: string,
  reason: string
) {
  result.missing += 1;
  if (mode === "report") {
    result.failures.push({ kind, id, reason });
    return false;
  }
  if (database.remove(kind, id)) result.removed += 1;
  return true;
}

function isActive(status: string | null | undefined) {
  return typeof status === "string" && ACTIVE_STATUSES.has(status);
}

async function directoryExists(target: string) {
  const stat = await fsp.stat(target).catch(() => undefined);
  return stat?.isDirectory() ?? false;
}

async function fileExists(target: string) {
  const stat = await fsp.stat(target).catch(() => undefined);
  return stat?.isFile() ?? false;
}

async function pathExists(target: string) {
  const stat = await fsp.stat(target).catch(() => undefined);
  return Boolean(stat);
}
