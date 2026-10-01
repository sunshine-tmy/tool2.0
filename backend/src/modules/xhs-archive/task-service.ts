/** 小红书获取兼容入口：复用统一任务管线，不再持有独立队列、任务 Map 或下载实现。 */
import type { ContentArchiveTask, XhsArchiveTask } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { RemoteFetch } from "../../security/remote-fetch";
import type { TaskStore } from "../../tasks/task-store";
import type { XhsAuthManager } from "./auth";
import type { XhsArchiveStore } from "./store";
import type { XhsRuntimeManager } from "./runtime";
import type { ContentArchiveTranslationService } from "../media-archive/translation-service";
import type { DouyinRuntimeManager } from "../media-archive/douyin-runtime";
import { ContentArchiveTaskService } from "../media-archive/task-service";
import { ArchiveTaskRepository } from "../media-archive/task-repository";
import { ArchiveDownloadGateway } from "../media-archive/download-gateway";
import { xhsProvider, douyinProvider } from "../media-archive/platform-providers";

export { extractXhsUrl, normalizeXhsProviderItem } from "./provider-item";

export class XhsArchiveTaskService {
  readonly content: ContentArchiveTaskService;
  constructor(
    config: AppConfig,
    remoteFetch: RemoteFetch,
    private readonly store: XhsArchiveStore,
    private readonly runtime: XhsRuntimeManager,
    private readonly auth: XhsAuthManager,
    private readonly translation: Pick<ContentArchiveTranslationService, "enqueue" | "recoverInterrupted" | "shutdown">,
    taskStore: TaskStore,
    database: ToolboxDatabase,
    douyin?: DouyinRuntimeManager
  ) {
    this.content = new ContentArchiveTaskService({
      config,
      store: store.content,
      tasks: new ArchiveTaskRepository(database, taskStore),
      download: new ArchiveDownloadGateway(config, remoteFetch),
      providers: [xhsProvider(config, remoteFetch, runtime, auth), ...(douyin ? [douyinProvider(douyin)] : [])],
      afterCommit: (item) => {
        // Web 两平台共用可选自动翻译；桌面仍由用户安装内容翻译能力，不阻断媒体归档成功。
        if (!config.desktopManagedCapabilities) void translation.enqueue([item.id], false).catch(() => undefined);
      }
    });
  }
  async initialize() {
    await this.content.initialize();
    await this.translation.recoverInterrupted();
  }
  async runtimeStatus() {
    return { ...(await this.runtime.refreshCapabilityStatus()), authenticated: await this.auth.isAuthenticated() };
  }
  create(source: string) {
    return legacyTask(this.content.create(source, "xiaohongshu"));
  }
  get(id: string) {
    const task = this.content.get(id);
    return task?.platform === "xiaohongshu" ? legacyTask(task) : undefined;
  }
  async refresh(id: string) {
    if (!(await this.store.get(id))) return undefined;
    const task = await this.content.refresh(id);
    return task ? legacyTask(task) : undefined;
  }
  async close() {
    try {
      await this.content.close();
    } finally {
      await this.translation.shutdown();
    }
  }
}

function legacyTask(task: ContentArchiveTask): XhsArchiveTask {
  const { platform: _platform, ...rest } = task;
  return { ...rest, errorCode: rest.errorCode?.replace(/^ARCHIVE_/, "XHS_") };
}
