/** 共用翻译队列：平台文本独立、旧任务可见性隔离，迟到结果不能覆盖刷新或新任务。 */
import {
  type ArchivePlatform,
  type ContentArchiveItem,
  type ContentArchiveListQuery,
  type XhsArchiveTranslation,
  type XhsTranslationTask,
  type XhsTranslationTaskStage
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { translateArchiveSegments } from "./translation-engine";
import type { TaskStore } from "../../tasks/task-store";
import { XhsTranslationRuntime, XhsTranslationRuntimeError } from "../xhs-archive/translation-runtime";
import { abortable } from "./provider";
import { archiveTranslationSource, archiveTranslationSourceHash } from "./text";

import {
  MODEL_REVISION,
  MODEL_ID,
  ArchiveTranslationError,
  toUnifiedTranslationTask,
  createTranslationTask,
  queuedTranslation,
  failedTranslation,
  errorCode,
  itemPlatform,
  itemErrorCode,
  assertTranslationClaim,
  preserveField,
  preserveTopicEdit,
  itemNeedsModel,
  type TranslationItem
} from "./translation-state";
export { ArchiveTranslationError } from "./translation-state";

type TranslationStore<T extends TranslationItem> = {
  get(id: string): Promise<T | undefined>;
  list(options: ContentArchiveListQuery): Promise<{ items: Array<Pick<T, "id" | "translation">>; pageCount: number }>;
  updateTranslation(id: string, updater: (item: T) => T): Promise<T | undefined>;
};
type TaskOwnership = { platforms: Map<string, ArchivePlatform>; hashes: Map<string, string>; completed: Set<string> };

export class ContentArchiveTranslationService<T extends TranslationItem = ContentArchiveItem> {
  private readonly tasks = new Map<string, XhsTranslationTask>();
  private readonly active = new Map<string, string>();
  private queue: Array<{ taskId: string; itemIds: string[] }> = [];
  private draining?: Promise<void>;
  private closing?: Promise<void>;
  private readonly shutdownController = new AbortController();
  private readonly enqueuing = new Set<Promise<XhsTranslationTask | undefined>>();
  private enqueueQueue: Promise<unknown> = Promise.resolve();
  private readonly ownership = new Map<string, TaskOwnership>();

  constructor(
    private readonly config: AppConfig,
    private readonly store: TranslationStore<T>,
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
                error: {
                  code: itemErrorCode("XHS_TRANSLATION_INTERRUPTED", item),
                  message: "上次翻译任务在服务退出时中断，请重试"
                }
              }
            : undefined
        }));
      }
    }
  }

  getRuntimeStatus = () => this.runtime.refreshCapabilityStatus();
  getTask(id: string, platform?: ArchivePlatform) {
    const task = this.tasks.get(id),
      owner = this.ownership.get(id);
    if (!task || !owner) return undefined;
    if (!platform) return structuredClone(task);
    const itemIds = task.itemIds.filter((itemId) => owner.platforms.get(itemId) === platform);
    if (!itemIds.length) return undefined;
    // 兼容出口只暴露该平台的 ID 与计数；全局进度仍来自同一批次，不能另建重复任务。
    return {
      ...structuredClone(task),
      itemIds,
      totalItems: itemIds.length,
      completedItems: itemIds.filter((itemId) => owner.completed.has(itemId)).length,
      currentItemId: task.currentItemId && itemIds.includes(task.currentItemId) ? task.currentItemId : undefined
    };
  }

  enqueue(itemIds: string[], force = false) {
    if (this.shutdownController.signal.aborted) return Promise.resolve(undefined);
    const operation = this.enqueueQueue.then(() => this.enqueueItems(itemIds, force));
    this.enqueueQueue = operation.catch(() => undefined);
    this.enqueuing.add(operation);
    void operation.finally(() => this.enqueuing.delete(operation)).catch(() => undefined);
    return operation;
  }

  private async enqueueItems(itemIds: string[], force: boolean) {
    const unique = [...new Set(itemIds)];
    if (unique.length > 100)
      throw new ArchiveTranslationError("ARCHIVE_TRANSLATION_BATCH_TOO_LARGE", "一次最多翻译 100 条存档", 400);
    const valid: string[] = [];
    const owner: TaskOwnership = { platforms: new Map(), hashes: new Map(), completed: new Set() };
    for (const id of unique) {
      const item = await this.store.get(id);
      if (!item) continue;
      const sourceHash = archiveTranslationSourceHash(item);
      const current = item.translation;
      if (!force && current?.status === "ready" && current.sourceHash === sourceHash) continue;
      const activeTask = this.active.get(`${id}:${sourceHash}`);
      if (activeTask) {
        const previous = this.tasks.get(activeTask)!;
        if (
          unique.length === 1 ||
          (previous.itemIds.length === unique.length && unique.every((value) => previous.itemIds.includes(value)))
        )
          return structuredClone(previous);
        throw new ArchiveTranslationError(
          "ARCHIVE_TRANSLATION_ALREADY_RUNNING",
          "所选存档已有翻译任务，请完成后重试整个批次"
        );
      }
      valid.push(id);
      owner.platforms.set(id, itemPlatform(item));
      owner.hashes.set(id, sourceHash);
    }
    if (!valid.length) return undefined;
    if (this.queue.length >= 16)
      throw new ArchiveTranslationError("ARCHIVE_TRANSLATION_QUEUE_FULL", "翻译队列已满，请稍后重试", 429);
    this.shutdownController.signal.throwIfAborted();
    const task = createTranslationTask(valid);
    if (this.tasks.size >= 500) {
      const oldest = [...this.tasks.values()].find(
        (value) => value.status === "completed" || value.status === "failed"
      );
      if (oldest) {
        this.tasks.delete(oldest.id);
        this.ownership.delete(oldest.id);
      }
    }
    this.tasks.set(task.id, task);
    this.ownership.set(task.id, owner);
    try {
      this.taskStore.upsert(toUnifiedTranslationTask(task, this.taskToolId(task.id)));
      for (const id of valid) {
        const item = await this.store.get(id);
        if (!item) continue;
        const sourceHash = owner.hashes.get(id)!;
        this.active.set(`${id}:${sourceHash}`, task.id);
        await this.store.updateTranslation(id, (current) => {
          if (archiveTranslationSourceHash(current) !== sourceHash) return current;
          return { ...current, translation: queuedTranslation(current, sourceHash, task.id) };
        });
      }
    } catch (error) {
      // 多条入队的元数据提交失败也须释放去重键，不能留下永远无法重试的 pending 任务。
      for (const id of valid) {
        this.active.delete(`${id}:${owner.hashes.get(id)}`);
        await this.store
          .updateTranslation(id, (current) =>
            current.translation?.taskId === task.id
              ? {
                  ...current,
                  translation: failedTranslation(
                    current.translation,
                    archiveTranslationSourceHash(current),
                    "翻译入队失败，请重试",
                    itemErrorCode("XHS_TRANSLATION_FAILED", current)
                  )
                }
              : current
          )
          .catch(() => undefined);
      }
      try {
        this.updateTask(task.id, "failed", "failed", 0, "翻译入队失败，请重试");
      } catch {
        this.tasks.set(task.id, { ...task, status: "failed", stage: "failed" });
      }
      throw error;
    }
    this.queue.push({ taskId: task.id, itemIds: valid });
    void this.drain().catch(() => undefined);
    return task;
  }

  shutdown() {
    if (this.closing) return this.closing;
    // 先停止新任务并取消网络读取，再等待入队与任务收尾落库；数据库仍由应用最后关闭。
    this.shutdownController.abort(
      new XhsTranslationRuntimeError("XHS_TRANSLATION_INTERRUPTED", "服务退出，翻译已中断，请显式重试")
    );
    this.closing = (async () => {
      const deadline = AbortSignal.timeout(5000);
      await abortable(
        (async () => {
          await Promise.allSettled([...this.enqueuing]);
          await this.draining;
          await this.runtime.stop();
        })(),
        deadline
      );
    })();
    return this.closing;
  }

  private drain() {
    if (this.draining) return this.draining;
    this.draining = (async () => {
      try {
        while (this.queue.length) {
          const next = this.queue.shift()!;
          await this.runTask(next.taskId, next.itemIds);
        }
      } finally {
        this.draining = undefined;
      }
    })();
    return this.draining;
  }

  private async runTask(taskId: string, itemIds: string[]) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    try {
      this.shutdownController.signal.throwIfAborted();
      let provider: string | undefined;
      let failedCount = 0;
      let lastFailureMessage: string | undefined;
      let lastFailureCode: string | undefined;
      for (let index = 0; index < itemIds.length; index += 1) {
        this.shutdownController.signal.throwIfAborted();
        const id = itemIds[index];
        const item = await this.store.get(id);
        if (!item) {
          failedCount += 1;
          this.ownership.get(taskId)!.completed.add(id);
          this.active.delete(`${id}:${this.ownership.get(taskId)!.hashes.get(id)}`);
          continue;
        }
        try {
          assertTranslationClaim(item, taskId, this.ownership.get(taskId)!.hashes.get(id)!);
          if (!provider && itemNeedsModel(item)) {
            await this.store.updateTranslation(id, (current) => {
              assertTranslationClaim(current, taskId, this.ownership.get(taskId)!.hashes.get(id)!);
              return {
                ...current,
                translation: current.translation ? { ...current.translation, status: "installing" } : undefined
              };
            });
            this.updateTask(taskId, "running", "installing-runtime", 2, "准备本地翻译环境");
            provider = await abortable(
              this.runtime.ensureReady(
                (status) => {
                  if (!this.shutdownController.signal.aborted)
                    this.updateTask(
                      taskId,
                      "running",
                      status.message.includes("模型") && status.message.includes("下载")
                        ? "downloading-model"
                        : "installing-runtime",
                      Math.max(2, Math.round(status.installProgress * 0.35)),
                      status.message
                    );
                },
                { signal: this.shutdownController.signal }
              ),
              this.shutdownController.signal
            );
            this.shutdownController.signal.throwIfAborted();
            this.updateTask(taskId, "running", "loading-model", 34, "正在加载翻译模型");
          }
          await this.store.updateTranslation(id, (current) => {
            assertTranslationClaim(current, taskId, this.ownership.get(taskId)!.hashes.get(id)!);
            return {
              ...current,
              translation: current.translation ? { ...current.translation, status: "translating" } : undefined
            };
          });
          this.updateTask(
            taskId,
            "running",
            "translating-title",
            35 + Math.round((index / itemIds.length) * 60),
            `正在翻译 ${index + 1}/${itemIds.length}`,
            id
          );
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
          if (this.shutdownController.signal.aborted) throw this.shutdownController.signal.reason;
          failedCount += 1;
          const message = error instanceof Error ? error.message : "翻译失败";
          lastFailureMessage = message;
          lastFailureCode = itemErrorCode(errorCode(error), item);
          await this.store
            .updateTranslation(id, (current) =>
              current.translation?.taskId !== taskId ||
              archiveTranslationSourceHash(current) !== this.ownership.get(taskId)!.hashes.get(id)
                ? current
                : {
                    ...current,
                    translation: failedTranslation(
                      current.translation,
                      archiveTranslationSourceHash(current),
                      message,
                      itemErrorCode(errorCode(error), current)
                    )
                  }
            )
            .catch(() => undefined);
        }
        this.active.delete(`${id}:${this.ownership.get(taskId)!.hashes.get(id)}`);
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
            .updateTranslation(id, (current) =>
              current.translation?.taskId !== taskId ||
              archiveTranslationSourceHash(current) !== this.ownership.get(taskId)!.hashes.get(id)
                ? current
                : {
                    ...current,
                    translation: failedTranslation(
                      current.translation,
                      archiveTranslationSourceHash(current),
                      message,
                      itemErrorCode(errorCode(error), current)
                    )
                  }
            )
            .catch(() => undefined);
        this.active.delete(`${id}:${this.ownership.get(taskId)!.hashes.get(id)}`);
      }
      const legacy = [...this.ownership.get(taskId)!.platforms.values()].every(
        (platform) => platform === "xiaohongshu"
      );
      this.updateTask(
        taskId,
        "failed",
        "failed",
        task.progress,
        message,
        undefined,
        legacy ? errorCode(error) : errorCode(error).replace(/^XHS_/, "ARCHIVE_")
      );
    }
  }

  private async translateItem(
    provider: string,
    item: T,
    taskId: string,
    onStage: (stage: XhsTranslationTaskStage, message: string) => void
  ) {
    const source = archiveTranslationSource(item);
    const topics = source.topics;
    const sourceHash = archiveTranslationSourceHash(item);
    const titleSource = source.title;
    const descriptionSource = source.body;
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
      title: { source: titleSource, machine: title[0] ?? titleSource },
      description: descriptionSource ? { source: descriptionSource, machine: description.join("\n") } : undefined,
      topics: topics.map((topic, index) => ({
        topicId: topic.id,
        source: topic.source,
        machine: translatedTopics[index] ?? topic.source
      })),
      translatedAt: new Date().toISOString()
    };
    this.shutdownController.signal.throwIfAborted();
    const saved = await this.store.updateTranslation(item.id, (current) => {
      // 必须在逐条串行事务内检查，不能使用网络请求前的快照判断当前原文或用户编辑。
      assertTranslationClaim(current, taskId, sourceHash);
      return {
        ...current,
        topics,
        translation: {
          ...next,
          title: preserveField(current.translation?.title, titleSource, next.title.machine),
          description: descriptionSource
            ? preserveField(current.translation?.description, descriptionSource, next.description!.machine)
            : undefined,
          topics: next.topics.map((topic) => ({
            ...topic,
            ...preserveTopicEdit(current.translation, topic.topicId, topic.source)
          }))
        }
      };
    });
    if (!saved) throw new ArchiveTranslationError("XHS_ARCHIVE_NOT_FOUND", "翻译过程中存档已删除", 404);
  }

  private translateSegments(
    provider: string,
    segments: string[],
    stage: XhsTranslationTaskStage,
    onStage: (stage: XhsTranslationTaskStage, message: string) => void
  ) {
    return translateArchiveSegments(this.config, provider, segments, stage, onStage, this.shutdownController.signal);
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
    if (stage === "saving" && currentItemId) this.ownership.get(id)!.completed.add(currentItemId);
    const completedItems = this.ownership.get(id)!.completed.size;
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
    this.taskStore.upsert(toUnifiedTranslationTask(next, this.taskToolId(id)));
  }

  private taskToolId(id: string) {
    return [...this.ownership.get(id)!.platforms.values()].every((value) => value === "xiaohongshu")
      ? "xhs-translation"
      : "media-archive-translation";
  }
}
