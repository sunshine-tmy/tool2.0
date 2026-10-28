/** 只读快照、显式深检和恢复共用维护锁；所有用户可分享信息从固定文案构建。 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import crypto from "node:crypto";
import { diagnosticFailure, type DiagnosticCheck, type DiagnosticRun, type DiagnosticInput } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { ComponentManager } from "../components/component-manager";
import { workerAuthHeaders } from "../../security/worker-auth";
import { MaintenanceGate } from "./maintenance";
import { executeDeepCheck } from "./deep-checks";
import { diagnosticError } from "./errors";
import application from "../../../../../package.json";
import { desktopCapabilitiesPreparing } from "../../runtime/desktop-capability-runtime";

export class DiagnosticsService {
  readonly gate = new MaintenanceGate();
  private runs = new Map<string, { run: DiagnosticRun; controller: AbortController }>();
  private playback = new Map<string, { active: boolean; until: number }>();
  private snapshotPromise?: Promise<DiagnosticRun>;
  private snapshotCache?: DiagnosticRun;
  private closed = false;
  constructor(
    readonly config: AppConfig,
    readonly database: ToolboxDatabase,
    readonly components: ComponentManager,
    private readonly restart: (id: string) => Promise<void>,
    private readonly extraBusy: () => boolean = () => false
  ) {}

  setPlayback(clientId: string, active: boolean) {
    if (active && this.gate.locked) throw diagnosticError("MAINTENANCE_BUSY", "正在执行环境维护，暂不能开始播放");
    this.playback.set(clientId, { active, until: Date.now() + 20_000 });
    for (const [id, value] of this.playback) if (value.until < Date.now() && !value.active) this.playback.delete(id);
  }
  isBusy(ignoreComponentJobs = false) {
    // 活跃播放心跳丢失时保守拒绝，而不是假设已经停止。
    if ([...this.playback.values()].some((value) => value.active)) return true;
    if ((!ignoreComponentJobs && this.components.hasActiveJobs()) || this.extraBusy()) return true;
    if (this.database.hasStatus("archive-import-batch", ["running", "stopping"])) return true;
    if (this.database.hasStatus("tiktok-profile-job", ["discovering", "waiting-user", "archiving", "stopping"]))
      return true;
    return [
      "task",
      "edge-tts-task",
      "image-ai-task",
      "chatterbox-task",
      "chatterbox-item",
      "chatterbox-batch",
      "translation",
      "upload-session"
    ].some((kind) =>
      this.database
        .list(kind)
        .some((entry) => ["pending", "running", "queued", "processing", "uploading"].includes(entry.status ?? ""))
    );
  }
  async worker(id: "image-ai" | "chatterbox", deep = false) {
    const url = new URL(id === "image-ai" ? this.config.imageAiWorkerUrl : this.config.chatterboxWorkerUrl);
    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw diagnosticError("WORKER_TARGET_UNSUPPORTED", "诊断只访问已配置的本机子服务", 422);
    url.pathname = deep ? "/diagnostics/deep" : "/diagnostics/light";
    url.search = "";
    url.hash = "";
    let response: Response;
    try {
      response = await fetch(url, {
        method: deep ? "POST" : "GET",
        redirect: "error",
        headers: {
          ...workerAuthHeaders(id === "image-ai" ? this.config.imageAiWorkerToken : this.config.chatterboxWorkerToken),
          "x-toolbox-diagnostic": "1"
        },
        signal: AbortSignal.timeout(deep ? 300_000 : 2500)
      });
    } catch (error) {
      // HTTP 超时不代表模型线程停止。继续持有维护锁，直到 Worker 确认空闲或已退出。
      if (deep)
        while (!this.closed) {
          try {
            const probe = await this.worker(id);
            if (probe.busy === false) break;
          } catch (probeError) {
            if (diagnosticFailure(probeError).code === "CONNECTION_REFUSED") break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      throw error;
    }
    if (!response.ok)
      throw diagnosticError(
        response.status === 404 ? "WORKER_DIAGNOSTICS_UNSUPPORTED" : "WORKER_CHECK_FAILED",
        "子服务未提供兼容的诊断结果",
        422
      );
    const value = (await response.json()) as {
      protocolVersion?: number;
      available?: boolean;
      modelLoaded?: boolean;
      cudaAvailable?: boolean;
      code?: string;
      busy?: boolean;
    };
    if (value.protocolVersion !== 1 || typeof value.available !== "boolean")
      throw diagnosticError("WORKER_PROTOCOL_MISMATCH", "子服务诊断协议不兼容", 422);
    return value;
  }
  snapshot() {
    if (this.snapshotCache && Date.now() - Date.parse(this.snapshotCache.finishedAt!) < 5000)
      return Promise.resolve(structuredClone(this.snapshotCache));
    this.snapshotPromise ??= this.light()
      .then((value) => {
        this.snapshotCache = value;
        this.runs.set(value.id, { run: value, controller: new AbortController() });
        this.prune();
        return value;
      })
      .finally(() => {
        this.snapshotPromise = undefined;
      });
    return this.snapshotPromise.then((value) => structuredClone(value));
  }
  private newRun(depth: "light" | "deep"): DiagnosticRun {
    return {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      mode: this.config.desktopManagedCapabilities ? "desktop" : "development",
      depth,
      startedAt: new Date().toISOString(),
      state: "running",
      phase: "检查基础服务",
      elapsedMs: 0,
      checks: [],
      events: []
    };
  }
  private async light() {
    const run = this.newRun("light");
    const add = (item: DiagnosticCheck) => run.checks.push(item);
    add({
      id: "service",
      category: "service",
      title: "基础服务",
      status: "ok",
      code: "SERVICE_READY",
      message: "已连接电商工具箱主服务，诊断协议 v1",
      impact: "基础接口可访问",
      suggestion: "无需处理",
      modules: []
    });
    try {
      this.database.ready();
      add({
        id: "database",
        category: "storage",
        title: "数据库",
        status: "ok",
        code: "DATABASE_READY",
        message: "数据库连接可用，未运行完整扫描",
        impact: "历史记录可访问",
        suggestion: "无需处理",
        modules: []
      });
    } catch (error) {
      add(this.failure("database", "数据库", "storage", error));
    }
    try {
      for (const dir of [this.config.storageRoot, this.config.tempDir, this.config.outputDir])
        await fsp.access(dir, fs.constants.R_OK | fs.constants.W_OK);
      const stat = await fsp.statfs(this.config.storageRoot);
      const bytes = stat.bavail * stat.bsize;
      add({
        id: "storage",
        category: "storage",
        title: "数据存储",
        status: bytes < 1024 ** 3 ? "warning" : "ok",
        code: bytes < 1024 ** 3 ? "DISK_SPACE_LOW" : "STORAGE_READY",
        message: `必要目录可访问，可用空间约 ${(bytes / 1024 ** 3).toFixed(1)} GiB`,
        impact: "新文件保存和模型安装",
        suggestion: bytes < 1024 ** 3 ? "请先释放磁盘空间，不会自动清理" : "无需处理",
        modules: []
      });
    } catch (error) {
      add(this.failure("storage", "数据存储", "storage", error));
    }
    add({
      id: "memory",
      category: "environment",
      title: "系统内存",
      status: "ok",
      code: "MEMORY_INFO",
      message: `系统可用内存约 ${(os.freemem() / 1024 ** 3).toFixed(1)} GiB；不代表模型一定可加载`,
      impact: "AI 模型运行",
      suggestion: "显存指标不可获得时不判定故障",
      modules: []
    });
    let statuses: Awaited<ReturnType<ComponentManager["list"]>> = [];
    try {
      statuses = await this.components.list();
    } catch (error) {
      add(this.failure("component-catalog", "能力目录", "capability", error));
    }
    if (!this.config.desktopManagedCapabilities) {
      for (const [id, title, files] of [
        ["edge-tts", "在线配音本地环境", [this.config.edgeTtsPythonPath, this.config.edgeTtsScriptPath]]
      ] as const) {
        let present = true;
        for (const file of files) {
          try {
            await fsp.access(file);
          } catch {
            present = false;
          }
        }
        add({
          id: `environment-${id}`,
          title,
          category: "environment",
          status: present ? "ok" : "not-installed",
          code: present ? "CONFIGURED_NOT_TESTED" : "OPTIONAL_NOT_INSTALLED",
          message: present ? "配置路径存在；依赖和实际运行需手动深检" : "可选运行环境尚未配置或文件缺失",
          impact: "在线配音生成",
          suggestion: present ? "故障时执行对应深检" : "按模块指引手动准备环境",
          modules: [id]
        });
      }
    }
    if (this.config.desktopManagedCapabilities)
      for (const component of statuses) {
        add({
          id: `component-${component.id}`,
          category: "capability",
          title: component.displayName,
          status: component.activeJobId
            ? "checking"
            : component.state === "failed"
              ? "failed"
              : !component.installed
                ? "not-installed"
                : component.health === "unhealthy" || component.state === "blocked"
                  ? "failed"
                  : component.health === "unknown"
                    ? "unknown"
                    : "ok",
          code: component.activeJobId
            ? "COMPONENT_PREPARING"
            : component.state === "failed"
              ? "COMPONENT_INSTALL_FAILED"
              : !component.installed
                ? "OPTIONAL_NOT_INSTALLED"
                : "COMPONENT_METADATA",
          message: component.activeJobId
            ? "组件安装或准备中"
            : component.state === "failed"
              ? "上次组件安装失败或未完成，请查看能力管理；未自动重装"
              : !component.installed
                ? "可选能力尚未安装"
                : `已安装 ${component.installedVersion ?? component.version}；运行状态另行检查`,
          impact: component.purpose,
          suggestion: component.installed ? "需要时手动执行完整性深检" : "如需使用，请前往能力管理安装",
          modules: component.taskToolIds,
          componentId: component.id,
          action: "components"
        });
      }
    for (const id of ["image-ai", "chatterbox"] as const) {
      if (this.config.desktopManagedCapabilities && desktopCapabilitiesPreparing(this.config)) {
        add({
          id: `worker-${id}`,
          category: "capability",
          title: id === "image-ai" ? "AI 图片处理" : "参考音色克隆",
          status: "checking",
          code: "WORKER_PREPARING",
          message: "后台正在准备可选能力，尚不能判定启动失败",
          impact: "不影响基础服务和已保存素材",
          suggestion: "等待准备完成后重新检查",
          modules: [id === "chatterbox" ? "edge-tts" : id]
        });
        continue;
      }
      if (this.config.desktopManagedCapabilities && !statuses.some((c) => c.id === id && c.installed)) continue;
      try {
        const value = await this.worker(id);
        const title = id === "chatterbox" ? "参考音色克隆" : "AI 图片处理";
        add({
          id: `worker-${id}`,
          category: "capability",
          title,
          status: !value.available ? "failed" : value.cudaAvailable === false ? "warning" : "ok",
          code: !value.available ? "WORKER_NOT_READY" : value.cudaAvailable === false ? "CPU_FALLBACK" : "WORKER_READY",
          message: !value.available
            ? "子服务环境未就绪"
            : value.cudaAvailable === false
              ? "子服务可用，当前使用 CPU；GPU 不可用"
              : value.modelLoaded
                ? "子服务可用，模型已加载"
                : "子服务可用，模型处于待命状态",
          impact: id === "chatterbox" ? "配音生成；不影响已保存音频" : "图片 AI 处理",
          suggestion: value.available ? "无需重装；可手动深检模型" : "查看能力状态，空闲后尝试重启子服务",
          modules: [id === "chatterbox" ? "edge-tts" : id],
          componentId: id,
          ...(this.config.desktopManagedCapabilities && !value.available ? { action: "restart-worker" as const } : {})
        });
      } catch (error) {
        const item = this.failure(
          `worker-${id}`,
          id === "chatterbox" ? "参考音色克隆" : "AI 图片处理",
          "capability",
          error
        );
        item.modules = [id === "chatterbox" ? "edge-tts" : id];
        item.componentId = id;
        if (this.config.desktopManagedCapabilities) item.action = "restart-worker";
        add(item);
      }
    }
    add({
      id: "online-speech",
      category: "external",
      title: "在线自然音色",
      status: "skipped",
      code: "ONLINE_NOT_VERIFIED",
      message: "在线生成可用性尚未验证，轻检不会联网合成",
      impact: "在线配音生成",
      suggestion: "如遇生成失败，手动运行在线配音深检",
      modules: ["edge-tts"]
    });
    if (run.checks.some((c) => ["database", "storage"].includes(c.id) && c.status === "failed")) {
      Object.assign(run.checks[0], {
        status: "failed",
        code: "SERVICE_NOT_READY",
        message: "主服务可连接，但必要存储或数据库未就绪",
        suggestion: "优先处理存储与数据库问题"
      });
    }
    this.finish(run);
    return run;
  }
  failure(id: string, title: string, category: DiagnosticCheck["category"], error: unknown): DiagnosticCheck {
    const failure = diagnosticFailure(error);
    const known = (error as { code?: string })?.code;
    return {
      id,
      title,
      category,
      status: failure.code === "UNKNOWN_FAILURE" ? "unknown" : "failed",
      ...failure,
      evidence: known && /^[A-Z0-9_]{1,80}$/.test(known) ? known : failure.code,
      impact: "相关能力可能暂不可用",
      suggestion: "检查组件及服务状态；不要盲目重装环境",
      modules: []
    };
  }
  private finish(run: DiagnosticRun) {
    run.finishedAt = new Date().toISOString();
    run.elapsedMs = Date.now() - Date.parse(run.startedAt);
    if (run.state === "running") run.state = "completed";
    run.phase = run.state === "cancelled" ? "检查已取消" : "检查完成";
  }
  async start(input: DiagnosticInput) {
    if (input.depth === "light") {
      this.snapshotCache = undefined;
      const run = await this.snapshot();
      this.runs.set(run.id, { run, controller: new AbortController() });
      this.prune();
      return run;
    }
    if (!input.confirmed || !input.targets?.length)
      throw diagnosticError("CONFIRMATION_REQUIRED", "请选择检查项并确认资源及联网影响", 422);
    const allowed = new Set([
      "image-ai",
      "chatterbox",
      "edge-tts",
      ...(await this.components.list()).map((c) => `integrity-${c.id}`)
    ]);
    if (input.targets.some((id) => !allowed.has(id))) throw diagnosticError("INVALID_TARGET", "不支持的诊断项目", 422);
    const run = this.newRun("deep");
    const release = this.gate.acquire(run.id);
    try {
      if (this.isBusy()) throw diagnosticError("DIAGNOSTICS_BUSY", "有任务、组件操作或播放尚未结束，请空闲后重试");
    } catch (error) {
      release();
      throw error;
    }
    const controller = new AbortController();
    this.runs.set(run.id, { run, controller });
    this.prune();
    void (async () => {
      try {
        for (const target of input.targets!) {
          if (controller.signal.aborted) break;
          run.phase = `正在检查：${target}`;
          run.events.push({ at: new Date().toISOString(), phase: target, code: "CHECK_STARTED" });
          try {
            const item = await executeDeepCheck(this, target, controller.signal);
            if (!controller.signal.aborted) run.checks.push(item);
          } catch (error) {
            if (!controller.signal.aborted) run.checks.push(this.failure(target, target, "capability", error));
          }
          run.elapsedMs = Date.now() - Date.parse(run.startedAt);
        }
        if (controller.signal.aborted) run.state = "cancelled";
      } finally {
        this.finish(run);
        release();
        this.snapshotCache = undefined;
      }
    })();
    return structuredClone(run);
  }
  get(id: string) {
    const value = this.runs.get(id);
    if (!value) throw diagnosticError("DIAGNOSTIC_NOT_FOUND", "诊断记录不存在或已过期", 404);
    return {
      ...structuredClone(value.run),
      elapsedMs: value.run.state === "running" ? Date.now() - Date.parse(value.run.startedAt) : value.run.elapsedMs
    };
  }
  cancel(id: string) {
    const value = this.runs.get(id);
    this.get(id);
    if (value?.run.state === "running") {
      value.controller.abort();
      value.run.phase = "取消中，等待当前模型调用安全结束";
    }
    return this.get(id);
  }
  async action(componentId: "image-ai" | "chatterbox") {
    if (!this.config.desktopManagedCapabilities)
      throw diagnosticError("DESKTOP_REQUIRED", "开发模式请在启动终端管理服务", 422);
    const release = this.gate.acquire("restart-worker");
    try {
      if (this.isBusy()) throw diagnosticError("DIAGNOSTICS_BUSY", "有任务、组件操作或播放尚未结束");
      await this.restart(componentId);
      this.snapshotCache = undefined;
      const run = await this.snapshot();
      this.runs.set(run.id, { run, controller: new AbortController() });
      this.prune();
      return run;
    } finally {
      release();
    }
  }
  report(id: string, includeEvents: boolean) {
    const run = this.get(id);
    return {
      filename: `toolbox-diagnostics-${run.id}.json`,
      content: JSON.stringify(
        {
          application: "ecommerce-toolbox",
          protocolVersion: 1,
          version: application.version,
          platform: os.platform(),
          architecture: os.arch(),
          nodeVersion: process.versions.node,
          ...run,
          events: includeEvents ? run.events : []
        },
        null,
        2
      )
    };
  }
  private prune() {
    for (const [id, value] of this.runs) if (this.runs.size > 30 && value.run.state !== "running") this.runs.delete(id);
  }
  close() {
    this.closed = true;
    for (const value of this.runs.values()) value.controller.abort();
  }
}
