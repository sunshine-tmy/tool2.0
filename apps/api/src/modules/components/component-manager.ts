/**
 * 中文模块说明：能力包管理器负责签名目录、安装作业、完整性验证和原子版本切换。
 */
import {
  createComponentJob,
  updateComponentJob,
  failComponentJob,
  subscribeComponentJob,
  progress,
  zeroProgress
} from "./component-jobs";
import { cleanPartialFiles, getAvailableDiskBytes, pathExists } from "./package-files";
import { inspectArchive, extractArchive, verifyArchive, verifyInstalledFiles, assembleFiles } from "./package-archive";
import { readCurrent, switchCurrent, restoreCurrent } from "./package-generation";
import { downloadComponentArchive } from "./package-download";
export { downloadComponentArchive } from "./package-download";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { buildPythonEnvironment } from "./python-environment";
import type {
  ComponentJob,
  ComponentJobPhase,
  ComponentJobState,
  ComponentPackageStatus,
  ComponentPlatform
} from "@toolbox/shared";

import { componentPlatformForRuntime } from "./component-platform";

import type {
  ComponentArchiveAsset,
  OfflineArchiveUpload,
  ComponentPackageManifest,
  VerifiedComponentAsset,
  ComponentManagerOptions,
  CurrentRecord,
  InternalJob
} from "./types";
export type {
  ComponentManifestFile,
  ComponentArchiveAsset,
  ComponentAssembledFile,
  ComponentPackageManifest,
  ComponentCatalog,
  ComponentManagerOptions
} from "./types";
import { ComponentManagerError } from "./component-error";
export { ComponentManagerError } from "./component-error";
import { COMPONENT_ID } from "./package-constants";
import { safeChildPath, isPathWithin, isSafeRelativePath } from "./package-paths";
import { sha256File, sha256Text } from "./package-hash";
import { canonicalManifest } from "./manifest-signature";
export { canonicalManifest } from "./manifest-signature";
import {
  componentArchiveAssets,
  archiveAssetFileName,
  componentReleasePageUrl,
  componentDownloadBytes,
  verifyManifest
} from "./manifest";

/**
 * Renderer 只可传固定目录中的能力 id；manifest 签名覆盖下载地址、依赖和文件清单。
 * 安装使用不可变 generation，只有通过校验和自检后才切换 current.json。
 */
export class ComponentManager {
  private readonly root: string;
  private readonly platform: ComponentPlatform | undefined;
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
    this.platform = options.platform ?? componentPlatformForRuntime();
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
    const result = statuses.map((status): ComponentPackageStatus => {
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
    const retired = await this.retiredPythonStatus();
    if (retired) result.push(retired);
    return result;
  }

  /** 仅管理目录退役后留下的固定旧解释器，不信任或执行旧安装目录中的代码。 */
  private async retiredPythonDependents() {
    const dependents: string[] = [];
    for (const id of ["edge-tts", "image-ai", "chatterbox", "chatterbox-cuda"]) {
      const current = await this.readCurrent(this.componentRoot(id), id);
      if (!current) {
        // 损坏的 current 也不能当作“已经升级或卸载”。
        if (await pathExists(path.join(this.componentRoot(id), "current.json"))) dependents.push(id);
        continue;
      }
      const target = this.manifests.get(id);
      if (
        !target ||
        target.pythonEnvironment?.pythonComponentId !== "python-312" ||
        target.pythonEnvironment.expectedPythonVersion !== "3.12" ||
        !target.dependencyIds.includes("python-312") ||
        target.version !== current.version ||
        sha256Text(canonicalManifest(target)) !== current.manifestSha256
      )
        dependents.push(id);
      else this.verifyManifest(target);
    }
    return dependents;
  }

  private async retiredPythonStatus(): Promise<ComponentPackageStatus | undefined> {
    if (this.manifests.has("python-311") || !this.platform) return;
    const current = await this.readCurrent(this.componentRoot("python-311"), "python-311");
    if (!current || !current.version.startsWith("3.11.")) return;
    const dependentIds = await this.retiredPythonDependents();
    const activeJobId = this.activeByComponent.get("python-311");
    return {
      id: "python-311",
      moduleId: "python-311",
      groupId: "shared",
      platform: this.platform,
      displayName: "Python 3.11 旧运行时",
      retired: true,
      purpose: "仅为旧安装提供安全卸载入口；新能力统一使用 Python 3.12，不再提供旧版安装或重装。",
      taskToolIds: [],
      dependencyIds: [],
      dependentIds,
      installConditions: ["先将依赖能力更新至 Python 3.12 版本，再在无任务、安装和播放时卸载旧运行时。"],
      version: current.version,
      installedVersion: current.version,
      installedAt: current.installedAt,
      installed: true,
      installedBytes: current.installedBytes ?? 0,
      downloadBytes: 0,
      archiveFileNames: [],
      state: activeJobId ? "installing" : "ready",
      health: "unknown",
      licenseName: "Python Software Foundation License Version 2",
      ...(activeJobId ? { activeJobId } : {}),
      ...(dependentIds.length ? { blockedReason: "仍有能力未完成 Python 3.12 升级，请先更新依赖能力。" } : {}),
      ...(this.lastFailures.get("python-311") ? { failureReason: this.lastFailures.get("python-311")!.message } : {})
    };
  }

  private async startRetiredPythonUninstall() {
    await this.initialize();
    if (!(await this.retiredPythonStatus()))
      throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "未找到可卸载的旧 Python 运行时");
    if (this.hasActiveJobs()) throw new ComponentManagerError("COMPONENT_OPERATION_CONFLICT", "能力管理作业尚未完成");
    const job = this.createJob("python-311", "uninstall", "queued", "queued", 0, 0);
    const internal: InternalJob = { value: job };
    this.jobs.set(job.id, internal);
    this.activeByComponent.set("python-311", job.id);
    void (async () => {
      let stopped = false;
      const check = async () => {
        if (
          (await this.retiredPythonDependents()).length ||
          (await this.isInUse("python-311", ["edge-tts", "image-ai", "chatterbox"]))
        ) {
          throw new ComponentManagerError(
            "COMPONENT_IN_USE",
            "旧运行时仍被依赖，或存在任务、安装或播放；请先完成升级并保持空闲"
          );
        }
      };
      try {
        this.updateJob(internal, { state: "running", phase: "uninstalling" });
        await check();
        await this.onBeforeUninstall?.("python-311");
        stopped = true;
        await check();
        const target = this.componentRoot("python-311");
        const root = await fsp.realpath(this.root);
        if (
          (await fsp.lstat(target)).isSymbolicLink() ||
          (await fsp.realpath(target)) !== path.join(root, "python-311")
        ) {
          throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "旧运行时路径异常，拒绝删除");
        }
        await fsp.rm(target, { recursive: true, force: true });
        this.lastFailures.delete("python-311");
        await this.notifyAfterMutation("python-311", "uninstall");
        this.updateJob(internal, { state: "completed", phase: "complete", progress: zeroProgress() });
      } catch (error) {
        if (stopped) await this.notifyAfterMutation("python-311", "uninstall").catch(() => undefined);
        this.failJob(internal, error);
      } finally {
        this.activeByComponent.delete("python-311");
      }
    })();
    return job;
  }

  hasActiveJobs() {
    return this.activeByComponent.size > 0;
  }

  /** 仅校验当前代，不安装、不切换版本。取消只中止本次只读检查。 */
  async verifyCurrent(componentId: string, signal: AbortSignal, selfTest?: ComponentManagerOptions["selfTest"]) {
    await this.initialize();
    signal.throwIfAborted();
    const manifest = this.getManifest(componentId);
    this.verifyManifest(manifest);
    const current = await this.readCurrent(this.componentRoot(componentId), componentId);
    if (!current) throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "该能力尚未安装");
    const versions = await fsp.realpath(path.join(this.componentRoot(componentId), "versions"));
    const root = await fsp.realpath(safeChildPath(versions, current.directory));
    if (!isPathWithin(versions, root)) throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力路径无效");
    if (current.manifestSha256 !== sha256Text(canonicalManifest(manifest)))
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "当前版本不匹配");
    // 安装完成后可能新增合法 venv 和缓存；只逐一校验签名工件，不能误判生成目录为篡改。
    for (const file of manifest.files) {
      signal.throwIfAborted();
      await this.resolveInstalledAsset(componentId, file.path);
    }
    signal.throwIfAborted();
    await (selfTest ?? this.selfTest)?.(manifest, root);
    signal.throwIfAborted();
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
      const pythonRelativePath = this.platform === "darwin-arm64" ? "venv/bin/python" : "venv/Scripts/python.exe";
      const pythonPath = await fsp.realpath(safeChildPath(generationRoot, pythonRelativePath));
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
    return subscribeComponentJob(this.jobCollections(), jobId, listener);
  }

  startInstall(componentId: string) {
    return this.startJob(componentId, "install");
  }

  startReinstall(componentId: string) {
    return this.startJob(componentId, "reinstall");
  }

  startUninstall(componentId: string) {
    if (componentId === "python-311" && !this.manifests.has(componentId)) return this.startRetiredPythonUninstall();
    return this.startJob(componentId, "uninstall");
  }

  /**
   * Resolve import constraints from the embedded catalog before accepting a large request body.
   * This fails fast for missing dependencies, busy workers, invalid signatures, or low disk space.
   */
  async getOfflineImportRequirements(componentId: string) {
    await this.initialize();
    const manifest = this.getManifest(componentId);
    this.verifyManifest(manifest);
    if (this.activeByComponent.has(componentId)) {
      throw new ComponentManagerError("COMPONENT_OPERATION_CONFLICT", "该能力已有其他管理作业正在运行");
    }
    await this.assertDependenciesReady(manifest);
    const current = await this.readCurrent(this.componentRoot(componentId), componentId);
    if (current && (await this.isInUse(componentId, this.affectedTaskToolIds(componentId)))) {
      throw new ComponentManagerError("COMPONENT_IN_USE", "能力正在被运行任务使用，暂时无法导入或重装");
    }
    const totalBytes = componentDownloadBytes(manifest);
    const freeBytes = await this.availableDiskBytes(this.root);
    if (freeBytes < totalBytes + manifest.installedBytes) {
      throw new ComponentManagerError("COMPONENT_DISK_SPACE_LOW", "磁盘可用空间不足");
    }
    const archives = componentArchiveAssets(manifest).map((archive) => ({
      filename: archiveAssetFileName(archive),
      bytes: archive.bytes
    }));
    if (new Set(archives.map((archive) => archive.filename)).size !== archives.length) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包归档文件名重复");
    }
    return { archives, totalBytes };
  }

  /** Maximum multipart request body allowed by any package in this signed catalog. */
  getOfflineImportBodyLimit() {
    const largestPackage = Math.max(0, ...[...this.manifests.values()].map(componentDownloadBytes));
    return largestPackage + 1024 * 1024;
  }

  /**
   * Stream local archives into manager-owned temporary files. Renderer input is limited to bytes
   * and filenames; it can never select an install path, executable, or download URL.
   */
  async startOfflineImport(
    componentId: string,
    uploads: AsyncIterable<OfflineArchiveUpload>,
    onProgress?: (uploadedBytes: number, totalBytes: number) => void
  ) {
    const requirements = await this.getOfflineImportRequirements(componentId);
    const manifest = this.getManifest(componentId);
    const assets = componentArchiveAssets(manifest);
    const importRoot = safeChildPath(
      this.componentRoot(componentId),
      path.join("archives", `.offline-import-${crypto.randomUUID()}.partial`)
    );
    await fsp.mkdir(path.dirname(importRoot), { recursive: true });
    await fsp.mkdir(importRoot, { recursive: false });
    const stagedPaths: Array<string | undefined> = Array.from({ length: assets.length });
    const received = new Set<number>();
    let uploadedBytes = 0;
    let ownershipTransferred = false;

    try {
      for await (const upload of uploads) {
        if (upload.fieldName !== "archives") {
          upload.stream.resume();
          throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "上传字段无效；请只选择能力包文件");
        }
        const archiveIndex = requirements.archives.findIndex((archive) => archive.filename === upload.filename);
        if (archiveIndex < 0 || received.has(archiveIndex)) {
          upload.stream.resume();
          throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "文件名不属于当前能力版本，或重复选择了文件");
        }
        received.add(archiveIndex);
        const archiveAsset = assets[archiveIndex]!;
        const destination = safeChildPath(importRoot, `${archiveIndex}.tar.gz.partial`);
        const hash = crypto.createHash("sha256");
        let fileBytes = 0;
        const meter = new Transform({
          transform: (chunk: Buffer | string, encoding, callback) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
            fileBytes += buffer.byteLength;
            if (fileBytes > archiveAsset.bytes) {
              callback(new ComponentManagerError("COMPONENT_IMPORT_INVALID", "离线能力包超过签名清单声明的大小"));
              return;
            }
            hash.update(buffer);
            onProgress?.(uploadedBytes + fileBytes, requirements.totalBytes);
            callback(null, buffer);
          }
        });

        try {
          await pipeline(upload.stream, meter, fs.createWriteStream(destination, { flags: "wx", mode: 0o600 }));
        } catch (error) {
          if (error instanceof ComponentManagerError) throw error;
          if ((error as NodeJS.ErrnoException)?.code === "ENOSPC") {
            throw new ComponentManagerError("COMPONENT_DISK_SPACE_LOW", "磁盘空间不足，离线能力包未导入");
          }
          throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "离线能力包上传中断或无法读取，请重新选择文件");
        }
        if (upload.stream.truncated) {
          throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "离线能力包上传不完整或超过允许大小");
        }
        if (fileBytes !== archiveAsset.bytes) {
          throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "离线能力包大小与受信任目录不一致");
        }
        if (hash.digest("hex") !== archiveAsset.sha256) {
          throw new ComponentManagerError(
            "COMPONENT_IMPORT_INVALID",
            "离线能力包 SHA-256 校验失败，文件可能损坏或版本不匹配"
          );
        }
        const stagedPath = safeChildPath(importRoot, `${archiveIndex}.tar.gz.partial`);
        await this.verifyArchive(stagedPath, archiveAsset);
        stagedPaths[archiveIndex] = stagedPath;
        uploadedBytes += fileBytes;
        onProgress?.(uploadedBytes, requirements.totalBytes);
      }

      if (received.size !== assets.length || stagedPaths.some((stagedPath) => !stagedPath)) {
        throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "所选文件不完整；请一次选择该能力要求的全部分卷");
      }

      const current = await this.readCurrent(this.componentRoot(componentId), componentId);
      const job = await this.startJob(
        componentId,
        current ? "reinstall" : "install",
        stagedPaths as string[],
        importRoot
      );
      ownershipTransferred = true;
      return job;
    } finally {
      if (!ownershipTransferred) await fsp.rm(importRoot, { recursive: true, force: true }).catch(() => undefined);
    }
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

  private async startJob(
    componentId: string,
    operation: ComponentJob["operation"],
    offlineArchivePaths?: string[],
    offlineImportRoot?: string
  ) {
    await this.initialize();
    this.getManifest(componentId);
    const existingId = this.activeByComponent.get(componentId);
    if (existingId) {
      const activeJob = this.jobs.get(existingId)!.value;
      if (offlineArchivePaths || activeJob.operation !== operation) {
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
      operation === "uninstall" ? 0 : componentDownloadBytes(manifest),
      manifest.files.length
    );
    const internal = {
      value: job,
      ...(offlineArchivePaths ? { offlineArchivePaths, offlineImportRoot } : {})
    } satisfies InternalJob;
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
      const requiredBytes = internal.offlineArchivePaths
        ? manifest.installedBytes
        : componentDownloadBytes(manifest) + manifest.installedBytes;
      if (freeBytes < requiredBytes) {
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
      if (internal.offlineArchivePaths) {
        await Promise.all(internal.offlineArchivePaths.map((archivePath) => fsp.rm(archivePath, { force: true })));
      }
      if (internal.offlineImportRoot) {
        await fsp.rm(internal.offlineImportRoot, { recursive: true, force: true }).catch(() => undefined);
      }
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
    const staging = safeChildPath(versionsRoot, "." + generationName + "." + crypto.randomUUID() + ".partial");
    const oldCurrent = await this.readCurrent(componentRoot, manifest.id);
    const signal = internal.controller?.signal;
    if (!signal) throw new Error("Install job is missing its download cancellation signal");
    let targetCreated = false;
    let downloadedBytes = 0;
    const archiveAssets = componentArchiveAssets(manifest);
    const downloadBytesTotal = componentDownloadBytes(manifest);
    try {
      await fsp.mkdir(staging, { recursive: false });
      for (const [index, archiveAsset] of archiveAssets.entries()) {
        const archiveManifest = { ...manifest, archive: archiveAsset };
        const archivePath = safeChildPath(archiveRoot, `${manifest.version}.${index}.${crypto.randomUUID()}.partial`);
        try {
          const offlineArchivePath = internal.offlineArchivePaths?.[index];
          if (offlineArchivePath) {
            this.updateJob(internal, { phase: "verifying" });
            await fsp.rename(offlineArchivePath, archivePath);
            this.updateJob(internal, {
              progress: progress(downloadedBytes + archiveAsset.bytes, downloadBytesTotal, 0, manifest.files.length)
            });
          } else {
            this.updateJob(internal, { phase: "downloading" });
            await this.downloadArchive(archiveManifest, archivePath, {
              signal,
              onProgress: (partDownloadedBytes) =>
                this.updateJob(internal, {
                  progress: progress(
                    downloadedBytes + partDownloadedBytes,
                    downloadBytesTotal,
                    0,
                    manifest.files.length
                  )
                })
            });
          }
          if (signal.aborted) throw new Error("download cancelled");
          downloadedBytes += archiveAsset.bytes;
          this.updateJob(internal, {
            phase: "verifying",
            progress: progress(downloadedBytes, downloadBytesTotal, 0, manifest.files.length)
          });
          await this.verifyArchive(archivePath, archiveAsset);
          this.updateJob(internal, { phase: "extracting" });
          await inspectArchive(archivePath, archiveAsset.filePaths);
          await extractArchive(archivePath, staging);
        } finally {
          await fsp.rm(archivePath, { force: true }).catch(() => undefined);
        }
      }
      if (signal.aborted) throw new Error("download cancelled");
      await this.assembleFiles(staging, manifest, signal);
      await this.verifyInstalledFiles(staging, manifest);
      await fsp.rename(staging, target);
      targetCreated = true;
      if (manifest.pythonEnvironment) {
        this.updateJob(internal, {
          phase: "building-python",
          progress: progress(downloadBytesTotal, downloadBytesTotal, manifest.files.length, manifest.files.length)
        });
        const { pythonComponentId, ...pythonEnvironment } = manifest.pythonEnvironment;
        const pythonRuntime = pythonComponentId
          ? await this.resolveInstalledAsset(pythonComponentId, pythonEnvironment.pythonExecutablePath)
          : undefined;
        await buildPythonEnvironment({
          packageRoot: target,
          ...pythonEnvironment,
          platform: manifest.platform,
          ...(pythonRuntime ? { pythonRuntimeRoot: pythonRuntime.generationRoot } : {}),
          runProcess: this.runPythonProcess,
          onProgress: (python) => this.updateJob(internal, { progress: { ...internal.value.progress, python } })
        });
      }
      this.updateJob(internal, {
        phase: "self-test",
        progress: progress(downloadBytesTotal, downloadBytesTotal, manifest.files.length, manifest.files.length)
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
      await Promise.all([fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined)]);
    }
  }

  private async restoreCurrent(componentId: string, previous?: CurrentRecord) {
    return restoreCurrent(this.componentRoot(componentId), previous);
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

  private jobCollections() {
    return {
      jobs: this.jobs,
      listeners: this.listeners,
      lastFailures: this.lastFailures,
      activeByComponent: this.activeByComponent
    };
  }

  private createJob(
    componentId: string,
    operation: ComponentJob["operation"],
    state: ComponentJobState,
    phase: ComponentJobPhase,
    totalDownloadBytes: number,
    totalFiles: number
  ): ComponentJob {
    return createComponentJob(
      this.jobCollections(),
      componentId,
      operation,
      state,
      phase,
      totalDownloadBytes,
      totalFiles
    );
  }

  private updateJob(internal: InternalJob, patch: Partial<ComponentJob>) {
    return updateComponentJob(this.jobCollections(), internal, patch);
  }

  private failJob(internal: InternalJob, error: unknown) {
    return failComponentJob(this.jobCollections(), internal, error);
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
    const releasePageUrl = componentReleasePageUrl(manifest);
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
      downloadBytes: componentDownloadBytes(manifest),
      archiveFileNames: componentArchiveAssets(manifest).map(archiveAssetFileName),
      ...(releasePageUrl ? { releasePageUrl } : {}),
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
    return verifyManifest(manifest, this.platform, this.maxArchiveBytes, this.trustedPublicKeys);
  }

  private async verifyArchive(archivePath: string, archive: ComponentArchiveAsset) {
    return verifyArchive(archivePath, archive);
  }

  private async verifyInstalledFiles(root: string, manifest: ComponentPackageManifest, signal?: AbortSignal) {
    return verifyInstalledFiles(root, manifest, this.platform, signal);
  }

  private async assembleFiles(root: string, manifest: ComponentPackageManifest, signal: AbortSignal) {
    return assembleFiles(root, manifest, signal);
  }

  private async switchCurrent(
    componentRoot: string,
    manifest: ComponentPackageManifest,
    directory: string,
    previous?: CurrentRecord
  ) {
    return switchCurrent(componentRoot, manifest, directory, previous);
  }

  private async readCurrent(componentRoot: string, expectedId?: string): Promise<CurrentRecord | undefined> {
    return readCurrent(componentRoot, expectedId);
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
