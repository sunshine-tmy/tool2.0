/** 中文模块说明：能力包安装的完整性回归测试，验证签名、文件清单和失败不覆盖当前版本。 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComponentManager,
  canonicalManifest,
  type ComponentManagerOptions,
  type ComponentPackageManifest
} from "../modules/components/component-manager";
import { registerComponentRoutes } from "../modules/components/routes";

const keyPair = crypto.generateKeyPairSync("ed25519");
const publicKey = keyPair.publicKey.export({ format: "pem", type: "spki" }).toString();
let temporaryRoot = "";

afterEach(async () => {
  if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = "";
});

describe("ComponentManager", () => {
  it("installs a signed package, verifies every file and atomically records the current version", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath);

    await expect(manager.list()).resolves.toMatchObject([
      {
        id: "edge-tts",
        taskToolIds: ["edge-tts"],
        installed: false,
        installedBytes: fixture.manifest.installedBytes
      }
    ]);
    await expect(manager.install("edge-tts")).resolves.toMatchObject({
      id: "edge-tts",
      installed: true,
      installedVersion: "1.0.0"
    });

    await expect(
      fs.readFile(path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0", "bin", "runner.exe"), "utf8")
    ).resolves.toBe("runner-1.0.0");
    await expect(manager.list()).resolves.toMatchObject([{ installed: true, installedVersion: "1.0.0" }]);
  });

  it("allows an internal package without license metadata and labels it as internal", async () => {
    const fixture = await createFixture("1.0.0", { license: null });
    const manager = createManager(fixture.manifest, fixture.archivePath);

    const installed = await manager.install("edge-tts");
    expect(installed).toMatchObject({
      installed: true,
      licenseName: "内部使用"
    });
    expect(installed).not.toHaveProperty("licenseUrl");
  });

  it("resolves only current-generation files listed in the trusted manifest and detects tampering", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath);
    await manager.install("edge-tts");

    const asset = await manager.resolveInstalledAsset("edge-tts", "bin/runner.exe");
    expect(asset.path).toBe(path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0", "bin", "runner.exe"));
    expect(asset.generationRoot).toBe(path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0"));
    expect(asset.manifest.signature).toBe(fixture.manifest.signature);
    await expect(manager.resolveInstalledAsset("edge-tts", "../outside.exe")).rejects.toMatchObject({
      code: "COMPONENT_MANIFEST_INVALID"
    });
    await expect(manager.resolveInstalledAsset("edge-tts", "not-in-manifest.exe")).rejects.toMatchObject({
      code: "COMPONENT_MANIFEST_INVALID"
    });

    await fs.writeFile(asset.path, "modified runner");
    await expect(manager.resolveInstalledAsset("edge-tts", "bin/runner.exe")).rejects.toMatchObject({
      code: "COMPONENT_INSTALL_FAILED"
    });
  });

  it("resolves only the Python environment built from a signed manifest lock", async () => {
    const fixture = await createFixture("1.0.0", { pythonEnvironment: true });
    const manager = createManager(fixture.manifest, fixture.archivePath, undefined, {
      runPythonProcess: async (_executable, args) => {
        if (args[0] === "-m" && args[1] === "venv") {
          const pythonPath = path.join(args[2], "Scripts", "python.exe");
          await fs.mkdir(path.dirname(pythonPath), { recursive: true });
          await fs.writeFile(pythonPath, "generated venv interpreter");
        }
        return "3.11";
      }
    });
    await manager.install("edge-tts");

    await expect(manager.resolveInstalledPython("edge-tts")).resolves.toMatchObject({
      path: path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0", "venv", "Scripts", "python.exe"),
      generationRoot: path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0")
    });
  });

  it("keeps the healthy current version when a later archive fails verification", async () => {
    const first = await createFixture("1.0.0");
    const firstManager = createManager(first.manifest, first.archivePath);
    await firstManager.install("edge-tts");

    const broken = await createFixture("1.1.0", { archiveSha256: "0".repeat(64) });
    const updateManager = createManager(broken.manifest, broken.archivePath);
    await expect(updateManager.install("edge-tts")).rejects.toMatchObject({ code: "COMPONENT_INSTALL_FAILED" });

    await expect(updateManager.list()).resolves.toMatchObject([{ installed: true, installedVersion: "1.0.0" }]);
    await expect(
      fs.readFile(path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0", "bin", "runner.exe"), "utf8")
    ).resolves.toBe("runner-1.0.0");
  });

  it("switches to a verified update while retaining the previous version", async () => {
    const first = await createFixture("1.0.0");
    await createManager(first.manifest, first.archivePath).install("edge-tts");
    const update = await createFixture("1.1.0");
    const manager = createManager(update.manifest, update.archivePath);

    await expect(manager.install("edge-tts")).resolves.toMatchObject({
      installedVersion: "1.1.0",
      previousVersion: "1.0.0"
    });
    await expect(
      fs.access(path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0", "LICENSE"))
    ).resolves.toBeUndefined();
  });

  it("rejects an invalid manifest signature before starting a download", async () => {
    const fixture = await createFixture("1.0.0", { signature: "invalid" });
    const downloadArchive = vi.fn(async (_manifest: ComponentPackageManifest, destination: string) => {
      await fs.copyFile(fixture.archivePath, destination);
    });
    const manager = createManager(fixture.manifest, fixture.archivePath, downloadArchive);

    await expect(manager.install("edge-tts")).rejects.toMatchObject({
      code: "COMPONENT_MANIFEST_INVALID"
    });
    expect(downloadArchive).not.toHaveBeenCalled();
  });

  it("rejects an archive that contains a file outside its signed file list", async () => {
    const fixture = await createFixture("1.0.0", { omitManifestPath: "LICENSE" });
    const manager = createManager(fixture.manifest, fixture.archivePath);

    await expect(manager.install("edge-tts")).rejects.toMatchObject({ code: "COMPONENT_INSTALL_FAILED" });
    await expect(fs.access(path.join(temporaryRoot, "packages", "edge-tts", "current.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("runs a background install job, deduplicates repeated clicks and reports terminal state", async () => {
    const fixture = await createFixture("1.0.0");
    let releaseDownload!: () => void;
    let notifyDownloadStarted!: () => void;
    const downloadStarted = new Promise<void>((resolve) => (notifyDownloadStarted = resolve));
    const downloadGate = new Promise<void>((resolve) => (releaseDownload = resolve));
    const manager = createManager(fixture.manifest, fixture.archivePath, async (manifest, destination, options) => {
      notifyDownloadStarted();
      await downloadGate;
      options?.onProgress?.(Math.ceil(manifest.archive.bytes / 2));
      await fs.copyFile(fixture.archivePath, destination);
      options?.onProgress?.(manifest.archive.bytes);
    });
    const firstJob = await manager.startInstall("edge-tts");
    const repeatedJob = await manager.startInstall("edge-tts");
    const progressUpdates: string[] = [];
    manager.subscribe(firstJob.id, (job) => progressUpdates.push(job.phase + ":" + job.progress.percentage));

    expect(repeatedJob.id).toBe(firstJob.id);
    await downloadStarted;
    try {
      await expect(manager.list()).resolves.toMatchObject([
        { id: "edge-tts", taskToolIds: ["edge-tts"], state: "downloading", activeJobId: firstJob.id }
      ]);
    } finally {
      releaseDownload();
    }
    await expect(waitForJob(manager, firstJob.id)).resolves.toMatchObject({
      operation: "install",
      state: "completed",
      phase: "complete"
    });
    expect(progressUpdates).toContain("downloading:50");
    expect(progressUpdates).toContain("downloading:100");
    await expect(manager.list()).resolves.toMatchObject([
      { id: "edge-tts", installed: true, state: "ready", health: "healthy" }
    ]);
  });

  it("preserves the healthy generation when reinstall self-test fails", async () => {
    const fixture = await createFixture("1.0.0");
    const root = path.join(temporaryRoot, "packages");
    await createManager(fixture.manifest, fixture.archivePath).install("edge-tts");
    const currentPath = path.join(root, "edge-tts", "current.json");
    const before = await fs.readFile(currentPath, "utf8");
    const manager = new ComponentManager({
      root,
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      downloadArchive: async (_manifest, destination) => fs.copyFile(fixture.archivePath, destination),
      selfTest: async () => {
        throw new Error("runner self-test failed");
      }
    });

    const job = await manager.startReinstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({
      operation: "reinstall",
      state: "failed"
    });
    await expect(fs.readFile(currentPath, "utf8")).resolves.toBe(before);
    await expect(
      fs.readFile(path.join(root, "edge-tts", "versions", "1.0.0", "bin", "runner.exe"), "utf8")
    ).resolves.toBe("runner-1.0.0");
  });

  it("blocks reinstall while its runtime is used by an active task", async () => {
    const fixture = await createFixture("1.0.0");
    const root = path.join(temporaryRoot, "packages");
    await createManager(fixture.manifest, fixture.archivePath).install("edge-tts");
    const refreshRuntime = vi.fn(async () => undefined);
    const manager = new ComponentManager({
      root,
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      downloadArchive: async (_manifest, destination) => fs.copyFile(fixture.archivePath, destination),
      onAfterMutation: refreshRuntime,
      isInUse: async (componentId, taskToolIds) => componentId === "edge-tts" && taskToolIds.includes("edge-tts")
    });
    const currentPath = path.join(root, "edge-tts", "current.json");
    const before = await fs.readFile(currentPath, "utf8");

    const job = await manager.startReinstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_IN_USE"
    });
    await expect(fs.readFile(currentPath, "utf8")).resolves.toBe(before);
    expect(refreshRuntime).not.toHaveBeenCalled();
  });

  it("builds hash-locked Python environments only after the package reaches its immutable final path", async () => {
    const fixture = await createFixture("1.0.0", { pythonEnvironment: true });
    const root = path.join(temporaryRoot, "packages");
    const calls: Array<{
      executable: string;
      args: string[];
      cwd: string;
      environment?: Record<string, string>;
    }> = [];
    const manager = new ComponentManager({
      root,
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      downloadArchive: async (_manifest, destination) => fs.copyFile(fixture.archivePath, destination),
      runPythonProcess: async (executable, args, cwd, environment) => {
        calls.push({ executable, args, cwd, environment });
        return args[0] === "-c" ? "3.11\n" : "";
      },
      selfTest: async (_manifest, generationRoot) => {
        expect(generationRoot).toBe(path.join(root, "edge-tts", "versions", "1.0.0"));
        expect(path.join(generationRoot, "venv")).toBe(path.join(root, "edge-tts", "versions", "1.0.0", "venv"));
      }
    });

    const job = await manager.startInstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({ state: "completed" });
    expect(calls.length).toBe(5);
    expect(calls.every((call) => call.cwd === path.join(root, "edge-tts", "versions", "1.0.0"))).toBe(true);
    expect(calls[3].args).toContain("--no-index");
    expect(calls[3].args).toContain("--no-cache-dir");
    expect(calls[3].environment?.TEMP).toBe(path.join(root, "edge-tts", "versions", "1.0.0", ".python-build-temp"));
  });

  it("blocks dependents until dependencies are installed and refuses dependency removal", async () => {
    const dependency = await createFixture("1.0.0", { id: "ffmpeg", displayName: "FFmpeg" });
    const dependent = await createFixture("1.0.0", {
      id: "media-worker",
      displayName: "Media Worker",
      dependencyIds: ["ffmpeg"]
    });
    const archives = new Map([
      ["ffmpeg", dependency.archivePath],
      ["media-worker", dependent.archivePath]
    ]);
    const manager = new ComponentManager({
      root: path.join(temporaryRoot, "packages"),
      catalog: {
        manifests: [dependency.manifest, dependent.manifest],
        trustedPublicKeys: { "test-ed25519": publicKey }
      },
      downloadArchive: async (manifest, destination) => fs.copyFile(archives.get(manifest.id)!, destination)
    });

    await expect(manager.list()).resolves.toMatchObject([
      { id: "ffmpeg", state: "not-installed" },
      { id: "media-worker", state: "blocked", blockedReason: "缺少依赖：ffmpeg" }
    ]);
    const blockedInstall = await manager.startInstall("media-worker");
    await expect(waitForJob(manager, blockedInstall.id)).resolves.toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_DEPENDENCY_MISSING"
    });
    const dependencyJob = await manager.startInstall("ffmpeg");
    await waitForJob(manager, dependencyJob.id);
    const dependentJob = await manager.startInstall("media-worker");
    await waitForJob(manager, dependentJob.id);
    const blockedRemoval = await manager.startUninstall("ffmpeg");
    await expect(waitForJob(manager, blockedRemoval.id)).resolves.toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_IN_USE"
    });

    const userDataPath = path.join(temporaryRoot, "user-data", "作品", "history.json");
    await fs.mkdir(path.dirname(userDataPath), { recursive: true });
    await fs.writeFile(userDataPath, "preserve");
    const removeDependent = await manager.startUninstall("media-worker");
    await waitForJob(manager, removeDependent.id);
    const removeDependency = await manager.startUninstall("ffmpeg");
    await waitForJob(manager, removeDependency.id);
    await expect(fs.readFile(userDataPath, "utf8")).resolves.toBe("preserve");
  });

  it("prevents a dependency uninstall from racing a dependent install", async () => {
    const dependency = await createFixture("1.0.0", { id: "ffmpeg", displayName: "FFmpeg" });
    const dependent = await createFixture("1.0.0", {
      id: "media-worker",
      displayName: "Media Worker",
      dependencyIds: ["ffmpeg"]
    });
    const archives = new Map([
      ["ffmpeg", dependency.archivePath],
      ["media-worker", dependent.archivePath]
    ]);
    let releaseDownload!: () => void;
    let notifyDownloadStarted!: () => void;
    const downloadStarted = new Promise<void>((resolve) => {
      notifyDownloadStarted = resolve;
    });
    const downloadGate = new Promise<void>((resolve) => {
      releaseDownload = resolve;
    });
    const manager = new ComponentManager({
      root: path.join(temporaryRoot, "packages"),
      catalog: {
        manifests: [dependency.manifest, dependent.manifest],
        trustedPublicKeys: { "test-ed25519": publicKey }
      },
      downloadArchive: async (manifest, destination) => {
        if (manifest.id === "media-worker") {
          notifyDownloadStarted();
          await downloadGate;
        }
        await fs.copyFile(archives.get(manifest.id)!, destination);
      }
    });
    const dependencyJob = await manager.startInstall("ffmpeg");
    await waitForJob(manager, dependencyJob.id);
    const dependentJob = await manager.startInstall("media-worker");
    await downloadStarted;

    try {
      const removalJob = await manager.startUninstall("ffmpeg");
      await expect(waitForJob(manager, removalJob.id)).resolves.toMatchObject({
        state: "failed",
        errorCode: "COMPONENT_IN_USE"
      });
    } finally {
      releaseDownload();
    }
    await expect(waitForJob(manager, dependentJob.id)).resolves.toMatchObject({ state: "completed" });
  });

  it("checks free disk space before downloading", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath, undefined, {
      availableDiskBytes: async () => 1
    });
    const job = await manager.startInstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_DISK_SPACE_LOW"
    });
  });

  it("allows cancellation only during download and removes its partial archive", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = createManager(
      fixture.manifest,
      fixture.archivePath,
      async (_manifest, destination, options) =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(async () => {
            try {
              await fs.copyFile(fixture.archivePath, destination);
              resolve();
            } catch (error) {
              reject(error);
            }
          }, 500);
          options?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timeout);
              reject(new Error("aborted"));
            },
            { once: true }
          );
        })
    );
    const job = await manager.startInstall("edge-tts");
    await waitForPhase(manager, job.id, "downloading");
    await expect(manager.startInstall("edge-tts")).resolves.toMatchObject({ id: job.id });
    await expect(manager.cancelJob(job.id)).resolves.toMatchObject({ id: job.id });
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({ state: "cancelled" });
    await expect(fs.readdir(path.join(temporaryRoot, "packages", "edge-tts", "archives"))).resolves.toEqual([]);
    await expect(manager.list()).resolves.toMatchObject([{ installed: false, state: "not-installed" }]);
  });

  it("cleans abandoned partial files on startup without resuming the old download", async () => {
    const fixture = await createFixture("1.0.0");
    const archiveDirectory = path.join(temporaryRoot, "packages", "edge-tts", "archives");
    const versionDirectory = path.join(temporaryRoot, "packages", "edge-tts", "versions");
    await fs.mkdir(archiveDirectory, { recursive: true });
    await fs.mkdir(versionDirectory, { recursive: true });
    await fs.writeFile(path.join(archiveDirectory, "download.partial"), "partial");
    await fs.mkdir(path.join(versionDirectory, ".staging.partial"));
    const manager = createManager(fixture.manifest, fixture.archivePath);

    await manager.list();
    await expect(fs.readdir(archiveDirectory)).resolves.toEqual([]);
    await expect(fs.readdir(versionDirectory)).resolves.toEqual([]);
  });

  it("blocks uninstall while a task is using the capability", async () => {
    const fixture = await createFixture("1.0.0");
    const root = path.join(temporaryRoot, "packages");
    await createManager(fixture.manifest, fixture.archivePath).install("edge-tts");
    const onBeforeUninstall = vi.fn(async () => undefined);
    const manager = new ComponentManager({
      root,
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      onBeforeUninstall,
      isInUse: async (componentId, taskToolIds) => componentId === "edge-tts" && taskToolIds.includes("edge-tts")
    });

    const job = await manager.startUninstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_IN_USE"
    });
    expect(onBeforeUninstall).not.toHaveBeenCalled();
  });

  it("stops a managed runtime only after uninstall preflight succeeds", async () => {
    const fixture = await createFixture("1.0.0");
    const stopRuntime = vi.fn(async () => undefined);
    const manager = createManager(fixture.manifest, fixture.archivePath, undefined, {
      onBeforeUninstall: stopRuntime
    });
    await manager.install("edge-tts");
    const job = await manager.startUninstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({ state: "completed" });
    expect(stopRuntime).toHaveBeenCalledWith("edge-tts");
  });

  it("refreshes the managed runtime after each successful install, reinstall and uninstall", async () => {
    const fixture = await createFixture("1.0.0");
    const onAfterMutation = vi.fn(async () => undefined);
    const manager = createManager(fixture.manifest, fixture.archivePath, undefined, { onAfterMutation });

    await manager.install("edge-tts");
    expect(onAfterMutation).toHaveBeenNthCalledWith(1, "edge-tts", "install");
    const reinstall = await manager.startReinstall("edge-tts");
    await expect(waitForJob(manager, reinstall.id)).resolves.toMatchObject({ state: "completed" });
    expect(onAfterMutation).toHaveBeenNthCalledWith(2, "edge-tts", "reinstall");
    const uninstall = await manager.startUninstall("edge-tts");
    await expect(waitForJob(manager, uninstall.id)).resolves.toMatchObject({ state: "completed" });
    expect(onAfterMutation).toHaveBeenNthCalledWith(3, "edge-tts", "uninstall");
    expect(onAfterMutation).toHaveBeenCalledTimes(3);
  });
});

describe("component routes", () => {
  it("lists the bundled catalog and never accepts a renderer supplied URL", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-component-routes-"));
    const app = fastify();
    app.addHook("preSerialization", async (request, _reply, payload) => {
      if (typeof payload !== "object" || payload === null) return payload;
      const value = payload as Record<string, unknown>;
      return typeof value.success === "boolean" ? { ...value, requestId: request.id } : payload;
    });
    registerComponentRoutes(
      app,
      new ComponentManager({ root: temporaryRoot, catalog: { manifests: [], trustedPublicKeys: {} } })
    );

    await expect(app.inject({ method: "GET", url: "/api/v1/components" })).resolves.toMatchObject({ statusCode: 200 });
    await expect(
      app.inject({ method: "POST", url: "/api/v1/components/edge-tts/install", payload: { url: "https://bad.test" } })
    ).resolves.toMatchObject({ statusCode: 404 });
    await app.close();
  });

  it("starts and exposes an install job through the management API", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-component-routes-"));
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath);
    const app = fastify();
    app.addHook("preSerialization", async (request, _reply, payload) => {
      if (typeof payload !== "object" || payload === null) return payload;
      const value = payload as Record<string, unknown>;
      return typeof value.success === "boolean" ? { ...value, requestId: request.id } : payload;
    });
    registerComponentRoutes(app, manager);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/components/edge-tts/install"
    });
    expect(response.statusCode, response.body).toBe(200);
    const jobId = (response.json() as { data: { id: string } }).data.id;
    await expect(waitForJob(manager, jobId)).resolves.toMatchObject({ state: "completed" });
    await expect(app.inject({ method: "GET", url: "/api/v1/components" })).resolves.toMatchObject({
      statusCode: 200,
      body: expect.stringContaining('"state":"ready"')
    });

    await expect(app.inject({ method: "GET", url: "/api/v1/component-jobs/" + jobId })).resolves.toMatchObject({
      statusCode: 200,
      body: expect.stringContaining('"state":"completed"')
    });
    await expect(
      app.inject({ method: "GET", url: "/api/v1/component-jobs/" + jobId + "/events" })
    ).resolves.toMatchObject({
      statusCode: 200,
      headers: expect.objectContaining({ "content-type": expect.stringContaining("text/event-stream") }),
      body: expect.stringContaining("event: component-job\n")
    });

    const uninstallResponse = await app.inject({
      method: "DELETE",
      url: "/api/v1/components/edge-tts"
    });
    expect(uninstallResponse.statusCode, uninstallResponse.body).toBe(200);
    const uninstallJobId = (uninstallResponse.json() as { data: { id: string } }).data.id;
    await expect(waitForJob(manager, uninstallJobId)).resolves.toMatchObject({
      operation: "uninstall",
      state: "completed"
    });
    await app.close();
  });
});

async function createFixture(
  version: string,
  overrides: {
    archiveSha256?: string;
    signature?: string;
    omitManifestPath?: string;
    id?: string;
    displayName?: string;
    dependencyIds?: string[];
    pythonEnvironment?: boolean;
    license?: ComponentPackageManifest["license"] | null;
  } = {}
) {
  if (!temporaryRoot) temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-component-manager-"));
  const componentId = overrides.id ?? "edge-tts";
  const source = path.join(temporaryRoot, "source-" + componentId + "-" + version);
  const archivePath = path.join(temporaryRoot, componentId + "-" + version + ".tar.gz");
  await fs.mkdir(path.join(source, "bin"), { recursive: true });
  await fs.writeFile(path.join(source, "bin", "runner.exe"), `runner-${version}`);
  await fs.writeFile(path.join(source, "LICENSE"), "MIT");
  const relativeFiles = ["bin/runner.exe", "LICENSE"];
  let pythonEnvironment: ComponentPackageManifest["pythonEnvironment"];
  if (overrides.pythonEnvironment) {
    await fs.mkdir(path.join(source, "wheelhouse"));
    await fs.writeFile(path.join(source, "python.exe"), "signed test interpreter");
    await fs.writeFile(path.join(source, "wheelhouse", "sample.whl"), "wheel");
    const lock = "sample==1.2.3 --hash=sha256:" + "a".repeat(64) + "\n";
    await fs.writeFile(path.join(source, "requirements.lock"), lock);
    relativeFiles.push("python.exe", "wheelhouse/sample.whl", "requirements.lock");
    pythonEnvironment = {
      pythonExecutablePath: "python.exe",
      wheelhousePath: "wheelhouse",
      requirementsLockPath: "requirements.lock",
      requirementsLockSha256: crypto.createHash("sha256").update(lock).digest("hex"),
      expectedPythonVersion: "3.11"
    };
  }
  await tar.c({ gzip: true, file: archivePath, cwd: source }, relativeFiles);

  const allFiles = await Promise.all(
    relativeFiles.map(async (relativePath) => {
      const fullPath = path.join(source, ...relativePath.split("/"));
      const content = await fs.readFile(fullPath);
      return {
        path: relativePath,
        bytes: content.byteLength,
        sha256: crypto.createHash("sha256").update(content).digest("hex")
      };
    })
  );
  const archive = await fs.readFile(archivePath);
  const unsigned = {
    protocolVersion: 1,
    id: componentId,
    moduleId: componentId,
    groupId: "audio" as const,
    displayName: overrides.displayName ?? "Edge TTS",
    purpose: "Fixture component for management tests",
    dependencyIds: overrides.dependencyIds ?? [],
    taskToolIds: [componentId],
    installConditions: [],
    version,
    platform: "win32-x64" as const,
    archive: {
      url: "https://packages.example.test/" + componentId + ".tar.gz",
      bytes: archive.byteLength,
      sha256: overrides.archiveSha256 ?? crypto.createHash("sha256").update(archive).digest("hex"),
      format: "tar.gz" as const
    },
    installedBytes: allFiles.reduce((total, file) => total + file.bytes, 0),
    ...(pythonEnvironment ? { pythonEnvironment } : {}),
    files: allFiles.filter((file) => file.path !== overrides.omitManifestPath),
    ...(overrides.license === null
      ? {}
      : { license: overrides.license ?? { name: "MIT", url: "https://licenses.example.test/mit" } }),
    sbom: { url: "https://packages.example.test/" + componentId + ".sbom.json", sha256: "1".repeat(64) },
    keyId: "test-ed25519"
  };
  const provisional = { ...unsigned, signature: "" } satisfies ComponentPackageManifest;
  const signature =
    overrides.signature ??
    crypto.sign(null, Buffer.from(canonicalManifest(provisional)), keyPair.privateKey).toString("base64");
  return { manifest: { ...unsigned, signature } satisfies ComponentPackageManifest, archivePath };
}

function createManager(
  manifest: ComponentPackageManifest,
  archivePath: string,
  downloadArchive: NonNullable<ComponentManagerOptions["downloadArchive"]> = async (_manifest, destination) =>
    fs.copyFile(archivePath, destination),
  extra: Pick<
    ComponentManagerOptions,
    "availableDiskBytes" | "runPythonProcess" | "onBeforeUninstall" | "onAfterMutation" | "isInUse"
  > = {}
) {
  return new ComponentManager({
    root: path.join(temporaryRoot, "packages"),
    catalog: { manifests: [manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
    downloadArchive,
    ...extra
  });
}

async function waitForJob(manager: ComponentManager, jobId: string) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const job = await manager.getJob(jobId);
    if (job.state === "completed" || job.state === "failed" || job.state === "cancelled") return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Component job did not finish in time");
}

async function waitForPhase(manager: ComponentManager, jobId: string, phase: "downloading") {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const job = await manager.getJob(jobId);
    if (job.phase === phase) return job;
    if (job.state === "failed" || job.state === "cancelled")
      throw new Error("Component job ended before phase " + phase);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Component job did not enter phase " + phase);
}
