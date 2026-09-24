/**
 * 中文模块说明：能力包管理器负责签名目录、安装作业、完整性验证和原子版本切换。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import {
  buildPythonEnvironment,
  type PythonEnvironmentBuildOptions,
  type PythonRuntimeVersion
} from "./python-environment";
import type {
  ComponentJob,
  ComponentJobPhase,
  ComponentJobProgress,
  ComponentJobState,
  ComponentPackageStatus
} from "@toolbox/shared";
import { createRemoteFetch, type RemoteFetch } from "../../security/remote-fetch";

const COMPONENT_PROTOCOL_VERSION = 1;
const COMPONENT_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_MANIFEST_FILES = 100_000;
const DOWNLOAD_RANGE_BYTES = 1024 * 1024;
const DOWNLOAD_RANGE_CONCURRENCY = 4;
const DOWNLOAD_RANGE_ATTEMPTS = 5;
const DOWNLOAD_REQUEST_TIMEOUT_MS = 60_000;
const RETRYABLE_DOWNLOAD_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT"
]);
// GitHub Release 下载会从 github.com 跳转至资产 CDN；每一跳都校验 HTTPS 和公网 DNS，最多允许 5 次跳转。
const fetchComponentAsset = createRemoteFetch({ maxRedirects: 5, requireHttps: true });

export type ComponentManifestFile = { path: string; bytes: number; sha256: string };
export type ComponentPackageManifest = {
  protocolVersion: number;
  id: string;
  moduleId: string;
  groupId: "shared" | "media" | "audio" | "image" | "archive" | "translation";
  displayName: string;
  purpose: string;
  dependencyIds: string[];
  taskToolIds: string[];
  installConditions: string[];
  version: string;
  platform: "win32-x64";
  archive: { url: string; bytes: number; sha256: string; format: "tar.gz" };
  installedBytes: number;
  files: ComponentManifestFile[];
  pythonEnvironment?: {
    /** Set when the interpreter belongs to a separately installed signed dependency. */
    pythonComponentId?: string;
    pythonExecutablePath: string;
    wheelhousePath: string;
    requirementsLockPath: string;
    requirementsLockSha256: string;
    expectedPythonVersion: PythonRuntimeVersion;
  };
  license?: { name: string; url?: string };
  sbom: { url: string; sha256: string };
  keyId: string;
  signature: string;
};

export type ComponentCatalog = {
  manifests: ComponentPackageManifest[];
  trustedPublicKeys: Record<string, string>;
};

export type VerifiedComponentAsset = {
  /** The canonical path of a file listed in the signed package manifest. */
  path: string;
  /** The immutable generation containing the verified file. */
  generationRoot: string;
  manifest: ComponentPackageManifest;
};

export type ComponentManagerOptions = {
  root: string;
  catalog: ComponentCatalog;
  maxArchiveBytes?: number;
  downloadArchive?: (
    manifest: ComponentPackageManifest,
    destination: string,
    options?: { signal?: AbortSignal; onProgress?: (downloadedBytes: number) => void }
  ) => Promise<void>;
  isInUse?: (componentId: string, taskToolIds: readonly string[]) => boolean | Promise<boolean>;
  availableDiskBytes?: (root: string) => Promise<number>;
  selfTest?: (manifest: ComponentPackageManifest, generationRoot: string) => Promise<void>;
  runPythonProcess?: PythonEnvironmentBuildOptions["runProcess"];
  onBeforeUninstall?: (componentId: string) => Promise<void>;
  onAfterMutation?: (componentId: string, operation: ComponentJob["operation"]) => Promise<void>;
};

type CurrentRecord = {
  protocolVersion: number;
  id: string;
  version: string;
  directory: string;
  installedBytes?: number;
  previousVersion?: string;
  installedAt: string;
  manifestSha256: string;
};

type InternalJob = {
  value: ComponentJob;
  controller?: AbortController;
};

export class ComponentManagerError extends Error {
  constructor(
    readonly code:
      | "COMPONENT_NOT_FOUND"
      | "COMPONENT_MANIFEST_INVALID"
      | "COMPONENT_INSTALL_FAILED"
      | "COMPONENT_DEPENDENCY_MISSING"
      | "COMPONENT_IN_USE"
      | "COMPONENT_DISK_SPACE_LOW"
      | "COMPONENT_JOB_NOT_FOUND"
      | "COMPONENT_JOB_NOT_CANCELLABLE"
      | "COMPONENT_OPERATION_CONFLICT"
      | "COMPONENT_NOT_INSTALLED",
    message: string
  ) {
    super(message);
    this.name = "ComponentManagerError";
  }
}

/**
 * Renderer 只可传固定目录中的能力 id；manifest 签名覆盖下载地址、依赖和文件清单。
 * 安装使用不可变 generation，只有通过校验和自检后才切换 current.json。
 */
export class ComponentManager {
  private readonly root: string;
  private readonly manifests: Map<string, ComponentPackageManifest>;
  private readonly trustedPublicKeys: Record<string, string>;
  private readonly maxArchiveBytes: number;
  private readonly downloadArchive: NonNullable<ComponentManagerOptions["downloadArchive"]>;
  private readonly isInUse: NonNullable<ComponentManagerOptions["isInUse"]>;
  private readonly availableDiskBytes: NonNullable<ComponentManagerOptions["availableDiskBytes"]>;
  private readonly selfTest?: ComponentManagerOptions["selfTest"];
  private readonly runPythonProcess?: ComponentManagerOptions["runPythonProcess"];
  private readonly onBeforeUninstall?: ComponentManagerOptions["onBeforeUninstall"];
  private readonly onAfterMutation?: ComponentManagerOptions["onAfterMutation"];
  private readonly jobs = new Map<string, InternalJob>();
  private readonly activeByComponent = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(job: ComponentJob) => void>>();
  private readonly lastFailures = new Map<string, { code: string; message: string }>();
  private initialized?: Promise<void>;

  constructor(options: ComponentManagerOptions) {
    this.root = path.resolve(options.root);
    this.manifests = new Map(options.catalog.manifests.map((manifest) => [manifest.id, manifest]));
    if (this.manifests.size !== options.catalog.manifests.length)
      throw new Error("Component catalog contains duplicate ids");
    this.trustedPublicKeys = { ...options.catalog.trustedPublicKeys };
    this.maxArchiveBytes = options.maxArchiveBytes ?? 20 * 1024 * 1024 * 1024;
    this.downloadArchive = options.downloadArchive ?? downloadComponentArchive;
    this.isInUse = options.isInUse ?? (() => false);
    this.availableDiskBytes = options.availableDiskBytes ?? getAvailableDiskBytes;
    this.selfTest = options.selfTest;
    this.runPythonProcess = options.runPythonProcess;
    this.onBeforeUninstall = options.onBeforeUninstall;
    this.onAfterMutation = options.onAfterMutation;
    this.validateDependencyGraph();
  }

  async list(): Promise<ComponentPackageStatus[]> {
    await this.initialize();
    const statuses = await Promise.all(
      [...this.manifests.values()].sort((a, b) => a.id.localeCompare(b.id)).map((manifest) => this.status(manifest))
    );
    return statuses.map((status) => {
      const jobId = this.activeByComponent.get(status.id);
      const active = jobId ? this.jobs.get(jobId)?.value : undefined;
      const failure = this.lastFailures.get(status.id);
      const dependents = [...this.manifests.values()]
        .filter((candidate) => candidate.dependencyIds.includes(status.id))
        .map((candidate) => candidate.id);
      const missing = status.dependencyIds.filter((dependencyId) => {
        const dependencyStatus = statuses.find((candidate) => candidate.id === dependencyId);
        return !dependencyStatus?.installed;
      });
      return {
        ...status,
        dependentIds: dependents,
        ...(active
          ? {
              state: active.phase === "downloading" ? "downloading" : "installing",
              activeJobId: active.id
            }
          : {}),
        ...(failure ? { failureReason: failure.message } : {}),
        ...(failure && !status.installed && !active ? { state: "failed" } : {}),
        ...(missing.length && !active ? { state: "blocked", blockedReason: "缺少依赖：" + missing.join("、") } : {})
      };
    });
  }

  async getJob(jobId: string) {
    await this.initialize();
    const job = this.jobs.get(jobId)?.value;
    if (!job) throw new ComponentManagerError("COMPONENT_JOB_NOT_FOUND", "未找到能力管理作业");
    return job;
  }

  /**
   * Resolve a runtime file only from the current generation of a trusted package.
   * Callers provide a fixed package id and relative asset path; renderer input is
   * never accepted here. The current record, manifest signature, file allowlist,
   * real path, file size, and SHA-256 are checked before returning an executable
   * or script path.
   */
  async resolveInstalledAsset(componentId: string, relativePath: string): Promise<VerifiedComponentAsset> {
    await this.initialize();
    const manifest = this.getManifest(componentId);
    this.verifyManifest(manifest);
    if (!isSafeRelativePath(relativePath)) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包运行时资产路径无效");
    }
    const expected = manifest.files.find((file) => file.path === relativePath);
    if (!expected) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "运行时资产未列入签名文件清单");
    }

    const componentRoot = this.componentRoot(componentId);
    const current = await this.readCurrent(componentRoot, componentId);
    if (!current) throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "该能力尚未安装");
    if (current.version !== manifest.version || current.manifestSha256 !== sha256Text(canonicalManifest(manifest))) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "当前安装版本与受信任能力目录不匹配");
    }

    try {
      const versionsRoot = await fsp.realpath(path.join(componentRoot, "versions"));
      const generationRoot = await fsp.realpath(safeChildPath(versionsRoot, current.directory));
      if (!isPathWithin(versionsRoot, generationRoot)) throw new Error("generation path escaped versions root");
      const candidate = safeChildPath(generationRoot, relativePath);
      const resolvedPath = await fsp.realpath(candidate);
      if (!isPathWithin(generationRoot, resolvedPath)) throw new Error("asset path escaped generation root");
      const stat = await fsp.stat(resolvedPath);
      if (!stat.isFile() || stat.size !== expected.bytes || (await sha256File(resolvedPath)) !== expected.sha256) {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包运行时文件完整性校验失败");
      }
      return { path: resolvedPath, generationRoot, manifest };
    } catch (error) {
      if (error instanceof ComponentManagerError) throw error;
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包运行时文件不可用或路径越界");
    }
  }

  /** Resolve the venv generated from a signed Python base runtime and lock file. */
  async resolveInstalledPython(componentId: string): Promise<VerifiedComponentAsset> {
    await this.initialize();
    const manifest = this.getManifest(componentId);
    this.verifyManifest(manifest);
    if (!manifest.pythonEnvironment) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "该能力包没有受信任的 Python 环境声明");
    }

    const componentRoot = this.componentRoot(componentId);
    const current = await this.readCurrent(componentRoot, componentId);
    if (!current) throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "该能力尚未安装");
    if (current.version !== manifest.version || current.manifestSha256 !== sha256Text(canonicalManifest(manifest))) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "当前安装版本与受信任能力目录不匹配");
    }

    try {
      const versionsRoot = await fsp.realpath(path.join(componentRoot, "versions"));
      const generationRoot = await fsp.realpath(safeChildPath(versionsRoot, current.directory));
      if (!isPathWithin(versionsRoot, generationRoot)) throw new Error("generation path escaped versions root");
      const pythonPath = await fsp.realpath(safeChildPath(generationRoot, "venv/Scripts/python.exe"));
      if (!isPathWithin(generationRoot, pythonPath) || !(await fsp.stat(pythonPath)).isFile()) {
        throw new Error("generated Python runtime is unavailable");
      }
      return { path: pythonPath, generationRoot, manifest };
    } catch (error) {
      if (error instanceof ComponentManagerError) throw error;
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包 Python 环境不可用或路径越界");
    }
  }

  subscribe(jobId: string, listener: (job: ComponentJob) => void) {
    const listeners = this.listeners.get(jobId) ?? new Set<(job: ComponentJob) => void>();
    listeners.add(listener);
    this.listeners.set(jobId, listeners);
    const current = this.jobs.get(jobId)?.value;
    if (current) listener(current);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(jobId);
    };
  }

  startInstall(componentId: string) {
    return this.startJob(componentId, "install");
  }

  startReinstall(componentId: string) {
    return this.startJob(componentId, "reinstall");
  }

  startUninstall(componentId: string) {
    return this.startJob(componentId, "uninstall");
  }

  async cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw new ComponentManagerError("COMPONENT_JOB_NOT_FOUND", "未找到能力管理作业");
    if (job.value.state !== "running" || job.value.phase !== "downloading" || !job.controller) {
      throw new ComponentManagerError("COMPONENT_JOB_NOT_CANCELLABLE", "仅下载阶段可以取消");
    }
    job.controller.abort();
    return job.value;
  }

  /** 兼容原有同步服务调用；新 API 使用 startInstall 返回作业 ID。 */
  async install(componentId: string): Promise<ComponentPackageStatus> {
    const job = await this.startInstall(componentId);
    while (true) {
      const current = await this.getJob(job.id);
      if (current.state === "completed") {
        const manifest = this.getManifest(componentId);
        return this.status(manifest);
      }
      if (current.state === "failed" || current.state === "cancelled") {
        throw new ComponentManagerError(
          (current.errorCode as ComponentManagerError["code"]) || "COMPONENT_INSTALL_FAILED",
          current.errorMessage || "能力包安装失败"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  private async startJob(componentId: string, operation: ComponentJob["operation"]) {
    await this.initialize();
    this.getManifest(componentId);
    const existingId = this.activeByComponent.get(componentId);
    if (existingId) {
      const activeJob = this.jobs.get(existingId)!.value;
      if (activeJob.operation !== operation) {
        throw new ComponentManagerError("COMPONENT_OPERATION_CONFLICT", "该能力已有其他管理作业正在运行");
      }
      return activeJob;
    }
    const manifest = this.getManifest(componentId);
    const job = this.createJob(
      componentId,
      operation,
      "queued",
      "queued",
      operation === "uninstall" ? 0 : manifest.archive.bytes,
      manifest.files.length
    );
    const internal = { value: job } satisfies InternalJob;
    this.jobs.set(job.id, internal);
    this.activeByComponent.set(componentId, job.id);
    void this.runJob(internal, manifest);
    return job;
  }

  private async runJob(internal: InternalJob, manifest: ComponentPackageManifest) {
    const operation = internal.value.operation;
    let uninstallRuntimeStopped = false;
    try {
      if (operation === "uninstall") {
        this.updateJob(internal, { state: "running", phase: "uninstalling" });
        await this.assertCanUninstall(manifest.id);
        await this.onBeforeUninstall?.(manifest.id);
        uninstallRuntimeStopped = true;
        await fsp.rm(this.componentRoot(manifest.id), { recursive: true, force: true });
        this.lastFailures.delete(manifest.id);
        await this.notifyAfterMutation(manifest.id, operation);
        this.updateJob(internal, { state: "completed", phase: "complete", progress: zeroProgress() });
        return;
      }
      this.verifyManifest(manifest);
      const current = await this.readCurrent(this.componentRoot(manifest.id), manifest.id);
      if (operation === "reinstall" && !current) {
        throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "该能力尚未安装，无法重装");
      }
      if (
        (operation === "reinstall" || current) &&
        (await this.isInUse(manifest.id, this.affectedTaskToolIds(manifest.id)))
      ) {
        throw new ComponentManagerError("COMPONENT_IN_USE", "能力正在被运行任务使用，暂时无法安装或重装");
      }
      if (operation === "install" && current?.version === manifest.version) {
        try {
          await this.verifyInstalledFiles(
            safeChildPath(path.join(this.componentRoot(manifest.id), "versions"), current.directory),
            manifest
          );
          this.lastFailures.delete(manifest.id);
          this.updateJob(internal, { state: "completed", phase: "complete" });
          return;
        } catch {
          // Keep a damaged current generation until a replacement has passed verification.
        }
      }
      await this.assertDependenciesReady(manifest);
      const freeBytes = await this.availableDiskBytes(this.root);
      if (freeBytes < manifest.archive.bytes + manifest.installedBytes) {
        throw new ComponentManagerError("COMPONENT_DISK_SPACE_LOW", "磁盘可用空间不足");
      }
      internal.controller = new AbortController();
      this.updateJob(internal, { state: "running", phase: "downloading" });
      const generation = await this.installGeneration(manifest, operation === "reinstall", internal);
      try {
        await this.notifyAfterMutation(manifest.id, operation);
      } catch (error) {
        await this.restoreCurrent(manifest.id, generation.previous);
        await this.notifyAfterMutation(manifest.id, "uninstall").catch(() => undefined);
        await fsp
          .rm(safeChildPath(path.join(this.componentRoot(manifest.id), "versions"), generation.directory), {
            recursive: true,
            force: true
          })
          .catch(() => undefined);
        throw error;
      }
      this.lastFailures.delete(manifest.id);
      this.updateJob(internal, { state: "completed", phase: "complete" });
    } catch (error) {
      if (operation === "uninstall" && uninstallRuntimeStopped) {
        await this.notifyAfterMutation(manifest.id, operation);
      }
      if (internal.controller?.signal.aborted) {
        this.updateJob(internal, {
          state: "cancelled",
          phase: "complete",
          errorCode: "COMPONENT_INSTALL_FAILED",
          errorMessage: "下载已取消"
        });
        return;
      }
      this.failJob(internal, error);
    } finally {
      this.activeByComponent.delete(manifest.id);
      internal.controller = undefined;
    }
  }

  private async notifyAfterMutation(componentId: string, operation: ComponentJob["operation"]) {
    try {
      await this.onAfterMutation?.(componentId, operation);
    } catch (error) {
      console.warn(
        `Installed component runtime refresh failed for ${componentId}: ${error instanceof Error ? error.message : "unknown error"}`
      );
      if (operation !== "uninstall") {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力运行时健康检查失败，已恢复原版本");
      }
    }
  }

  private async installGeneration(manifest: ComponentPackageManifest, reinstall: boolean, internal: InternalJob) {
    const componentRoot = this.componentRoot(manifest.id);
    const versionsRoot = path.join(componentRoot, "versions");
    const archiveRoot = path.join(componentRoot, "archives");
    await Promise.all([fsp.mkdir(versionsRoot, { recursive: true }), fsp.mkdir(archiveRoot, { recursive: true })]);
    const canonicalGeneration = safeChildPath(versionsRoot, manifest.version);
    const generationAlreadyExists = await pathExists(canonicalGeneration);
    const generationName =
      reinstall || generationAlreadyExists ? manifest.version + "-" + crypto.randomUUID() : manifest.version;
    const target = safeChildPath(versionsRoot, generationName);
    const archivePath = safeChildPath(archiveRoot, manifest.version + "." + crypto.randomUUID() + ".partial");
    const staging = safeChildPath(versionsRoot, "." + generationName + "." + crypto.randomUUID() + ".partial");
    const oldCurrent = await this.readCurrent(componentRoot, manifest.id);
    const signal = internal.controller?.signal;
    if (!signal) throw new Error("Install job is missing its download cancellation signal");
    let targetCreated = false;
    try {
      this.updateJob(internal, { phase: "downloading" });
      await this.downloadArchive(manifest, archivePath, {
        signal,
        onProgress: (downloadedBytes) =>
          this.updateJob(internal, {
            progress: progress(downloadedBytes, manifest.archive.bytes, 0, manifest.files.length)
          })
      });
      if (signal.aborted) throw new Error("download cancelled");
      this.updateJob(internal, {
        phase: "verifying",
        progress: progress(manifest.archive.bytes, manifest.archive.bytes, 0, manifest.files.length)
      });
      await this.verifyArchive(archivePath, manifest);
      await fsp.mkdir(staging, { recursive: false });
      this.updateJob(internal, { phase: "extracting" });
      await inspectArchive(archivePath);
      await tar.x({ file: archivePath, cwd: staging, strict: true, preservePaths: false });
      await this.verifyInstalledFiles(staging, manifest);
      await fsp.rename(staging, target);
      targetCreated = true;
      if (manifest.pythonEnvironment) {
        this.updateJob(internal, { phase: "building-python" });
        const { pythonComponentId, ...pythonEnvironment } = manifest.pythonEnvironment;
        const pythonRuntime = pythonComponentId
          ? await this.resolveInstalledAsset(pythonComponentId, pythonEnvironment.pythonExecutablePath)
          : undefined;
        await buildPythonEnvironment({
          packageRoot: target,
          ...pythonEnvironment,
          ...(pythonRuntime ? { pythonRuntimeRoot: pythonRuntime.generationRoot } : {}),
          runProcess: this.runPythonProcess
        });
      }
      this.updateJob(internal, {
        phase: "self-test",
        progress: progress(manifest.archive.bytes, manifest.archive.bytes, manifest.files.length, manifest.files.length)
      });
      if (this.selfTest) await this.selfTest(manifest, target);
      this.updateJob(internal, { phase: "switching" });
      await this.switchCurrent(componentRoot, manifest, generationName, oldCurrent);
      targetCreated = false;
      return { previous: oldCurrent, directory: generationName };
    } catch (error) {
      if (targetCreated) await fsp.rm(target, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    } finally {
      await Promise.all([
        fsp.rm(archivePath, { force: true }).catch(() => undefined),
        fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined)
      ]);
    }
  }

  private async restoreCurrent(componentId: string, previous?: CurrentRecord) {
    const componentRoot = this.componentRoot(componentId);
    const currentPath = path.join(componentRoot, "current.json");
    if (!previous) {
      await fsp.rm(currentPath, { force: true });
      return;
    }
    const pendingPath = path.join(componentRoot, ".current-rollback." + crypto.randomUUID() + ".partial");
    await fsp.writeFile(pendingPath, JSON.stringify(previous, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    try {
      await fsp.rename(pendingPath, currentPath);
    } catch (error) {
      await fsp.rm(pendingPath, { force: true });
      throw error;
    }
  }

  private async assertCanUninstall(componentId: string) {
    const current = await this.readCurrent(this.componentRoot(componentId), componentId);
    if (!current) throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "该能力尚未安装");
    const manifest = this.manifests.get(componentId);
    if (await this.isInUse(componentId, manifest?.taskToolIds ?? [])) {
      throw new ComponentManagerError("COMPONENT_IN_USE", "能力正在被运行任务使用");
    }
    const dependents = [...this.manifests.values()].filter((candidate) =>
      candidate.dependencyIds.includes(componentId)
    );
    for (const dependent of dependents) {
      const activeDependentId = this.activeByComponent.get(dependent.id);
      const activeDependent = activeDependentId ? this.jobs.get(activeDependentId)?.value : undefined;
      if (activeDependent && activeDependent.operation !== "uninstall") {
        throw new ComponentManagerError("COMPONENT_IN_USE", "依赖此组件的能力正在安装或重装");
      }
      if (await this.readCurrent(this.componentRoot(dependent.id), dependent.id)) {
        throw new ComponentManagerError("COMPONENT_IN_USE", "已安装能力 " + dependent.displayName + " 依赖此组件");
      }
    }
  }

  private affectedTaskToolIds(componentId: string) {
    const affectedComponents = new Set([componentId]);
    const taskToolIds = new Set(this.manifests.get(componentId)?.taskToolIds ?? []);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const candidate of this.manifests.values()) {
        if (affectedComponents.has(candidate.id) || !candidate.dependencyIds.some((id) => affectedComponents.has(id)))
          continue;
        affectedComponents.add(candidate.id);
        for (const taskToolId of candidate.taskToolIds) taskToolIds.add(taskToolId);
        expanded = true;
      }
    }
    return [...taskToolIds];
  }

  private async assertDependenciesReady(manifest: ComponentPackageManifest) {
    for (const dependencyId of manifest.dependencyIds) {
      const dependency = this.manifests.get(dependencyId);
      if (!dependency) throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力依赖未出现在受信任目录中");
      const activeDependencyId = this.activeByComponent.get(dependencyId);
      const activeDependency = activeDependencyId ? this.jobs.get(activeDependencyId)?.value : undefined;
      if (activeDependency?.operation === "uninstall") {
        throw new ComponentManagerError("COMPONENT_DEPENDENCY_MISSING", "依赖能力正在卸载：" + dependency.displayName);
      }
      const current = await this.readCurrent(this.componentRoot(dependencyId), dependencyId);
      if (!current)
        throw new ComponentManagerError("COMPONENT_DEPENDENCY_MISSING", "请先安装依赖能力：" + dependency.displayName);
    }
  }

  private validateDependencyGraph() {
    for (const manifest of this.manifests.values()) {
      if (!COMPONENT_ID.test(manifest.id) || manifest.moduleId !== manifest.id)
        throw new Error("Component catalog contains invalid ids");
      if (manifest.dependencyIds.includes(manifest.id)) throw new Error("Component catalog contains a self dependency");
      for (const dependencyId of manifest.dependencyIds) {
        if (!this.manifests.has(dependencyId)) throw new Error("Component catalog references an unknown dependency");
      }
    }
    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (id: string) => {
      if (active.has(id)) throw new Error("Component catalog contains a dependency cycle");
      if (visited.has(id)) return;
      active.add(id);
      for (const dependencyId of this.manifests.get(id)!.dependencyIds) visit(dependencyId);
      active.delete(id);
      visited.add(id);
    };
    for (const id of this.manifests.keys()) visit(id);
  }

  private createJob(
    componentId: string,
    operation: ComponentJob["operation"],
    state: ComponentJobState,
    phase: ComponentJobPhase,
    totalDownloadBytes: number,
    totalFiles: number
  ): ComponentJob {
    this.pruneJobs();
    const now = new Date().toISOString();
    const job: ComponentJob = {
      id: crypto.randomUUID(),
      componentId,
      operation,
      state,
      phase,
      progress: { downloadedBytes: 0, totalDownloadBytes, processedFiles: 0, totalFiles, percentage: 0 },
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, { value: job });
    return job;
  }

  private pruneJobs() {
    for (const [jobId, job] of this.jobs) {
      if (this.jobs.size < 500) break;
      const terminal = ["completed", "failed", "cancelled"].includes(job.value.state);
      if (terminal && !this.listeners.has(jobId)) this.jobs.delete(jobId);
    }
  }

  private updateJob(internal: InternalJob, patch: Partial<ComponentJob>) {
    internal.value = { ...internal.value, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(internal.value.id, internal);
    for (const listener of this.listeners.get(internal.value.id) ?? []) listener(internal.value);
  }

  private failJob(internal: InternalJob, error: unknown) {
    const normalized =
      error instanceof ComponentManagerError
        ? error
        : new ComponentManagerError("COMPONENT_INSTALL_FAILED", safeErrorMessage(error));
    this.updateJob(internal, {
      state: "failed",
      phase: "complete",
      errorCode: normalized.code,
      errorMessage: normalized.message.slice(0, 240)
    });
    this.lastFailures.set(internal.value.componentId, {
      code: normalized.code,
      message: normalized.message.slice(0, 240)
    });
    this.activeByComponent.delete(internal.value.componentId);
    internal.controller = undefined;
  }

  private async initialize() {
    if (!this.initialized) {
      this.initialized = (async () => {
        await fsp.mkdir(this.root, { recursive: true });
        for (const entry of await fsp.readdir(this.root, { withFileTypes: true })) {
          if (!entry.isDirectory() || !COMPONENT_ID.test(entry.name)) continue;
          await cleanPartialFiles(path.join(this.root, entry.name));
        }
      })();
    }
    await this.initialized;
  }

  private async status(manifest: ComponentPackageManifest): Promise<ComponentPackageStatus> {
    const current = await this.readCurrent(this.componentRoot(manifest.id), manifest.id);
    let health: ComponentPackageStatus["health"] =
      current && current.manifestSha256 === sha256Text(canonicalManifest(manifest)) ? "healthy" : "unknown";
    if (current) {
      try {
        const generationRoot = safeChildPath(path.join(this.componentRoot(manifest.id), "versions"), current.directory);
        await fsp.access(generationRoot);
      } catch {
        health = "unhealthy";
      }
    }
    return {
      id: manifest.id,
      moduleId: manifest.moduleId,
      displayName: manifest.displayName,
      groupId: manifest.groupId,
      purpose: manifest.purpose,
      taskToolIds: [...manifest.taskToolIds],
      dependencyIds: [...manifest.dependencyIds],
      dependentIds: [],
      installConditions: [...manifest.installConditions],
      version: manifest.version,
      platform: manifest.platform,
      downloadBytes: manifest.archive.bytes,
      // UI 在安装前也需要展示签名 manifest 提供的目标占用估值，而不是返回无意义的 0。
      installedBytes: manifest.installedBytes,
      installed: Boolean(current),
      state: current ? "ready" : "not-installed",
      health,
      ...(current ? { installedVersion: current.version, installedAt: current.installedAt } : {}),
      ...(current?.previousVersion ? { previousVersion: current.previousVersion } : {}),
      licenseName: manifest.license?.name ?? "内部使用",
      ...(manifest.license?.url ? { licenseUrl: manifest.license.url } : {})
    };
  }

  private verifyManifest(manifest: ComponentPackageManifest) {
    if (
      manifest.protocolVersion !== COMPONENT_PROTOCOL_VERSION ||
      !COMPONENT_ID.test(manifest.id) ||
      manifest.moduleId !== manifest.id ||
      !["shared", "media", "audio", "image", "archive", "translation"].includes(manifest.groupId) ||
      !SAFE_VERSION.test(manifest.version) ||
      manifest.platform !== "win32-x64" ||
      !manifest.displayName.trim() ||
      !manifest.purpose.trim() ||
      (manifest.license !== undefined &&
        (!manifest.license ||
          typeof manifest.license.name !== "string" ||
          !manifest.license.name.trim() ||
          (manifest.license.url !== undefined &&
            (typeof manifest.license.url !== "string" || !isHttpsUrl(manifest.license.url))))) ||
      !isHttpsUrl(manifest.sbom.url) ||
      !SHA256.test(manifest.sbom.sha256) ||
      !isHttpsUrl(manifest.archive.url) ||
      manifest.archive.format !== "tar.gz" ||
      !Number.isSafeInteger(manifest.archive.bytes) ||
      manifest.archive.bytes < 1 ||
      manifest.archive.bytes > this.maxArchiveBytes ||
      !Number.isSafeInteger(manifest.installedBytes) ||
      manifest.installedBytes < 0 ||
      !SHA256.test(manifest.archive.sha256) ||
      !Array.isArray(manifest.files) ||
      !manifest.files.length ||
      manifest.files.length > MAX_MANIFEST_FILES ||
      !Array.isArray(manifest.dependencyIds) ||
      !Array.isArray(manifest.taskToolIds) ||
      !Array.isArray(manifest.installConditions) ||
      manifest.dependencyIds.some((dependencyId) => !COMPONENT_ID.test(dependencyId)) ||
      manifest.taskToolIds.some((toolId) => !COMPONENT_ID.test(toolId)) ||
      manifest.installConditions.some(
        (condition) => typeof condition !== "string" || !condition.trim() || condition.length > 300
      ) ||
      (manifest.pythonEnvironment !== undefined &&
        (!manifest.pythonEnvironment ||
          !SHA256.test(manifest.pythonEnvironment.requirementsLockSha256) ||
          !["3.11", "3.12"].includes(manifest.pythonEnvironment.expectedPythonVersion) ||
          !isSafeRelativePath(manifest.pythonEnvironment.pythonExecutablePath) ||
          !isSafeRelativePath(manifest.pythonEnvironment.wheelhousePath) ||
          !isSafeRelativePath(manifest.pythonEnvironment.requirementsLockPath) ||
          (manifest.pythonEnvironment.pythonComponentId !== undefined &&
            (!COMPONENT_ID.test(manifest.pythonEnvironment.pythonComponentId) ||
              !manifest.dependencyIds.includes(manifest.pythonEnvironment.pythonComponentId)))))
    )
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包 manifest 不符合安全约束");
    const names = new Set<string>();
    for (const file of manifest.files) {
      if (
        !isSafeRelativePath(file.path) ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes < 0 ||
        !SHA256.test(file.sha256) ||
        names.has(file.path)
      ) {
        throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包文件清单不符合安全约束");
      }
      names.add(file.path);
    }
    const publicKey = this.trustedPublicKeys[manifest.keyId];
    if (!publicKey || !verifyManifestSignature(manifest, publicKey)) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包签名校验失败");
    }
  }

  private async verifyArchive(archivePath: string, manifest: ComponentPackageManifest) {
    const stat = await fsp.stat(archivePath);
    if (!stat.isFile() || stat.size !== manifest.archive.bytes) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载大小校验失败");
    }
    if ((await sha256File(archivePath)) !== manifest.archive.sha256) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载摘要校验失败");
    }
  }

  private async verifyInstalledFiles(root: string, manifest: ComponentPackageManifest) {
    const actual = await listRegularFiles(root);
    const expected = new Map(manifest.files.map((file) => [file.path, file]));
    if (actual.length !== expected.size || actual.some((file) => !expected.has(file.path))) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包文件清单校验失败");
    }
    for (const file of actual) {
      const expectedFile = expected.get(file.path);
      if (
        !expectedFile ||
        file.bytes !== expectedFile.bytes ||
        (await sha256File(file.fullPath)) !== expectedFile.sha256
      ) {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包文件摘要校验失败");
      }
    }
  }

  private async switchCurrent(
    componentRoot: string,
    manifest: ComponentPackageManifest,
    directory: string,
    previous?: CurrentRecord
  ) {
    const record: CurrentRecord = {
      protocolVersion: COMPONENT_PROTOCOL_VERSION,
      id: manifest.id,
      version: manifest.version,
      directory,
      installedBytes: manifest.installedBytes,
      ...(previous && previous.version !== manifest.version
        ? { previousVersion: previous.version }
        : previous?.previousVersion
          ? { previousVersion: previous.previousVersion }
          : {}),
      installedAt: new Date().toISOString(),
      manifestSha256: sha256Text(canonicalManifest(manifest))
    };
    const currentPath = path.join(componentRoot, "current.json");
    const pendingPath = path.join(componentRoot, ".current." + crypto.randomUUID() + ".partial");
    await fsp.mkdir(componentRoot, { recursive: true });
    await fsp.writeFile(pendingPath, JSON.stringify(record, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    try {
      await fsp.rename(pendingPath, currentPath);
    } catch (error) {
      await fsp.rm(pendingPath, { force: true });
      throw error;
    }
  }

  private async readCurrent(componentRoot: string, expectedId?: string): Promise<CurrentRecord | undefined> {
    try {
      const raw = JSON.parse(
        await fsp.readFile(path.join(componentRoot, "current.json"), "utf8")
      ) as Partial<CurrentRecord>;
      if (
        raw.protocolVersion !== COMPONENT_PROTOCOL_VERSION ||
        typeof raw.id !== "string" ||
        !COMPONENT_ID.test(raw.id) ||
        (expectedId !== undefined && raw.id !== expectedId) ||
        typeof raw.version !== "string" ||
        !SAFE_VERSION.test(raw.version) ||
        typeof raw.directory !== "string" ||
        !SAFE_VERSION.test(raw.directory) ||
        (raw.installedBytes !== undefined && (!Number.isSafeInteger(raw.installedBytes) || raw.installedBytes < 0)) ||
        (raw.previousVersion !== undefined &&
          (typeof raw.previousVersion !== "string" || !SAFE_VERSION.test(raw.previousVersion))) ||
        typeof raw.installedAt !== "string" ||
        Number.isNaN(Date.parse(raw.installedAt)) ||
        typeof raw.manifestSha256 !== "string" ||
        !SHA256.test(raw.manifestSha256)
      )
        return undefined;
      return raw as CurrentRecord;
    } catch {
      return undefined;
    }
  }

  private getManifest(componentId: string) {
    const manifest = this.manifests.get(componentId);
    if (!manifest) throw new ComponentManagerError("COMPONENT_NOT_FOUND", "未找到可安装的能力包");
    return manifest;
  }

  private componentRoot(componentId: string) {
    if (!COMPONENT_ID.test(componentId)) throw new ComponentManagerError("COMPONENT_NOT_FOUND", "能力包标识无效");
    return safeChildPath(this.root, componentId);
  }
}

export function canonicalManifest(manifest: ComponentPackageManifest) {
  const { signature: _signature, ...unsigned } = manifest;
  return stableStringify(unsigned);
}

function verifyManifestSignature(manifest: ComponentPackageManifest, publicKey: string) {
  try {
    return crypto.verify(
      null,
      Buffer.from(canonicalManifest(manifest)),
      publicKey,
      Buffer.from(manifest.signature, "base64")
    );
  } catch {
    return false;
  }
}

export async function downloadComponentArchive(
  manifest: ComponentPackageManifest,
  destination: string,
  options: { signal?: AbortSignal; onProgress?: (downloadedBytes: number) => void } = {},
  remoteFetch: RemoteFetch = fetchComponentAsset
) {
  let file: fs.promises.FileHandle | undefined;
  let createdDestination = false;
  let completed = false;
  try {
    file = await fsp.open(destination, "wx");
    createdDestination = true;
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    const firstRangeEnd = Math.min(DOWNLOAD_RANGE_BYTES, manifest.archive.bytes) - 1;
    const firstRange = await readArchiveRange(manifest, 0, firstRangeEnd, signal, remoteFetch);

    // 非 Range 服务只允许首个响应退回完整流式下载；之后再收到 200 会导致重复写入，因此拒绝。
    if (firstRange.response) {
      await writeFullArchiveResponse(firstRange.response, file, manifest, options);
    } else {
      await writeBufferAt(file, firstRange.buffer, 0);
      let downloadedBytes = firstRange.buffer.byteLength;
      let nextRangeStart = DOWNLOAD_RANGE_BYTES;
      options.onProgress?.(downloadedBytes);

      const downloadWorker = async () => {
        while (true) {
          throwIfDownloadAborted(signal);
          const rangeStart = nextRangeStart;
          if (rangeStart >= manifest.archive.bytes) return;
          nextRangeStart += DOWNLOAD_RANGE_BYTES;
          const rangeEnd = Math.min(rangeStart + DOWNLOAD_RANGE_BYTES, manifest.archive.bytes) - 1;
          const result = await readArchiveRange(manifest, rangeStart, rangeEnd, signal, remoteFetch);
          if (result.response) {
            throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载服务未返回有效的分段响应");
          }
          throwIfDownloadAborted(signal);
          await writeBufferAt(file!, result.buffer, rangeStart);
          downloadedBytes += result.buffer.byteLength;
          options.onProgress?.(downloadedBytes);
        }
      };

      const rangeCount = Math.ceil(manifest.archive.bytes / DOWNLOAD_RANGE_BYTES);
      const workers = Array.from({ length: Math.min(DOWNLOAD_RANGE_CONCURRENCY, Math.max(0, rangeCount - 1)) }, () =>
        downloadWorker()
      );
      try {
        await Promise.all(workers);
      } catch (error) {
        controller.abort(error);
        await Promise.allSettled(workers);
        if (options.signal?.aborted) throw new Error("download cancelled");
        throw error;
      }
      if (downloadedBytes !== manifest.archive.bytes) {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
      }
    }
    completed = true;
  } finally {
    await file?.close();
    if (createdDestination && !completed) await fsp.rm(destination, { force: true }).catch(() => undefined);
  }
}

async function readArchiveRange(
  manifest: ComponentPackageManifest,
  start: number,
  end: number,
  signal: AbortSignal | undefined,
  remoteFetch: RemoteFetch
): Promise<{ buffer: Buffer; response?: never } | { response: Response; buffer?: never }> {
  for (let attempt = 0; attempt < DOWNLOAD_RANGE_ATTEMPTS; attempt += 1) {
    throwIfDownloadAborted(signal);
    const requestSignal = createDownloadRequestSignal(signal);
    let response: Response;
    try {
      response = await remoteFetch(manifest.archive.url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: requestSignal
      });
    } catch (error) {
      if (signal?.aborted) throw new Error("download cancelled");
      if (attempt + 1 >= DOWNLOAD_RANGE_ATTEMPTS || !isRetryableDownloadError(error)) throw error;
      await delayDownloadRetry(attempt, signal);
      continue;
    }

    if (response.status === 200 && start === 0) return { response };
    if (isRetryableDownloadStatus(response.status) && attempt + 1 < DOWNLOAD_RANGE_ATTEMPTS) {
      await response.body?.cancel().catch(() => undefined);
      await delayDownloadRetry(attempt, signal);
      continue;
    }
    if (response.status !== 206) {
      await response.body?.cancel().catch(() => undefined);
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载服务未返回有效的分段响应");
    }

    const expectedRangeBytes = end - start + 1;
    validateRangeResponse(response, manifest, start, end, expectedRangeBytes);
    try {
      return { buffer: await readExactRange(response, expectedRangeBytes, signal) };
    } catch (error) {
      if (
        attempt + 1 >= DOWNLOAD_RANGE_ATTEMPTS ||
        (!isRetryableDownloadError(error) && !(error instanceof RetryableRangeReadError))
      ) {
        throw error;
      }
      await delayDownloadRetry(attempt, signal);
    }
  }
  throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段下载失败");
}

function createDownloadRequestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(DOWNLOAD_REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function validateRangeResponse(
  response: Response,
  manifest: ComponentPackageManifest,
  start: number,
  end: number,
  expectedBytes: number
) {
  if (!response.ok || response.status !== 206 || !response.body) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载失败");
  }
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(response.headers.get("content-range") || "");
  if (!match || Number(match[1]) !== start || Number(match[2]) !== end || Number(match[3]) !== manifest.archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段范围校验失败");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== expectedBytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段大小校验失败");
  }
}

class RetryableRangeReadError extends Error {}

async function readExactRange(response: Response, expectedBytes: number, signal?: AbortSignal) {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  try {
    for await (const chunk of response.body!) {
      throwIfDownloadAborted(signal);
      const buffer = Buffer.from(chunk);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > expectedBytes) {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段响应超过声明大小");
      }
      chunks.push(buffer);
    }
  } catch (error) {
    await response.body?.cancel().catch(() => undefined);
    if (error instanceof ComponentManagerError) throw error;
    if (signal?.aborted) throw new Error("download cancelled");
    if (isRetryableDownloadError(error)) throw error;
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分段读取失败");
  }
  if (receivedBytes !== expectedBytes) throw new RetryableRangeReadError("能力包分段连接提前结束");
  return Buffer.concat(chunks, expectedBytes);
}

async function writeFullArchiveResponse(
  response: Response,
  file: fs.promises.FileHandle,
  manifest: ComponentPackageManifest,
  options: { signal?: AbortSignal; onProgress?: (downloadedBytes: number) => void }
) {
  if (!response.ok || !response.body) throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载失败");
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== manifest.archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
  }
  let downloadedBytes = 0;
  for await (const chunk of response.body) {
    throwIfDownloadAborted(options.signal);
    const buffer = Buffer.from(chunk);
    downloadedBytes += buffer.byteLength;
    if (downloadedBytes > manifest.archive.bytes) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应超过清单大小");
    }
    await writeBufferAt(file, buffer, downloadedBytes - buffer.byteLength);
    options.onProgress?.(downloadedBytes);
  }
  if (downloadedBytes !== manifest.archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
  }
  return downloadedBytes;
}

async function writeBufferAt(file: fs.promises.FileHandle, buffer: Buffer, position: number) {
  let writtenBytes = 0;
  while (writtenBytes < buffer.byteLength) {
    const result = await file.write(buffer, writtenBytes, buffer.byteLength - writtenBytes, position + writtenBytes);
    if (!result.bytesWritten) throw new Error("能力包临时文件写入提前结束");
    writtenBytes += result.bytesWritten;
  }
}

function throwIfDownloadAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("download cancelled");
}

function isRetryableDownloadStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableDownloadError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (
      current.name === "TimeoutError" ||
      RETRYABLE_DOWNLOAD_CODES.has((current as NodeJS.ErrnoException).code || "")
    ) {
      return true;
    }
    current = (current as Error & { cause?: unknown }).cause;
  }
  return false;
}

async function delayDownloadRetry(attempt: number, signal?: AbortSignal) {
  throwIfDownloadAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("download cancelled"));
    };
    const timer = setTimeout(
      () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      },
      250 * 2 ** attempt
    );
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function inspectArchive(archivePath: string) {
  try {
    await tar.t({
      file: archivePath,
      onReadEntry(entry) {
        if (!isSafeArchivePath(entry.path) || !["File", "Directory"].includes(entry.type)) {
          throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包归档包含不安全路径或链接");
        }
      }
    });
  } catch (error) {
    if (error instanceof ComponentManagerError) throw error;
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包归档格式无效");
  }
}

async function listRegularFiles(root: string): Promise<Array<{ path: string; fullPath: string; bytes: number }>> {
  const files: Array<{ path: string; fullPath: string; bytes: number }> = [];
  async function walk(directory: string, prefix: string) {
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = await fsp.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含链接");
      if (stat.isDirectory()) await walk(fullPath, relative);
      else if (stat.isFile()) files.push({ path: relative, fullPath, bytes: stat.size });
      else throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含不支持的文件类型");
    }
  }
  await walk(root, "");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function cleanPartialFiles(root: string) {
  for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.name.endsWith(".partial")) await fsp.rm(candidate, { recursive: true, force: true });
    else if (entry.isDirectory()) await cleanPartialFiles(candidate);
  }
}

async function getAvailableDiskBytes(root: string) {
  await fsp.mkdir(root, { recursive: true });
  const stats = await fsp.statfs(root);
  return Number(stats.bavail) * Number(stats.bsize);
}

function safeChildPath(root: string, child: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, child);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包路径越界");
  }
  return resolved;
}

function isPathWithin(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

function isSafeRelativePath(value: string) {
  if (!value || value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  const segments = value.split("/");
  return (
    normalized === value &&
    !normalized.startsWith("../") &&
    normalized !== ".." &&
    !segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes(":") ||
        segment.split("").some((character) => character.charCodeAt(0) < 32)
    )
  );
}

function isSafeArchivePath(value: string) {
  return value.endsWith("/") && value.length > 1 ? isSafeRelativePath(value.slice(0, -1)) : isSafeRelativePath(value);
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function sha256File(filePath: string) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

function sha256Text(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableStringify(record[key]))
        .join(",") +
      "}"
    );
  }
  throw new Error("Manifest contains an unsupported value");
}

function progress(
  downloadedBytes: number,
  totalDownloadBytes: number,
  processedFiles: number,
  totalFiles: number
): ComponentJobProgress {
  const percentage =
    totalDownloadBytes > 0 ? Math.min(100, Math.floor((downloadedBytes * 100) / totalDownloadBytes)) : 0;
  return { downloadedBytes, totalDownloadBytes, processedFiles, totalFiles, percentage };
}

function zeroProgress(): ComponentJobProgress {
  return { downloadedBytes: 0, totalDownloadBytes: 0, processedFiles: 0, totalFiles: 0, percentage: 0 };
}

function pathExists(candidate: string) {
  return fsp.access(candidate).then(
    () => true,
    () => false
  );
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "能力包安装失败";
  return message
    .replace(/[A-Za-z]:\\[^\r\n'"]+/g, "[本地路径]")
    .replace(/(?:\/[^\s'"]+){2,}/g, "[本地路径]")
    .replace(/[\r\n]/g, " ")
    .slice(0, 200);
}
