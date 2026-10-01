/** 翻译领域状态与版本判定：纯数据转换不创建 Worker，不修改归档文件。 */
import { nanoid } from "nanoid";
import type {
  ArchivePlatform,
  ContentArchiveItem,
  XhsArchiveItem,
  XhsArchiveTranslation,
  XhsTranslationTask
} from "@toolbox/shared";
import type { Task } from "../../tasks/task-store";
import { XhsTranslationRuntimeError } from "../xhs-archive/translation-runtime";
import { archiveTranslationSource, archiveTranslationSourceHash } from "./text";
export type TranslationItem = XhsArchiveItem | ContentArchiveItem;
export const MODEL_REVISION = "cf109095479db38d6df799875e34039d4938aaa6";
export const MODEL_ID = "Helsinki-NLP/opus-mt-zh-en";
const HAN = /[\u3400-\u9fff]/u;
export class ArchiveTranslationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 409
  ) {
    super(message);
  }
}
export function toUnifiedTranslationTask(task: XhsTranslationTask, toolId: string): Task {
  return {
    id: task.id,
    toolId,
    status: task.status,
    progress: task.progress,
    outputPath: task.currentItemId,
    error: task.errorCode ?? task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

export function createTranslationTask(itemIds: string[]): XhsTranslationTask {
  const now = new Date().toISOString();
  return {
    id: `xhs-tr-${nanoid(12)}`,
    itemIds,
    status: "pending",
    stage: "queued",
    progress: 0,
    completedItems: 0,
    totalItems: itemIds.length,
    message: "等待翻译",
    createdAt: now,
    updatedAt: now
  };
}

export function queuedTranslation(item: TranslationItem, sourceHash: string, taskId: string): XhsArchiveTranslation {
  const previous = item.translation;
  return previous
    ? { ...previous, sourceHash, status: "queued", taskId, error: undefined }
    : {
        status: "queued",
        sourceHash,
        sourceLanguage: "zh-CN",
        targetLanguage: "en",
        provider: "opus-mt",
        modelId: MODEL_ID,
        modelRevision: MODEL_REVISION,
        taskId,
        title: { source: item.title, machine: "" },
        topics: []
      };
}

export function failedTranslation(
  previous: XhsArchiveTranslation,
  sourceHash: string,
  message: string,
  code = "XHS_TRANSLATION_FAILED"
): XhsArchiveTranslation {
  return { ...previous, sourceHash, status: "failed", error: { code, message } };
}

export function errorCode(error: unknown) {
  return error instanceof XhsTranslationRuntimeError || error instanceof ArchiveTranslationError
    ? error.code
    : "XHS_TRANSLATION_FAILED";
}

export function itemPlatform(item: TranslationItem): ArchivePlatform {
  return "platform" in item ? item.platform : "xiaohongshu";
}
export function itemErrorCode(code: string, item: TranslationItem) {
  return itemPlatform(item) === "douyin"
    ? code.replace(/^XHS_ARCHIVE_NOT_FOUND$/, "ARCHIVE_NOT_FOUND").replace(/^XHS_/, "ARCHIVE_")
    : code;
}
export function assertTranslationClaim(item: TranslationItem, taskId: string, sourceHash: string) {
  if (archiveTranslationSourceHash(item) !== sourceHash || item.translation?.taskId !== taskId)
    throw new ArchiveTranslationError("XHS_TRANSLATION_SOURCE_CHANGED", "原文或翻译任务已变化，旧结果未覆盖存档");
}

export function preserveField(previous: XhsTranslationFieldLike | undefined, source: string, machine: string) {
  return {
    source,
    machine,
    ...(previous?.source === source && previous.edited?.trim()
      ? { edited: previous.edited, editedAt: previous.editedAt }
      : {})
  };
}
export function preserveTopicEdit(previous: XhsArchiveTranslation | undefined, topicId: string, source: string) {
  const field = previous?.topics.find((topic) => topic.topicId === topicId);
  return field?.source === source && field.edited?.trim() ? { edited: field.edited, editedAt: field.editedAt } : {};
}
type XhsTranslationFieldLike = { source: string; machine: string; edited?: string; editedAt?: string };

export function itemNeedsModel(item: TranslationItem) {
  const source = archiveTranslationSource(item);
  return [source.title, source.body, ...source.topics.map((topic) => topic.source)].some((value) => HAN.test(value));
}
