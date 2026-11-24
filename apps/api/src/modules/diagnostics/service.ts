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
import type { InferenceResourceCoordinator } from "../../core/workers/inference-resource-types";

export class DiagnosticsService {
  readonly gate = new MaintenanceGate();
  private runs = new Map<string, { run: DiagnosticRun; controller: AbortController }>();
  private playback = new Map<string, { active: boolean; until: number }>();
  private snapshotPromise?: Promise<DiagnosticRun>;
  private snapshotCache?: DiagnosticRun;
  private closed = false;
  private componentNames = new Map<string, string>();
  constructor(
    readonly config: AppConfig,
    readonly database: ToolboxDatabase,
    readonly components: ComponentManager,
    private readonly restart: (id: string) => Promise<void>,
    private readonly extraBusy: () => boolean = () => false,
    private readonly inferenceResources?: InferenceResourceCoordinator
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
    if (this.database.hasStatus("archive-video-edit-job", ["pending", "running"])) return true;
    if (this.database.hasStatus("audio-convert-job", ["pending", "running"])) return true;
    if (this.database.hasStatus("audio-extract-job", ["pending", "running"])) return true;
    if (this.database.hasStatus("video-ai-task", ["pending", "running"])) return true;
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
  async worker(id: "image-ai" | "chatterbox" | "video-ai", deep = false, signal?: AbortSignal) {
    const workerUrl =
      id === "image-ai"
        ? this.config.imageAiWorkerUrl
        : id === "chatterbox"
          ? this.config.chatterboxWorkerUrl
          : this.config.videoAiWorkerUrl;
    const workerToken =
      id === "image-ai"
        ? this.config.imageAiWorkerToken
        : id === "chatterbox"
          ? this.config.chatterboxWorkerToken
          : this.config.videoAiWorkerToken;
    const url = new URL(workerUrl);
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
    const check = async () => {
      let response: Response;
      try {
        response = await fetch(url, {
          method: deep ? "POST" : "GET",
          redirect: "error",
          headers: {
            ...workerAuthHeaders(workerToken),
            "x-toolbox-diagnostic": "1"
          },
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(deep ? 300_000 : 2500)])
            : AbortSignal.timeout(deep ? 300_000 : 2500)
        });
      } catch (error) {
        // HTTP timeout/cancel does not stop a model thread; hold the lease until idle or process exit is confirmed.
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
        throw Object.assign(
          diagnosticError(
            [404, 405, 501].includes(response.status)
              ? "WORKER_DIAGNOSTICS_UNSUPPORTED"
              : [401, 403].includes(response.status)
                ? "WORKER_AUTH_FAILED"
                : "WORKER_CHECK_FAILED",
            "子服务未提供兼容的诊断结果",
            422
          ),
          { diagnosticStage: deep ? "worker-deep" : "worker-light", httpStatus: response.status }
        );
      const value = (await response.json().catch(() => {
        throw diagnosticError("WORKER_PROTOCOL_MISMATCH", "子服务诊断响应不是有效 JSON", 422);
      })) as {
        protocolVersion?: number;
        available?: boolean;
        modelLoaded?: boolean;
        cudaAvailable?: boolean;
        requestedDevice?: "cpu" | "cuda" | "auto";
        code?: string;
        busy?: boolean;
      };
      if (!value || typeof value !== "object" || value.protocolVersion !== 1 || typeof value.available !== "boolean")
        throw diagnosticError("WORKER_PROTOCOL_MISMATCH", "子服务诊断协议不兼容", 422);
      return value;
    };
    return deep && this.inferenceResources ? this.inferenceResources.run(id, check, { signal }) : check();
  }

  onSystemResume() {
    return this.inferenceResources?.notifyResume() ?? Promise.resolve();
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
        // Older signed image workers do not report the preference. Their CPU
        // package version is trusted metadata, not evidence of a GPU failure.
        const installed = statuses.find((component) => component.id === id && component.installed);
        const legacyImageCpu =
          id === "image-ai" &&
          this.config.desktopManagedCapabilities &&
          value.requestedDevice === undefined &&
          /(?:^|-)cpu\d*(?:-|$)/.test(installed?.installedVersion ?? installed?.version ?? "");
        const imageCpuMode =
          id === "image-ai" &&
          (value.requestedDevice === "cpu" ||
            (value.requestedDevice !== "cuda" && (legacyImageCpu || value.cudaAvailable === false)));
        const gpuUnavailable = value.cudaAvailable === false && (id !== "image-ai" || value.requestedDevice === "cuda");
        add({
          id: `worker-${id}`,
          category: "capability",
          title,
          status: !value.available ? "failed" : gpuUnavailable ? "warning" : "ok",
          code: !value.available
            ? "WORKER_NOT_READY"
            : imageCpuMode
              ? "WORKER_READY_CPU"
              : gpuUnavailable
                ? id === "image-ai"
                  ? "GPU_UNAVAILABLE"
                  : "CPU_FALLBACK"
                : "WORKER_READY",
          message: !value.available
            ? "子服务环境未就绪"
            : imageCpuMode
              ? "子服务可用，当前使用 CPU（正常运行模式）"
              : gpuUnavailable
                ? id === "image-ai"
                  ? "已配置 GPU 模式，但 CUDA 当前不可用"
                  : "子服务可用，当前使用 CPU；GPU 不可用"
                : value.modelLoaded
                  ? "子服务可用，模型已加载"
                  : "子服务可用，模型处于待命状态",
          impact: id === "chatterbox" ? "配音生成；不影响已保存音频" : "图片 AI 处理",
          suggestion: !value.available
            ? "查看能力状态，空闲后尝试重启子服务"
            : imageCpuMode
              ? "当前 CPU 模式可正常使用，无需处理"
              : gpuUnavailable && id === "image-ai"
                ? "检查所选 GPU 运行环境及设备支持，或改用 CPU 模式"
                : "无需重装；可手动深检模型",
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
        if (
          this.config.desktopManagedCapabilities &&
          !["WORKER_DIAGNOSTICS_UNSUPPORTED", "WORKER_PROTOCOL_MISMATCH"].includes(item.code)
        )
          item.action = "restart-worker";
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
  targetTitle(target: string) {
    const titles: Record<string, string> = {
      "image-ai": "AI 图片模型加载",
      chatterbox: "参考音色克隆模型加载",
      "video-ai-sequence": "STTN / ProPainter 模型深检",
      "edge-tts": "在线自然音色真实合成"
    };
    const components: Record<string, string> = {
      "python-312": "Python 3.12 共享运行时",
      "python-311": "Python 3.11 共享运行时",
      chatterbox: "参考音色克隆",
      "video-ai": "视频去字幕",
      ffmpeg: "FFmpeg 共享媒体运行时"
    };
    return target.startsWith("integrity-")
      ? `能力包完整性 · ${this.componentNames.get(target.slice(10)) ?? components[target.slice(10)] ?? target.slice(10)}`
      : (titles[target] ?? target);
  }
  failure(id: string, title: string, category: DiagnosticCheck["category"], error: unknown): DiagnosticCheck {
    const failure = diagnosticFailure(error);
    const detail = error as {
      code?: string;
      diagnosticStage?: string;
      diagnosticAsset?: string;
      checkedFiles?: number;
      totalFiles?: number;
      httpStatus?: number;
    };
    const evidence = [detail?.code && /^[A-Z0-9_]{1,80}$/.test(detail.code) ? detail.code : failure.code];
    const stages: Record<string, string> = {
      manifest: "验证签名清单",
      installation: "核对安装版本与目录",
      files: "校验签名文件",
      "self-test": "运行安装自检",
      "worker-light": "子服务轻量诊断",
      "worker-deep": "子服务模型诊断"
    };
    if (detail?.diagnosticStage && stages[detail.diagnosticStage])
      evidence.push(`失败阶段：${stages[detail.diagnosticStage]}`);
    if (
      typeof detail?.diagnosticAsset === "string" &&
      detail.diagnosticAsset.length <= 255 &&
      !/[\\:\x00-\x1f]/.test(detail.diagnosticAsset) &&
      !detail.diagnosticAsset.startsWith("/") &&
      !detail.diagnosticAsset.split("/").includes("..")
    )
      evidence.push(`包内文件：${detail.diagnosticAsset}`);
    if (Number.isSafeInteger(detail?.checkedFiles) && Number.isSafeInteger(detail?.totalFiles))
      evidence.push(`已校验文件：${detail.checkedFiles}/${detail.totalFiles}`);
    if (Number.isInteger(detail?.httpStatus) && detail.httpStatus! >= 100 && detail.httpStatus! <= 599)
      evidence.push(`HTTP ${detail.httpStatus}`);
    const compatibility = [
      "WORKER_DIAGNOSTICS_UNSUPPORTED",
      "WORKER_PROTOCOL_MISMATCH",
      "COMPONENT_VERSION_MISMATCH"
    ].includes(failure.code);
    const componentId = id.startsWith("integrity-")
      ? id.slice(10)
      : id === "video-ai-sequence"
        ? "video-ai"
        : id.startsWith("worker-")
          ? id.slice(7)
          : id;
    const suggestions: Record<string, string> = {
      COMPONENT_VERSION_MISMATCH: "在能力管理核对安装版本与目录版本，使用同一发布版本的应用和签名能力包",
      COMPONENT_MANIFEST_INVALID: "核对应用和受信任能力目录，不要绕过签名校验",
      COMPONENT_FILE_MISSING: "查看包内文件及安全软件隔离记录；确认缺失后只修复此能力包",
      COMPONENT_FILE_SIZE_MISMATCH: "确认文件未被修改，必要时在能力管理修复此能力包",
      COMPONENT_FILE_HASH_MISMATCH: "确认文件未被修改，必要时在能力管理修复此能力包",
      PYTHON_IMPORT_FAILED: "查看对应能力的受管 Python 环境，不要修改系统 Python 或盲目重下模型",
      PYTHON_DLL_FAILED: "检查对应能力的动态库依赖、文件隔离记录及架构匹配",
      PYTHON_INIT_FAILED: "检查共享 Python 运行时与安装路径，再检查依赖此环境的能力",
      PYTHON_VERSION_MISMATCH: "使用能力目录要求的共享 Python 版本，勿替换为系统 Python",
      WORKER_DIAGNOSTICS_UNSUPPORTED:
        "核对实际 Worker 来源及能力包版本；空闲时更新匹配的签名包并重新启动应用，本项不判定模型损坏",
      WORKER_PROTOCOL_MISMATCH: "核对主程序与能力包的诊断协议版本，更新匹配版本后重新检查"
    };
    return {
      id,
      title,
      category,
      status:
        failure.code === "UNKNOWN_FAILURE"
          ? "unknown"
          : compatibility
            ? "warning"
            : failure.code === "COMPONENT_NOT_INSTALLED"
              ? "not-installed"
              : "failed",
      ...failure,
      evidence: evidence.join("\n"),
      impact: compatibility ? "当前无法完成诊断验证；不据此判定模型运行失败" : "相关能力可能暂不可用",
      suggestion: suggestions[failure.code] ?? "检查组件及服务状态；不要盲目重装环境",
      modules: [],
      ...(category === "capability" ? { componentId, action: "components" as const } : {})
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
    const installedComponents = await this.components.list();
    for (const component of installedComponents) this.componentNames.set(component.id, component.displayName);
    const allowed = new Set([
      "image-ai",
      "chatterbox",
      "edge-tts",
      ...(installedComponents.some((component) => component.id === "video-ai" && component.installed)
        ? ["video-ai-sequence"]
        : []),
      ...installedComponents.map((c) => `integrity-${c.id}`)
    ]);
    if (input.targets.some((id) => !allowed.has(id))) throw diagnosticError("INVALID_TARGET", "不支持的诊断项目", 422);
    const targets: string[] = [],
      visited = new Set<string>();
    const visit = (target: string) => {
      if (visited.has(target)) return;
      visited.add(target);
      if (target.startsWith("integrity-")) {
        const component = installedComponents.find((item) => item.id === target.slice(10));
        for (const dependency of component?.dependencyIds ?? []) visit(`integrity-${dependency}`);
      }
      targets.push(target);
    };
    for (const target of [...input.targets].sort(
      (a, b) => Number(b.startsWith("integrity-")) - Number(a.startsWith("integrity-"))
    ))
      visit(target);
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
        for (const target of targets) {
          if (controller.signal.aborted) break;
          run.phase = `正在检查：${this.targetTitle(target)}`;
          run.events.push({ at: new Date().toISOString(), phase: target, code: "CHECK_STARTED" });
          try {
            const componentId = target.startsWith("integrity-")
              ? target.slice(10)
              : target === "video-ai-sequence"
                ? "video-ai"
                : target;
            const component = installedComponents.find((entry) => entry.id === componentId);
            const prerequisites = [
              ...(component?.dependencyIds ?? []),
              ...(target.startsWith("integrity-") ? [] : [componentId])
            ];
            const blocked = run.checks.find(
              (check) => prerequisites.includes(check.id.replace(/^integrity-/, "")) && check.status !== "ok"
            );
            if (blocked) {
              run.checks.push({
                id: target,
                title: this.targetTitle(target),
                category: "capability",
                status: "skipped",
                code: "DEPENDENCY_CHECK_FAILED",
                message: `依赖检查未通过：${blocked.title}，本项未继续执行`,
                impact: "尚未验证当前能力，不重复判定为独立损坏",
                suggestion: "先处理依赖检查结果，再重新检查本项",
                modules: component?.taskToolIds ?? [],
                componentId,
                action: "components",
                evidence: `DEPENDENCY_CHECK_FAILED\n依赖原因码：${blocked.code}`
              });
              continue;
            }
            let lastProgress = 0;
            const item = await executeDeepCheck(this, target, controller.signal, (message) => {
              if (controller.signal.aborted || (message.includes("MiB") && Date.now() - lastProgress < 150)) return;
              lastProgress = Date.now();
              run.phase = message;
            });
            if (target.startsWith("integrity-")) {
              item.componentId = componentId;
              item.action = "components";
              item.modules = component?.taskToolIds ?? [];
            }
            if (!controller.signal.aborted) run.checks.push(item);
          } catch (error) {
            if (!controller.signal.aborted) {
              const item = this.failure(target, this.targetTitle(target), "capability", error);
              const component = installedComponents.find((entry) => entry.id === item.componentId);
              item.modules = component?.taskToolIds ?? [];
              for (const [label, version] of [
                ["目录版本", component?.version],
                ["安装版本", component?.installedVersion]
              ])
                if (version && /^[A-Za-z0-9._+-]{1,100}$/.test(version)) item.evidence += `\n${label}：${version}`;
              run.checks.push(item);
            }
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
