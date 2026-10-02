/** 两平台共用有界 FIFO 管线：匿名/登录读取由适配器负责，下载完整后才提交，不自动重跑中断任务。 */
import fsp from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  identifyArchiveLink,
  type ArchivePlatformSelection,
  type ContentArchiveItem,
  type ContentArchiveTask
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { ContentArchiveStore } from "./store";
import { ArchiveTaskRepository } from "./task-repository";
import { ArchiveDownloadGateway } from "./download-gateway";
import {
  abortable,
  ArchiveTaskError,
  normalizeArchiveStorageError,
  type ArchiveProvider,
  type ArchiveProgress
} from "./provider";

type Job = {
  id: string;
  url: string;
  platform: ContentArchiveTask["platform"];
  archiveId?: string;
  controller: AbortController;
};
export class ContentArchiveTaskService {
  private readonly queue: Job[] = [];
  private active?: { job: Job; done: Promise<void> };
  private stopped = false;
  private closing?: Promise<void>;
  constructor(
    private readonly options: {
      config: AppConfig;
      store: ContentArchiveStore;
      tasks: ArchiveTaskRepository;
      download: ArchiveDownloadGateway;
      providers: ArchiveProvider[];
      afterCommit?: (item: ContentArchiveItem) => void;
    }
  ) {}
  async initialize() {
    await this.options.store.initialize();
    this.options.tasks.recoverInterrupted();
  }
  get(id: string) {
    return this.options.tasks.get(id);
  }
  create(input: string, selection: ArchivePlatformSelection = "auto", archiveId?: string) {
    if (this.stopped) throw new ArchiveTaskError("ARCHIVE_SERVICE_STOPPED", "获取服务已关闭，请重启后重试", 503);
    const link = identifyArchiveLink(input, selection);
    if (!link.ok) throw new ArchiveTaskError("ARCHIVE_URL_INVALID", link.message);
    if (link.platform === "douyin" && new URL(link.url).protocol !== "https:")
      throw new ArchiveTaskError("ARCHIVE_URL_INVALID", "抖音作品链接必须使用 HTTPS");
    const duplicate = [this.active?.job, ...this.queue].find((job) => {
      if (!job || job.platform !== link.platform || job.url !== link.url) return false;
      const status = this.get(job.id)?.status;
      // 失败已通知前端但 staging 清理尚未结束时，立即重试应排队，而不是返回旧失败任务。
      return status === "pending" || status === "running";
    });
    if (duplicate) return this.get(duplicate.id)!;
    if (this.queue.length >= 16)
      throw new ArchiveTaskError("ARCHIVE_QUEUE_FULL", "获取队列已满，请等待已有任务完成", 429);
    const now = new Date().toISOString();
    const task = this.options.tasks.save({
      id: nanoid(12),
      platform: link.platform,
      status: "pending",
      stage: "installing",
      progress: 0,
      message: "已加入获取队列",
      createdAt: now,
      updatedAt: now
    });
    this.queue.push({
      id: task.id,
      platform: link.platform,
      url: link.url,
      archiveId,
      controller: new AbortController()
    });
    this.pump();
    return task;
  }
  async refresh(id: string) {
    const item = await this.options.store.get(id);
    return item ? this.create(item.sourceUrl, item.platform, item.id) : undefined;
  }
  async remove(id: string) {
    const item = await this.options.store.get(id);
    if (!item) return false;
    // 删除必须先停止相关刷新，防止任务在用户删除后重新提交同一归档。
    const related = [this.active?.job, ...this.queue].filter(
      (job) => job && job.platform === item.platform && (job.archiveId === id || job.url === item.sourceUrl)
    );
    for (const job of related) await this.cancel(job!.id);
    return this.options.store.remove(id);
  }
  async cancel(id: string) {
    const task = this.get(id);
    if (!task) return undefined;
    if (task.status === "completed" || task.status === "failed") return task;
    if (task.stage === "archiving")
      throw new ArchiveTaskError("ARCHIVE_COMMIT_IN_PROGRESS", "文件正在原子提交，请等待完成后再操作", 409);
    const index = this.queue.findIndex((job) => job.id === id);
    if (index >= 0) {
      this.queue.splice(index, 1);
      this.fail(id, "ARCHIVE_CANCELLED", "任务已取消");
    } else if (this.active?.job.id === id) {
      this.active.job.controller.abort(new DOMException("任务已取消", "AbortError"));
      await this.active.done;
    }
    return this.get(id);
  }
  close() {
    if (this.closing) return this.closing;
    this.stopped = true;
    for (const job of this.queue.splice(0))
      this.fail(job.id, "ARCHIVE_INTERRUPTED", "程序退出，任务已中断，请显式重试");
    this.active?.job.controller.abort(new DOMException("程序退出", "AbortError"));
    this.closing = (async () => {
      const timer = new AbortController();
      const timeout = setTimeout(
        () => timer.abort(new ArchiveTaskError("ARCHIVE_STOP_TIMEOUT", "获取管线未在限定时间内退出", 503)),
        5000
      );
      try {
        await abortable(
          Promise.all([this.active?.done, ...this.options.providers.map((provider) => provider.close())]),
          timer.signal
        );
      } finally {
        clearTimeout(timeout);
      }
    })();
    return this.closing;
  }
  private pump() {
    if (this.stopped || this.active || !this.queue.length) return;
    const job = this.queue.shift()!;
    // 微任务启动确保 active 在解析器运行前登记，能力卸载和重复创建可正确观察占用。
    const done = Promise.resolve()
      .then(() => this.process(job))
      .finally(() => {
        this.active = undefined;
        this.pump();
      });
    this.active = { job, done };
    // 数据库不可写等服务故障仍由 close()/cancel() 观察，不制造未处理 Promise 拒绝。
    void done.catch(() => undefined);
  }
  private async process(job: Job) {
    let staging: string | undefined;
    const deadline = new AbortController();
    // Web 的首次小红书/抖音归档可能需要下载签名运行时，不能被媒体获取的五分钟预算提前截断。
    // 桌面受管/外部 Provider 不执行该安装，继续使用较短的获取时限；退出和用户取消不受预算影响。
    const installBudget =
      !this.options.config.desktopManagedCapabilities &&
      ((job.platform === "xiaohongshu" && !this.options.config.xhsProviderUrl) || job.platform === "douyin")
        ? this.options.config.xhsInstallTimeoutMs
        : 0;
    const timeout = setTimeout(
      () => deadline.abort(new DOMException("获取超时", "TimeoutError")),
      installBudget + 300_000
    );
    const signal = AbortSignal.any([job.controller.signal, deadline.signal]);
    const progress: ArchiveProgress = (stage, value, message) => {
      if (!signal.aborted) this.update(job.id, { status: "running", stage, progress: value, message });
    };
    try {
      const provider = this.options.providers.find((entry) => entry.platform === job.platform);
      if (!provider) throw new ArchiveTaskError("ARCHIVE_COMPONENT_NOT_INSTALLED", "该平台归档能力尚未就绪", 503);
      staging = await this.options.store.createStaging(job.id);
      progress("installing", 1, "正在准备获取环境");
      const source = await abortable(provider.extract(job.url, signal, progress), signal);
      signal.throwIfAborted();
      if (source.platform !== job.platform)
        throw new ArchiveTaskError("ARCHIVE_PLATFORM_MISMATCH", "平台返回的作品身份不一致");
      const previous = await this.options.store.findBySource(job.platform, source.contentId);
      if (job.archiveId && previous?.id !== job.archiveId)
        throw new ArchiveTaskError("ARCHIVE_IDENTITY_MISMATCH", "刷新结果与原归档作品不一致");
      job.archiveId = previous?.id;
      if (!source.media.length) throw new ArchiveTaskError("ARCHIVE_MEDIA_EMPTY", "未返回可保存的媒体");
      const id = previous?.id ?? nanoid(14);
      const media: ContentArchiveItem["media"] = [];
      let failures = 0;
      for (const entry of source.media) {
        signal.throwIfAborted();
        try {
          let downloaded = await this.options.download.download(entry, job.platform, staging, id, signal);
          const unchanged = previous?.media.find(
            (old) =>
              old.frameSourceMediaId === undefined &&
              old.kind === entry.kind &&
              old.index === entry.index &&
              old.checksum === downloaded.checksum
          );
          if (unchanged) {
            // 复用稳定媒体身份和文件名，不再复制旧目录文件；已下载的 bytes 经摘要确认与旧媒体一致。
            await fsp.rename(
              path.join(staging, downloaded.fileName),
              path.join(staging, path.basename(unchanged.fileName))
            );
            downloaded = {
              ...downloaded,
              id: unchanged.id,
              fileName: unchanged.fileName,
              previewUrl: `/api/v1/tools/media-archive/items/${id}/media/${unchanged.id}`,
              downloadUrl: `/api/v1/tools/media-archive/items/${id}/media/${unchanged.id}?download=1`
            };
          }
          media.push(downloaded);
        } catch (error) {
          signal.throwIfAborted();
          const normalized = normalizeArchiveStorageError(error);
          if (normalized instanceof ArchiveTaskError && normalized.statusCode === 507) throw normalized;
          failures++;
        }
        progress(
          "downloading",
          38 + Math.round(((media.length + failures) / source.media.length) * 48),
          `正在保存媒体 ${media.length + failures}/${source.media.length}`
        );
      }
      if (failures)
        throw new ArchiveTaskError(
          media.length ? "ARCHIVE_MEDIA_DOWNLOAD_PARTIAL" : "ARCHIVE_MEDIA_DOWNLOAD_FAILED",
          media.length ? "部分媒体下载失败，旧归档未被覆盖，请稍后重试" : "所有媒体均下载失败，旧归档未被覆盖"
        );
      signal.throwIfAborted();
      const { media: _sources, ...metadata } = source;
      const now = new Date().toISOString();
      const item: ContentArchiveItem = {
        ...metadata,
        id,
        sourceUrl: job.url,
        fetchedAt: previous?.fetchedAt ?? now,
        updatedAt: now,
        media,
        coverMediaId: media.find((entry) => entry.kind === "image" || entry.kind === "cover")?.id,
        status: "ready",
        warnings: [],
        totalBytes: media.reduce((sum, entry) => sum + entry.size, 0),
        translation: previous?.translation
      };
      progress("archiving", 92, "正在提交本地存档");
      // 原子提交阶段不可取消；如果提交成功，即使退出同时到达也应如实记为成功。
      await this.options.store.commit(item, staging);
      this.update(job.id, {
        status: "completed",
        stage: "completed",
        progress: 100,
        message: previous ? "存档已更新" : "内容已获取并存档",
        archiveId: id
      });
      // 后置可选功能失败不能把已经完成的媒体归档误报为失败。
      try {
        this.options.afterCommit?.(item);
      } catch {
        /* 归档已提交，后续功能由各自任务报告错误。 */
      }
    } catch (error) {
      const normalized = normalizeArchiveStorageError(error);
      const code = this.stopped
        ? "ARCHIVE_INTERRUPTED"
        : job.controller.signal.aborted
          ? "ARCHIVE_CANCELLED"
          : deadline.signal.aborted
            ? "ARCHIVE_TIMEOUT"
            : normalized instanceof Error &&
                "code" in normalized &&
                typeof normalized.code === "string" &&
                /^(?:XHS|DOUYIN|ARCHIVE)_[A-Z_]+$/.test(normalized.code)
              ? normalized.code.replace(/^(XHS|DOUYIN)_/, "ARCHIVE_")
              : "ARCHIVE_TASK_FAILED";
      const message = this.stopped
        ? "程序退出，任务已中断，请显式重试"
        : job.controller.signal.aborted
          ? "任务已取消"
          : deadline.signal.aborted
            ? "获取超时，请稍后重试"
            : normalized instanceof ArchiveTaskError
              ? normalized.message
              : "获取失败，请检查能力环境或网络后重试";
      this.fail(job.id, code, message);
    } finally {
      clearTimeout(timeout);
      if (staging) await fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  private update(id: string, patch: Partial<ContentArchiveTask>) {
    const current = this.get(id);
    if (current) this.options.tasks.save({ ...current, ...patch, updatedAt: new Date().toISOString() });
  }
  private fail(id: string, code: string, message: string) {
    this.update(id, { status: "failed", stage: "failed", errorCode: code, error: message, message });
  }
}
