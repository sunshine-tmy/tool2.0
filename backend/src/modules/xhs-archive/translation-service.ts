/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import { createHash } from "node:crypto";
import {
  parseXhsContentText,
  resolveXhsTranslationField,
  type XhsArchiveItem,
  type XhsArchiveTranslation,
  type XhsTranslationTask,
  type XhsTranslationTaskStage
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { workerAuthHeaders } from "../../security/worker-auth";
import type { Task, TaskStore } from "../../tasks/task-store";
import { XhsArchiveStore } from "./store";
import { XhsTranslationRuntime, XhsTranslationRuntimeError } from "./translation-runtime";

const MODEL_REVISION = "cf109095479db38d6df799875e34039d4938aaa6";
const MODEL_ID = "Helsinki-NLP/opus-mt-zh-en";
const HAN = /[\u3400-\u9fff]/u;

export class XhsTranslationService {
  private readonly tasks = new Map<string, XhsTranslationTask>();
  private readonly active = new Map<string, string>();
  private queue: Array<{ taskId: string; itemIds: string[] }> = [];
  private running = false;

  constructor(
    private readonly config: AppConfig,
    private readonly store: XhsArchiveStore,
    private readonly runtime: XhsTranslationRuntime,
    private readonly taskStore: TaskStore
  ) {}

  async recoverInterrupted() {
    const snapshot = await this.store.list({ page: 1, pageSize: 50 });
    for (let page = 1; page <= snapshot.pageCount; page += 1) {
      const response = page === 1 ? snapshot : await this.store.list({ page, pageSize: 50 });
      for (const listItem of response.items) {
        if (!listItem.translation || !["queued", "installing", "translating"].includes(listItem.translation.status))
          continue;
        await this.store.updateTranslation(listItem.id, (item) => ({
          ...item,
          translation: item.translation
            ? {
                ...item.translation,
                status: "failed",
                error: { code: "XHS_TRANSLATION_INTERRUPTED", message: "上次翻译任务在服务退出时中断，请重试" }
              }
            : undefined
        }));
      }
    }
  }

  async getRuntimeStatus() {
    return this.runtime.refreshCapabilityStatus();
  }
  getTask(id: string) {
    return this.tasks.get(id);
  }

  async enqueue(itemIds: string[], force = false) {
    const unique = [...new Set(itemIds)];
    const valid: string[] = [];
    for (const id of unique) {
      const item = await this.store.get(id);
      if (!item) continue;
      const sourceHash = translationSourceHash(item);
      const current = item.translation;
      if (!force && current?.status === "ready" && current.sourceHash === sourceHash) continue;
      const activeTask = this.active.get(`${id}:${sourceHash}`);
      if (activeTask) return this.tasks.get(activeTask);
      valid.push(id);
    }
    if (!valid.length) return undefined;
    const task = createTranslationTask(valid);
    this.tasks.set(task.id, task);
    this.taskStore.upsert(toUnifiedTranslationTask(task));
    for (const id of valid) {
      const item = await this.store.get(id);
      if (!item) continue;
      const sourceHash = translationSourceHash(item);
      this.active.set(`${id}:${sourceHash}`, task.id);
      await this.store.updateTranslation(id, (current) => ({
        ...current,
        translation: queuedTranslation(current, sourceHash, task.id)
      }));
    }
    this.queue.push({ taskId: task.id, itemIds: valid });
    void this.drain();
    return task;
  }

  async translateOne(id: string, force = false) {
    return this.enqueue([id], force);
  }

  async shutdown() {
    await this.runtime.stop();
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const next = this.queue.shift()!;
        await this.runTask(next.taskId, next.itemIds);
      }
    } finally {
      this.running = false;
    }
  }

  private async runTask(taskId: string, itemIds: string[]) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    try {
      let provider: string | undefined;
      let failedCount = 0;
      let lastFailureMessage: string | undefined;
      let lastFailureCode: string | undefined;
      for (let index = 0; index < itemIds.length; index += 1) {
        const id = itemIds[index];
        const item = await this.store.get(id);
        if (!item) continue;
        if (!provider && itemNeedsModel(item)) {
          await this.store.updateTranslation(id, (current) => ({
            ...current,
            translation: current.translation ? { ...current.translation, status: "installing" } : undefined
          }));
          this.updateTask(taskId, "running", "installing-runtime", 2, "准备本地翻译环境");
          provider = await this.runtime.ensureReady((status) =>
            this.updateTask(
              taskId,
              "running",
              status.message.includes("模型") && status.message.includes("下载")
                ? "downloading-model"
                : "installing-runtime",
              Math.max(2, Math.round(status.installProgress * 0.35)),
              status.message
            )
          );
          this.updateTask(taskId, "running", "loading-model", 34, "正在加载翻译模型");
        }
        await this.store.updateTranslation(id, (current) => ({
          ...current,
          translation: current.translation ? { ...current.translation, status: "translating" } : undefined
        }));
        this.updateTask(
          taskId,
          "running",
          "translating-title",
          35 + Math.round((index / itemIds.length) * 60),
          `正在翻译 ${index + 1}/${itemIds.length}`,
          id
        );
        try {
          await this.translateItem(provider ?? "", item, taskId, (stage, message) =>
            this.updateTask(
              taskId,
              "running",
              stage,
              35 + Math.round(((index + 0.5) / itemIds.length) * 60),
              message,
              id
            )
          );
        } catch (error) {
          failedCount += 1;
          const message = error instanceof Error ? error.message : "翻译失败";
          lastFailureMessage = message;
          lastFailureCode = errorCode(error);
          await this.store
            .updateTranslation(id, (current) => ({
              ...current,
              translation: failedTranslation(
                current.translation,
                translationSourceHash(current),
                message,
                errorCode(error)
              )
            }))
            .catch(() => undefined);
        }
        this.active.delete(`${id}:${translationSourceHash(item)}`);
        this.updateTask(
          taskId,
          "running",
          "saving",
          35 + Math.round(((index + 1) / itemIds.length) * 60),
          `已完成 ${index + 1}/${itemIds.length}`,
          id
        );
      }
      if (failedCount === itemIds.length)
        this.updateTask(
          taskId,
          "failed",
          "failed",
          100,
          lastFailureMessage || "英文翻译失败",
          undefined,
          lastFailureCode || "XHS_TRANSLATION_FAILED"
        );
      else
        this.updateTask(
          taskId,
          "completed",
          "completed",
          100,
          failedCount ? `英文翻译完成，${failedCount} 条失败` : "英文翻译已完成"
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : "翻译失败";
      for (const id of itemIds) {
        const item = await this.store.get(id);
        if (item)
          await this.store
            .updateTranslation(id, (current) => ({
              ...current,
              translation: failedTranslation(
                current.translation,
                translationSourceHash(current),
                message,
                errorCode(error)
              )
            }))
            .catch(() => undefined);
        this.active.delete(`${id}:${item ? translationSourceHash(item) : ""}`);
      }
      this.updateTask(taskId, "failed", "failed", task.progress, message, undefined, errorCode(error));
    }
  }

  private async translateItem(
    provider: string,
    item: XhsArchiveItem,
    taskId: string,
    onStage: (stage: XhsTranslationTaskStage, message: string) => void
  ) {
    const parsed = parseXhsContentText(item.description);
    const topics = item.topics.length ? item.topics : parsed.topics;
    const sourceHash = translationSourceHash({ ...item, topics });
    const old = item.translation;
    const titleSource = item.title.trim();
    const descriptionSource = parsed.body;
    const topicSources = topics.map((topic) => topic.source);
    const title = await this.translateSegments(provider, [titleSource], "translating-title", onStage);
    const description = descriptionSource
      ? await this.translateSegments(provider, descriptionSource.split(/\r?\n/), "translating-description", onStage)
      : [];
    const translatedTopics = topicSources.length
      ? await this.translateSegments(provider, topicSources, "translating-topics", onStage)
      : [];
    const next: XhsArchiveTranslation = {
      status: "ready",
      sourceHash,
      sourceLanguage: "zh-CN",
      targetLanguage: "en",
      provider: "opus-mt",
      modelId: MODEL_ID,
      modelRevision: MODEL_REVISION,
      taskId,
      title: preserveField(old?.title, titleSource, title[0] ?? titleSource),
      description: descriptionSource
        ? preserveField(old?.description, descriptionSource, description.join("\n"))
        : undefined,
      topics: topics.map((topic, index) => ({
        topicId: topic.id,
        source: topic.source,
        machine: translatedTopics[index] ?? topic.source,
        ...preserveTopicEdit(old, topic.id, topic.source)
      })),
      translatedAt: new Date().toISOString()
    };
    await this.store.updateTranslation(item.id, (current) => ({ ...current, topics, translation: next }));
  }

  private async translateSegments(
    provider: string,
    segments: string[],
    stage: XhsTranslationTaskStage,
    onStage: (stage: XhsTranslationTaskStage, message: string) => void
  ) {
    const result: string[] = [];
    const pending: string[] = [];
    const translations: string[] = [];
    const plans = new Map<number, TranslationPlanPart[][]>();
    segments.forEach((segment, index) => {
      if (!HAN.test(segment)) result[index] = segment;
      else {
        const chunks = splitTranslationSegment(segment);
        plans.set(
          index,
          chunks.map((chunk) =>
            splitProtectedTranslationText(chunk).map((part): TranslationPlanPart => {
              if (part.protected || !HAN.test(part.value)) return { kind: "literal", value: part.value };
              const pendingIndex = pending.length;
              pending.push(part.value);
              return { kind: "translated", pendingIndex };
            })
          )
        );
      }
    });
    if (pending.length) {
      onStage(
        stage,
        stage === "translating-title"
          ? "正在翻译标题"
          : stage === "translating-topics"
            ? "正在翻译话题"
            : "正在翻译正文"
      );
      for (let offset = 0; offset < pending.length; offset += 64) {
        translations.push(...(await translateProviderBatch(this.config, provider, pending.slice(offset, offset + 64))));
      }
    }
    plans.forEach((chunks, index) => {
      result[index] = chunks
        .map((parts) =>
          joinTranslationParts(
            parts.map((part) => (part.kind === "literal" ? part.value : translations[part.pendingIndex]))
          )
        )
        .filter(Boolean)
        .join(" ");
    });
    return result;
  }

  private updateTask(
    id: string,
    status: XhsTranslationTask["status"],
    stage: XhsTranslationTaskStage,
    progress: number,
    message: string,
    currentItemId?: string,
    errorCode?: string
  ) {
    const task = this.tasks.get(id);
    if (!task) return;
    const completedItems =
      stage === "saving" && currentItemId && task.stage !== "saving"
        ? Math.min(task.totalItems, task.completedItems + 1)
        : task.completedItems;
    const next: XhsTranslationTask = {
      ...task,
      status,
      stage,
      progress,
      message,
      currentItemId,
      completedItems,
      errorCode,
      updatedAt: new Date().toISOString()
    };
    this.tasks.set(id, next);
    this.taskStore.upsert(toUnifiedTranslationTask(next));
  }
}

function toUnifiedTranslationTask(task: XhsTranslationTask): Task {
  return {
    id: task.id,
    toolId: "xhs-translation",
    status: task.status,
    progress: task.progress,
    outputPath: task.currentItemId,
    error: task.errorCode ?? task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function createTranslationTask(itemIds: string[]): XhsTranslationTask {
  const now = new Date().toISOString();
  return {
    id: `xhs-tr-${Date.now().toString(36)}`,
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

function queuedTranslation(item: XhsArchiveItem, sourceHash: string, taskId: string): XhsArchiveTranslation {
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

function failedTranslation(
  previous: XhsArchiveTranslation | undefined,
  sourceHash: string,
  message: string,
  code = "XHS_TRANSLATION_FAILED"
): XhsArchiveTranslation {
  return previous
    ? { ...previous, sourceHash, status: "failed", error: { code, message } }
    : {
        status: "failed",
        sourceHash,
        sourceLanguage: "zh-CN",
        targetLanguage: "en",
        provider: "opus-mt",
        modelId: MODEL_ID,
        modelRevision: MODEL_REVISION,
        title: { source: "", machine: "" },
        topics: [],
        error: { code, message }
      };
}

function errorCode(error: unknown) {
  return error instanceof XhsTranslationRuntimeError ? error.code : "XHS_TRANSLATION_FAILED";
}

function preserveField(previous: XhsTranslationFieldLike | undefined, source: string, machine: string) {
  return {
    source,
    machine,
    ...(previous?.source === source && previous.edited?.trim()
      ? { edited: previous.edited, editedAt: previous.editedAt }
      : {})
  };
}
function preserveTopicEdit(previous: XhsArchiveTranslation | undefined, topicId: string, source: string) {
  const field = previous?.topics.find((topic) => topic.topicId === topicId);
  return field?.source === source && field.edited?.trim() ? { edited: field.edited, editedAt: field.editedAt } : {};
}
type XhsTranslationFieldLike = { source: string; machine: string; edited?: string; editedAt?: string };

export function translationSourceHash(item: Pick<XhsArchiveItem, "title" | "description" | "topics">): string {
  const parsed = parseXhsContentText(item.description);
  const topics = (item.topics.length ? item.topics : parsed.topics).map((topic) => topic.source.trim());
  return createHash("sha256")
    .update(JSON.stringify({ title: item.title.trim(), body: parsed.body, topics }))
    .digest("hex");
}

export function effectiveTranslation(field?: XhsTranslationFieldLike) {
  return resolveXhsTranslationField(field);
}

function itemNeedsModel(item: XhsArchiveItem) {
  const parsed = parseXhsContentText(item.description);
  return [
    item.title,
    parsed.body,
    ...(item.topics.length ? item.topics : parsed.topics).map((topic) => topic.source)
  ].some((value) => HAN.test(value));
}

function splitTranslationSegment(value: string): string[] {
  if (Array.from(value).length <= 350) return [value];
  const chunks: string[] = [];
  let remaining = value;
  while (remaining) {
    const chars = Array.from(remaining);
    if (chars.length <= 350) {
      chunks.push(remaining);
      break;
    }
    const window = chars.slice(0, 350).join("");
    const boundary = Math.max(
      window.lastIndexOf("。"),
      window.lastIndexOf("！"),
      window.lastIndexOf("？"),
      window.lastIndexOf("\n")
    );
    const length = boundary > 40 ? boundary + 1 : 350;
    chunks.push(chars.slice(0, length).join(""));
    remaining = chars.slice(length).join("");
  }
  return chunks;
}

type TranslationPlanPart = { kind: "literal"; value: string } | { kind: "translated"; pendingIndex: number };

function splitProtectedTranslationText(value: string): Array<{ value: string; protected: boolean }> {
  const pattern =
    /https?:\/\/[^\s]+|\[[^\]\r\n]+R\]|@[\p{L}\p{N}_-]+|\d+(?:[.,:/-]\d+)*|[A-Za-z][A-Za-z0-9._-]*|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
  const parts: Array<{ value: string; protected: boolean }> = [];
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) parts.push({ value: value.slice(offset, index), protected: false });
    parts.push({ value: match[0], protected: true });
    offset = index + match[0].length;
  }
  if (offset < value.length) parts.push({ value: value.slice(offset), protected: false });
  return parts.length ? parts : [{ value, protected: false }];
}

function joinTranslationParts(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim())
    .join(" ")
    .replace(/\s+([,.;:!?，。！？；：])/gu, "$1")
    .replace(/([（([])\s+/gu, "$1")
    .replace(/\s+([）)\]])/gu, "$1")
    .trim();
}

async function translateProviderBatch(config: AppConfig, provider: string, texts: string[]): Promise<string[]> {
  const response = await fetch(`${provider}/translate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...workerAuthHeaders(isLoopbackProvider(provider) ? config.xhsTranslationToken : undefined)
    },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(120_000)
  });
  const payload = (await response.json().catch(() => ({}))) as { translations?: unknown; detail?: unknown };
  if (!response.ok) {
    const detail = typeof payload.detail === "string" ? payload.detail : "本地翻译服务执行失败";
    throw new Error(`${detail}（HTTP ${response.status}）`);
  }
  if (
    !Array.isArray(payload.translations) ||
    payload.translations.length !== texts.length ||
    payload.translations.some((value) => typeof value !== "string")
  )
    throw new Error("本地翻译服务返回结果无效");
  return payload.translations as string[];
}

function isLoopbackProvider(value: string) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}
