/** 中文模块说明：能力包安装的完整性回归测试，验证签名、文件清单和失败不覆盖当前版本。 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import * as tar from "tar";
import fastify from "fastify";
import multipart from "@fastify/multipart";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComponentManager,
  canonicalManifest,
  downloadComponentArchive,
  type ComponentManagerOptions,
  type ComponentPackageManifest
} from "../modules/components/component-manager";
import { registerComponentRoutes } from "../modules/components/routes";
import { createRemoteFetch } from "../security/remote-fetch";

const keyPair = crypto.generateKeyPairSync("ed25519");
const publicKey = keyPair.publicKey.export({ format: "pem", type: "spki" }).toString();
let temporaryRoot = "";

afterEach(async () => {
  if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = "";
  vi.restoreAllMocks();
});

describe("ComponentManager", () => {
  it("immediately replays the current job reference and stops notifications after unsubscribe", async () => {
    const fixture = await createFixture("1.0.0");
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const manager = new ComponentManager({
      root: path.join(temporaryRoot, "packages"),
      platform: "win32-x64",
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      downloadArchive: async (_manifest, destination) => fs.copyFile(fixture.archivePath, destination),
      selfTest: async () => {
        enter();
        await gate;
      }
    });
    const job = await manager.startInstall("edge-tts");
    const updates: Array<Awaited<ReturnType<ComponentManager["getJob"]>>> = [];
    try {
      await entered;
      const unsubscribe = manager.subscribe(job.id, (value) => updates.push(value));
      expect(updates).toHaveLength(1);
      expect(updates[0]).toBe(await manager.getJob(job.id));
      unsubscribe();
    } finally {
      release();
      await waitForJob(manager, job.id);
    }
    expect(updates).toHaveLength(1);
    expect((await manager.getJob(job.id)).state).toBe("completed");
  });

  it("removes a failed fresh self-test generation without publishing current or deleting sibling data", async () => {
    const fixture = await createFixture("1.0.0");
    const root = path.join(temporaryRoot, "packages");
    const sentinel = path.join(root, "other-component", "keep.bin");
    await fs.mkdir(path.dirname(sentinel), { recursive: true });
    await fs.writeFile(sentinel, "keep");
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      downloadArchive: async (_manifest, destination) => fs.copyFile(fixture.archivePath, destination),
      selfTest: async () => {
        throw new Error("injected self-test failure");
      }
    });
    const job = await manager.startInstall("edge-tts");
    expect(await waitForJob(manager, job.id)).toMatchObject({ state: "failed", errorCode: "COMPONENT_INSTALL_FAILED" });
    await expect(fs.access(path.join(root, "edge-tts", "current.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readdir(path.join(root, "edge-tts", "versions"))).toEqual([]);
    expect(await fs.readFile(sentinel, "utf8")).toBe("keep");
  });

  it("does not allow cancellation or publish current while the self-test is still running", async () => {
    const fixture = await createFixture("1.0.0");
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const root = path.join(temporaryRoot, "packages");
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      downloadArchive: async (_manifest, destination) => fs.copyFile(fixture.archivePath, destination),
      selfTest: async () => {
        enter();
        await gate;
      }
    });
    const job = await manager.startInstall("edge-tts");
    try {
      await entered;
      expect(await manager.getJob(job.id)).toMatchObject({ state: "running", phase: "self-test" });
      await expect(manager.cancelJob(job.id)).rejects.toMatchObject({ code: "COMPONENT_JOB_NOT_CANCELLABLE" });
      await expect(fs.access(path.join(root, "edge-tts", "current.json"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      release();
      await waitForJob(manager, job.id);
    }
    expect(await manager.getJob(job.id)).toMatchObject({ state: "completed", phase: "complete" });
  });

  it("rolls back a fresh current marker when the runtime refresh fails with no previous generation", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fixture = await createFixture("1.0.0"),
      calls: string[] = [];
    const manager = createManager(fixture.manifest, fixture.archivePath, undefined, {
      onAfterMutation: async (_id, operation) => {
        calls.push(operation);
        if (operation !== "uninstall") throw new Error("injected refresh failure");
      }
    });
    const job = await manager.startInstall("edge-tts");
    expect(await waitForJob(manager, job.id)).toMatchObject({ state: "failed", errorCode: "COMPONENT_INSTALL_FAILED" });
    const root = path.join(temporaryRoot, "packages", "edge-tts");
    expect(calls).toEqual(["install", "uninstall"]);
    await expect(fs.access(path.join(root, "current.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readdir(path.join(root, "versions"))).toEqual([]);
  });

  it("keeps retired Python hidden on fresh installations and exposes only safe uninstall for old installations", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-retired-python-"));
    const root = path.join(temporaryRoot, "packages");
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [], trustedPublicKeys: {} }
    });
    expect(await manager.list()).toEqual([]);
    await seedCurrent(root, "python-311", "3.11.16-20260901");
    const sentinel = path.join(root, "python-312", "model.bin");
    await fs.mkdir(path.dirname(sentinel), { recursive: true });
    await fs.writeFile(sentinel, "keep new runtime and models");
    expect(await manager.list()).toMatchObject([{ id: "python-311", retired: true, downloadBytes: 0 }]);
    await expect(manager.startInstall("python-311")).rejects.toMatchObject({ code: "COMPONENT_NOT_FOUND" });
    await expect(manager.startReinstall("python-311")).rejects.toMatchObject({ code: "COMPONENT_NOT_FOUND" });
    await expect(manager.getOfflineImportRequirements("python-311")).rejects.toMatchObject({
      code: "COMPONENT_NOT_FOUND"
    });
    const job = await manager.startUninstall("python-311");
    expect((await waitForJob(manager, job.id)).state).toBe("completed");
    expect(await fs.readFile(sentinel, "utf8")).toBe("keep new runtime and models");
    expect(await manager.list()).toEqual([]);
  });

  it.each(["old", "corrupt"])("refuses retired runtime deletion with a %s dependent marker", async (kind) => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-retired-dependent-"));
    const root = path.join(temporaryRoot, "packages");
    await seedCurrent(root, "python-311", "3.11.16-20260901");
    await seedCurrent(root, "image-ai", "1.0.0-cpu2");
    if (kind === "corrupt") await fs.writeFile(path.join(root, "image-ai", "current.json"), "invalid");
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [], trustedPublicKeys: {} }
    });
    expect((await manager.list())[0].dependentIds).toEqual(["image-ai"]);
    const job = await manager.startUninstall("python-311");
    expect(await waitForJob(manager, job.id)).toMatchObject({ state: "failed", errorCode: "COMPONENT_IN_USE" });
    await fs.access(path.join(root, "python-311", "current.json"));
  });

  it("rechecks busy state after the shutdown hook before removing a retired runtime", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-retired-busy-"));
    const root = path.join(temporaryRoot, "packages");
    await seedCurrent(root, "python-311", "3.11.16-20260901");
    let busy = false;
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [], trustedPublicKeys: {} },
      isInUse: async () => busy,
      onBeforeUninstall: async () => {
        busy = true;
      }
    });
    const job = await manager.startUninstall("python-311");
    expect(await waitForJob(manager, job.id)).toMatchObject({ state: "failed", errorCode: "COMPONENT_IN_USE" });
    await fs.access(path.join(root, "python-311", "current.json"));
  });

  it("permits old runtime removal after a dependent matches the trusted Python 3.12 generation", async () => {
    const fixture = await createFixture("7.3.1-py312-1", {
      dependencyIds: ["python-312"],
      pythonEnvironment: "python-312"
    });
    const runtime = await createFixture("3.12.14-20260901", { id: "python-312" });
    fixture.manifest.pythonEnvironment!.expectedPythonVersion = "3.12";
    fixture.manifest.signature = crypto
      .sign(null, Buffer.from(canonicalManifest(fixture.manifest)), keyPair.privateKey)
      .toString("base64");
    const root = path.join(temporaryRoot, "packages");
    await seedCurrent(root, "python-311", "3.11.16-20260901");
    await seedCurrent(root, "edge-tts", fixture.manifest.version);
    const marker = path.join(root, "edge-tts", "current.json");
    const record = JSON.parse(await fs.readFile(marker, "utf8"));
    record.manifestSha256 = crypto.createHash("sha256").update(canonicalManifest(fixture.manifest)).digest("hex");
    await fs.writeFile(marker, JSON.stringify(record));
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [runtime.manifest, fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } }
    });
    expect((await manager.list()).find((item) => item.retired)?.dependentIds).toEqual([]);
    const job = await manager.startUninstall("python-311");
    expect((await waitForJob(manager, job.id)).state).toBe("completed");
    expect(JSON.parse(await fs.readFile(marker, "utf8"))).toEqual(record);
  });

  it("refuses deletion when the fixed legacy directory is a link to another location", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-retired-link-"));
    const root = path.join(temporaryRoot, "packages");
    const externalRoot = path.join(temporaryRoot, "outside");
    await seedCurrent(externalRoot, "python-311", "3.11.16-20260901");
    await fs.mkdir(root);
    await fs.symlink(path.join(externalRoot, "python-311"), path.join(root, "python-311"), "junction");
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [], trustedPublicKeys: {} }
    });
    const job = await manager.startUninstall("python-311");
    expect(await waitForJob(manager, job.id)).toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_MANIFEST_INVALID"
    });
    await fs.access(path.join(externalRoot, "python-311", "current.json"));
  });
  it("diagnoses only signed artifacts, preserves generated files and never switches the current generation", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath);
    const job = await manager.startInstall("edge-tts");
    expect((await waitForJob(manager, job.id)).state).toBe("completed");
    const asset = await manager.resolveInstalledAsset("edge-tts", fixture.manifest.files[0].path);
    await fs.mkdir(path.join(asset.generationRoot, "venv"));
    await fs.writeFile(path.join(asset.generationRoot, "venv", "generated.txt"), "legitimate generated runtime");
    const tester = vi.fn(async () => undefined);
    await manager.verifyCurrent("edge-tts", new AbortController().signal, tester);
    expect(tester).toHaveBeenCalledOnce();
    await fs.writeFile(asset.path, "damaged");
    await expect(manager.verifyCurrent("edge-tts", new AbortController().signal, tester)).rejects.toMatchObject({
      code: "COMPONENT_INSTALL_FAILED"
    });
    expect((await manager.list())[0].installed).toBe(true);
    const aborted = new AbortController();
    aborted.abort();
    await expect(manager.verifyCurrent("edge-tts", aborted.signal)).rejects.toBeDefined();
  });
  it("rejects signed Windows packages before offline import on Apple Silicon", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = new ComponentManager({
      root: path.join(temporaryRoot, "mac-packages"),
      platform: "darwin-arm64",
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      availableDiskBytes: async () => Number.MAX_SAFE_INTEGER
    });

    await expect(manager.getOfflineImportRequirements("edge-tts")).rejects.toMatchObject({
      code: "COMPONENT_MANIFEST_INVALID"
    });
  });

  it("downloads a GitHub Release asset through verified HTTPS redirects and reports exact progress", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "redirected-download.partial");
    const bytes = await fs.readFile(fixture.archivePath);
    const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://release-assets.example/asset.tar.gz" } })
      )
      .mockResolvedValueOnce(
        new Response(bytes, { headers: { "content-length": String(fixture.manifest.archive.bytes) } })
      );
    const remoteFetch = createRemoteFetch({ resolver, fetchImpl, requireHttps: true, maxRedirects: 5 });
    const progress: number[] = [];

    await downloadComponentArchive(
      fixture.manifest,
      destination,
      { onProgress: (downloaded) => progress.push(downloaded) },
      remoteFetch
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await expect(fs.readFile(destination)).resolves.toEqual(bytes);
    expect(progress.at(-1)).toBe(fixture.manifest.archive.bytes);
  });

  it("downloads signed assets in verified byte ranges and retries an interrupted chunk", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "ranged-download.partial");
    const bytes = await fs.readFile(fixture.archivePath);
    const contentRange = `bytes 0-${bytes.length - 1}/${bytes.length}`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(bytes.subarray(0, Math.max(1, Math.floor(bytes.length / 2))), {
          status: 206,
          headers: { "content-range": contentRange }
        })
      )
      .mockResolvedValueOnce(
        new Response(bytes, {
          status: 206,
          headers: { "content-length": String(bytes.length), "content-range": contentRange }
        })
      );
    const remoteFetch = createRemoteFetch({
      resolver: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchImpl,
      requireHttps: true
    });
    const progress: number[] = [];

    await downloadComponentArchive(
      fixture.manifest,
      destination,
      { onProgress: (downloaded) => progress.push(downloaded) },
      remoteFetch
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({ Range: `bytes=0-${bytes.length - 1}` });
    await expect(fs.readFile(destination)).resolves.toEqual(bytes);
    expect(progress).toEqual([bytes.length]);
  });

  it("assembles concurrent ranges at their verified offsets", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "concurrent-ranges.partial");
    // 各分段使用不同内容，互换偏移会真实失败；全 0x5a 无法证明偏移写入正确。
    const rangeBytes = 1024 * 1024;
    const bytes = Buffer.concat([
      Buffer.alloc(rangeBytes, 0x11),
      Buffer.alloc(rangeBytes, 0x22),
      Buffer.alloc(37, 0x33)
    ]);
    const completed: number[] = [];
    fixture.manifest.archive.bytes = bytes.length;
    const fetchImpl = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const range = new Headers(init?.headers).get("range");
      const match = /^bytes=(\d+)-(\d+)$/.exec(range || "");
      if (!match) throw new Error("Range header was not sent");
      const start = Number(match[1]);
      const end = Number(match[2]);
      const body = bytes.subarray(start, end + 1);
      // 第二段延迟，末段先返回，确保覆盖真实并发下的乱序落盘，而非顺序下载。
      if (start === rangeBytes) await new Promise((resolve) => setTimeout(resolve, 20));
      completed.push(start);
      return new Response(body, {
        status: 206,
        headers: {
          "content-length": String(body.length),
          "content-range": `bytes ${start}-${end}/${bytes.length}`
        }
      });
    });
    const remoteFetch = createRemoteFetch({
      resolver: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchImpl,
      requireHttps: true
    });

    await downloadComponentArchive(fixture.manifest, destination, {}, remoteFetch);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(completed).toEqual([0, 2 * rangeBytes, rangeBytes]);
    // Buffer.equals 比较完整二进制内容，不让 JS 深比较数百万索引拖慢覆盖率运行。
    expect((await fs.readFile(destination)).equals(bytes)).toBe(true);
  });

  it("retries transient connection resets before receiving a byte-range response", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "reset-download.partial");
    const bytes = await fs.readFile(fixture.archivePath);
    const fetchFailure = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" })
    });
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(fetchFailure)
      .mockResolvedValueOnce(
        new Response(bytes, {
          status: 206,
          headers: {
            "content-length": String(bytes.length),
            "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}`
          }
        })
      );
    const remoteFetch = createRemoteFetch({
      resolver: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchImpl,
      requireHttps: true
    });

    await downloadComponentArchive(fixture.manifest, destination, {}, remoteFetch);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await expect(fs.readFile(destination)).resolves.toEqual(bytes);
  });

  it("rejects incorrect Content-Range metadata and removes the partial archive", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "invalid-range.partial");
    const bytes = await fs.readFile(fixture.archivePath);
    const remoteFetch = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 206,
        headers: { "content-range": `bytes 1-${bytes.length}/${bytes.length + 1}` }
      })
    );

    await expect(downloadComponentArchive(fixture.manifest, destination, {}, remoteFetch)).rejects.toThrow(
      "能力包分段范围校验失败"
    );
    await expect(fs.access(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps successful ranges and serially recovers exhausted parallel requests, including unclaimed ranges", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "serial-recovery.partial");
    const rangeBytes = 1024 * 1024;
    const bytes = Buffer.concat(Array.from({ length: 7 }, (_, index) => Buffer.alloc(rangeBytes, index + 1)));
    fixture.manifest.archive.bytes = bytes.length;
    const attempts = new Map<number, number>();
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const progress: number[] = [];
    const remoteFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get("range")!)!;
      const start = Number(from),
        end = Number(to);
      const count = (attempts.get(start) ?? 0) + 1;
      attempts.set(start, count);
      if (start > 0 && start <= 4 * rangeBytes && count <= 5) {
        throw Object.assign(new Error("private network output"), { code: "ECONNRESET" });
      }
      return new Response(bytes.subarray(start, end + 1), {
        status: 206,
        headers: { "content-range": `bytes ${start}-${end}/${bytes.length}` }
      });
    });
    await downloadComponentArchive(fixture.manifest, destination, { onProgress: (n) => progress.push(n) }, remoteFetch);
    expect((await fs.readFile(destination)).equals(bytes)).toBe(true);
    expect(attempts.get(0)).toBe(1);
    for (let index = 1; index <= 4; index++) expect(attempts.get(index * rangeBytes)).toBe(6);
    expect(attempts.get(5 * rangeBytes)).toBe(1);
    expect(attempts.get(6 * rangeBytes)).toBe(1);
    expect(progress).toEqual(Array.from({ length: 7 }, (_, index) => (index + 1) * rangeBytes));
    expect(warnings.mock.calls.some(([message]) => message.includes("降为串行补下载"))).toBe(true);
  }, 15000);

  it("retries a body aborted by the request timeout instead of hiding it as a generic read failure", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "body-timeout.partial");
    const bytes = await fs.readFile(fixture.archivePath);
    const timeout = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    timeoutSpy.mockReturnValueOnce(timeout.signal);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let calls = 0;
    const remoteFetch = vi.fn(async () => {
      const body =
        ++calls === 1
          ? new ReadableStream({
              start(controller) {
                timeout.abort(new DOMException("timeout private output", "TimeoutError"));
                controller.error(new DOMException("generic fetch body abort", "AbortError"));
              }
            })
          : bytes;
      return new Response(body, {
        status: 206,
        headers: { "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` }
      });
    });
    await downloadComponentArchive(fixture.manifest, destination, {}, remoteFetch);
    expect(remoteFetch).toHaveBeenCalledTimes(2);
    expect(timeoutSpy).toHaveBeenCalledWith(60000);
    await expect(fs.readFile(destination)).resolves.toEqual(bytes);
  });

  it("never serially retries user cancellation and removes the partial archive", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "cancel-download.partial");
    const abort = new AbortController();
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const total = 3 * 1024 * 1024;
    fixture.manifest.archive.bytes = total;
    const remoteFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(Buffer.alloc(1024 * 1024), {
          status: 206,
          headers: { "content-range": `bytes 0-1048575/${total}` }
        })
      )
      .mockImplementation(async () => {
        abort.abort();
        throw new DOMException("cancelled", "AbortError");
      });
    await expect(
      downloadComponentArchive(fixture.manifest, destination, { signal: abort.signal }, remoteFetch)
    ).rejects.toThrow("download cancelled");
    expect(remoteFetch).toHaveBeenCalledTimes(2);
    expect(warnings).not.toHaveBeenCalled();
    await expect(fs.access(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("bounds repeated body timeouts and retains the timeout code after final failure", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "exhausted-timeout.partial");
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
      AbortSignal.abort(new DOMException("private", "TimeoutError"))
    );
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const remoteFetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new DOMException("generic body abort", "AbortError"));
            }
          }),
          {
            status: 206,
            headers: {
              "content-range": `bytes 0-${fixture.manifest.archive.bytes - 1}/${fixture.manifest.archive.bytes}`
            }
          }
        )
    );
    await expect(downloadComponentArchive(fixture.manifest, destination, {}, remoteFetch)).rejects.toMatchObject({
      code: "ETIMEDOUT"
    });
    expect(remoteFetch).toHaveBeenCalledTimes(5);
    expect(warnings).toHaveBeenCalledTimes(4);
    await expect(fs.access(destination)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15000);

  it("does not downgrade an invalid later range to serial retries", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "invalid-later-range.partial");
    fixture.manifest.archive.bytes = 2 * 1024 * 1024;
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const remoteFetch = vi.fn(
      async () =>
        new Response(Buffer.alloc(1024 * 1024), {
          status: 206,
          headers: { "content-range": `bytes 0-1048575/${fixture.manifest.archive.bytes}` }
        })
    );
    await expect(downloadComponentArchive(fixture.manifest, destination, {}, remoteFetch)).rejects.toThrow(
      "能力包分段范围校验失败"
    );
    expect(remoteFetch).toHaveBeenCalledTimes(2);
    expect(warnings).not.toHaveBeenCalled();
    await expect(fs.access(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retains a safe nested network reason on the failed install job", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath, async () => {
      throw new TypeError("https://user:secret@example.com/?token=private", {
        cause: Object.assign(new Error("C:\\Users\\private 中文文案"), { code: "ECONNRESET" })
      });
    });
    const job = await manager.startInstall("edge-tts");
    const failed = await waitForJob(manager, job.id);
    expect(failed.state).toBe("failed");
    expect(failed.errorMessage).toContain("ECONNRESET");
    expect(failed.errorMessage).not.toMatch(/secret|private|中文文案/);
  });

  it("does not remove a pre-existing destination when exclusive creation fails", async () => {
    const fixture = await createFixture("1.0.0");
    const destination = path.join(temporaryRoot, "existing-download.partial");
    await fs.writeFile(destination, "keep-existing-file");
    const remoteFetch = vi.fn();

    await expect(downloadComponentArchive(fixture.manifest, destination, {}, remoteFetch)).rejects.toMatchObject({
      code: "EEXIST"
    });
    await expect(fs.readFile(destination, "utf8")).resolves.toBe("keep-existing-file");
    expect(remoteFetch).not.toHaveBeenCalled();
  });

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

  it("imports a signed archive from a local stream without making a network request", async () => {
    const fixture = await createFixture("1.0.0");
    const downloadArchive = vi.fn(async () => {
      throw new Error("offline import must not download");
    });
    const manager = createManager(fixture.manifest, fixture.archivePath, downloadArchive);
    const archive = await fs.readFile(fixture.archivePath);
    const progress: Array<[number, number]> = [];
    const job = await manager.startOfflineImport(
      "edge-tts",
      (async function* () {
        yield {
          fieldName: "archives",
          filename: "edge-tts.tar.gz",
          stream: Readable.from([archive])
        };
      })(),
      (uploaded, total) => progress.push([uploaded, total])
    );

    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({ state: "completed" });
    expect(downloadArchive).not.toHaveBeenCalled();
    expect(progress.at(-1)).toEqual([archive.byteLength, archive.byteLength]);
    await expect(manager.list()).resolves.toMatchObject([{ id: "edge-tts", installed: true, health: "healthy" }]);
    await expect(fs.readdir(path.join(temporaryRoot, "packages", "edge-tts", "archives"))).resolves.toEqual([]);
  });

  it("derives a clickable GitHub release page only from trusted signed asset URLs", async () => {
    const fixture = await createFixture("1.0.0");
    fixture.manifest.archive.url =
      "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/edge-tts.tar.gz";
    fixture.manifest.signature = crypto
      .sign(null, Buffer.from(canonicalManifest(fixture.manifest)), keyPair.privateKey)
      .toString("base64");
    const manager = createManager(fixture.manifest, fixture.archivePath);

    await expect(manager.list()).resolves.toMatchObject([
      {
        id: "edge-tts",
        archiveFileNames: ["edge-tts.tar.gz"],
        releasePageUrl: "https://github.com/sunshine-tmy/tool2.0/releases/tag/components-v1"
      }
    ]);
  });

  it("imports every signed archive part by manifest identity even when selected out of order", async () => {
    const fixture = await createFixture("1.0.0");
    const manifest: ComponentPackageManifest = fixture.manifest;
    const source = path.join(temporaryRoot, "offline-model-stage");
    const modelRelativePath = "models/example.bin";
    const modelArchivePath = path.join(temporaryRoot, "offline-model-part.tar.gz");
    await fs.mkdir(path.join(source, "models"), { recursive: true });
    await fs.writeFile(path.join(source, modelRelativePath), "signed model");
    await tar.c({ gzip: true, file: modelArchivePath, cwd: source }, [modelRelativePath]);
    const modelArchive = await fs.readFile(modelArchivePath);
    const modelContent = await fs.readFile(path.join(source, modelRelativePath));
    const modelHash = crypto.createHash("sha256").update(modelContent).digest("hex");

    manifest.archive.filePaths = manifest.files.map((file) => file.path);
    manifest.additionalArchives = [
      {
        url: "https://packages.example.test/edge-tts-1.0.0-model.tar.gz",
        bytes: modelArchive.byteLength,
        sha256: crypto.createHash("sha256").update(modelArchive).digest("hex"),
        format: "tar.gz",
        filePaths: [modelRelativePath]
      }
    ];
    manifest.files.push({ path: modelRelativePath, bytes: modelContent.byteLength, sha256: modelHash });
    manifest.installedBytes += modelContent.byteLength;
    manifest.signature = crypto
      .sign(null, Buffer.from(canonicalManifest(manifest)), keyPair.privateKey)
      .toString("base64");

    const manager = createManager(manifest, fixture.archivePath, async () => {
      throw new Error("offline import must not download");
    });
    const mainArchive = await fs.readFile(fixture.archivePath);
    const job = await manager.startOfflineImport(
      "edge-tts",
      (async function* () {
        yield {
          fieldName: "archives",
          filename: "edge-tts-1.0.0-model.tar.gz",
          stream: Readable.from([modelArchive])
        };
        yield { fieldName: "archives", filename: "edge-tts.tar.gz", stream: Readable.from([mainArchive]) };
      })()
    );

    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({ state: "completed" });
    await expect(
      fs.readFile(
        path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0", "models", "example.bin"),
        "utf8"
      )
    ).resolves.toBe("signed model");
  });

  it("rejects damaged offline archives and removes temporary import files", async () => {
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath);
    const archive = await fs.readFile(fixture.archivePath);
    archive[0] = archive[0]! ^ 0xff;

    await expect(
      manager.startOfflineImport(
        "edge-tts",
        (async function* () {
          yield { fieldName: "archives", filename: "edge-tts.tar.gz", stream: Readable.from([archive]) };
        })()
      )
    ).rejects.toMatchObject({ code: "COMPONENT_IMPORT_INVALID" });
    await expect(manager.list()).resolves.toMatchObject([{ id: "edge-tts", installed: false }]);
    await expect(fs.readdir(path.join(temporaryRoot, "packages", "edge-tts", "archives"))).resolves.toEqual([]);
  });

  it("downloads, verifies and merges every signed archive part before switching the generation", async () => {
    const fixture = await createFixture("1.0.0");
    const manifest: ComponentPackageManifest = fixture.manifest;
    const modelStage = path.join(temporaryRoot, "model-stage");
    const modelRelativePath = "models/chatterbox/t3-model.bin";
    const modelPath = path.join(modelStage, ...modelRelativePath.split("/"));
    const modelArchivePath = path.join(temporaryRoot, "model-part.tar.gz");
    await fs.mkdir(path.dirname(modelPath), { recursive: true });
    await fs.writeFile(modelPath, "signed model bytes");
    await tar.c({ gzip: true, file: modelArchivePath, cwd: modelStage }, [modelRelativePath]);
    const modelArchive = await fs.readFile(modelArchivePath);
    const modelStat = await fs.stat(modelPath);

    manifest.archive.filePaths = manifest.files.map((file) => file.path);
    manifest.files.push({
      path: modelRelativePath,
      bytes: modelStat.size,
      sha256: crypto
        .createHash("sha256")
        .update(await fs.readFile(modelPath))
        .digest("hex")
    });
    manifest.additionalArchives = [
      {
        url: "https://packages.example.test/edge-tts-1.0.0-model.tar.gz",
        bytes: modelArchive.byteLength,
        sha256: crypto.createHash("sha256").update(modelArchive).digest("hex"),
        format: "tar.gz",
        filePaths: [modelRelativePath]
      }
    ];
    manifest.installedBytes += modelStat.size;
    manifest.signature = crypto
      .sign(null, Buffer.from(canonicalManifest(manifest)), keyPair.privateKey)
      .toString("base64");

    const downloadArchive = vi.fn(async (manifest: ComponentPackageManifest, destination: string) => {
      await fs.copyFile(
        manifest.archive.url.endsWith("-model.tar.gz") ? modelArchivePath : fixture.archivePath,
        destination
      );
    });
    const manager = createManager(manifest, fixture.archivePath, downloadArchive);
    await expect(manager.list()).resolves.toMatchObject([
      { id: "edge-tts", downloadBytes: manifest.archive.bytes + modelArchive.byteLength }
    ]);

    await expect(manager.install("edge-tts")).resolves.toMatchObject({ installed: true, health: "healthy" });
    expect(downloadArchive).toHaveBeenCalledTimes(2);
    await expect(
      fs.readFile(
        path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0", ...modelRelativePath.split("/")),
        "utf8"
      )
    ).resolves.toBe("signed model bytes");
  });

  it("verifies and reassembles signed large-file parts before installing the component", async () => {
    const fixture = await createFixture("1.0.0");
    const manifest: ComponentPackageManifest = fixture.manifest;
    const partStage = path.join(temporaryRoot, "wheel-parts-stage");
    const firstPath = "wheelhouse/.parts/torch.whl.part-0001";
    const secondPath = "wheelhouse/.parts/torch.whl.part-0002";
    const firstPart = Buffer.from("verified first half of the CUDA wheel");
    const secondPart = Buffer.from("verified second half of the CUDA wheel");
    const assembledWheel = Buffer.concat([firstPart, secondPart]);
    const partsArchivePath = path.join(temporaryRoot, "wheel-parts.tar.gz");
    await fs.mkdir(path.join(partStage, "wheelhouse", ".parts"), { recursive: true });
    await fs.writeFile(path.join(partStage, ...firstPath.split("/")), firstPart);
    await fs.writeFile(path.join(partStage, ...secondPath.split("/")), secondPart);
    await tar.c({ gzip: true, file: partsArchivePath, cwd: partStage }, [firstPath, secondPath]);
    const partsArchive = await fs.readFile(partsArchivePath);
    const sha256 = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
    manifest.archive.filePaths = manifest.files.map((file) => file.path);
    manifest.additionalArchives = [
      {
        url: "https://packages.example.test/edge-tts-wheel-parts.tar.gz",
        bytes: partsArchive.byteLength,
        sha256: sha256(partsArchive),
        format: "tar.gz",
        filePaths: [firstPath, secondPath]
      }
    ];
    manifest.files.push({ path: "wheelhouse/torch.whl", bytes: assembledWheel.length, sha256: sha256(assembledWheel) });
    manifest.assembledFiles = [
      {
        path: "wheelhouse/torch.whl",
        bytes: assembledWheel.length,
        sha256: sha256(assembledWheel),
        parts: [
          { path: firstPath, bytes: firstPart.length, sha256: sha256(firstPart) },
          { path: secondPath, bytes: secondPart.length, sha256: sha256(secondPart) }
        ]
      }
    ];
    manifest.installedBytes += assembledWheel.length;
    manifest.signature = crypto
      .sign(null, Buffer.from(canonicalManifest(manifest)), keyPair.privateKey)
      .toString("base64");

    const downloadArchive = vi.fn(async (assetManifest: ComponentPackageManifest, destination: string) => {
      await fs.copyFile(
        assetManifest.archive.url.endsWith("wheel-parts.tar.gz") ? partsArchivePath : fixture.archivePath,
        destination
      );
    });
    const manager = createManager(manifest, fixture.archivePath, downloadArchive);

    await expect(manager.install("edge-tts")).resolves.toMatchObject({ installed: true, health: "healthy" });
    const installedRoot = path.join(temporaryRoot, "packages", "edge-tts", "versions", "1.0.0");
    await expect(fs.readFile(path.join(installedRoot, ..."wheelhouse/torch.whl".split("/")))).resolves.toEqual(
      assembledWheel
    );
    await expect(fs.access(path.join(installedRoot, ...firstPath.split("/")))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(manager.resolveInstalledAsset("edge-tts", "wheelhouse/torch.whl")).resolves.toMatchObject({
      path: path.join(installedRoot, "wheelhouse", "torch.whl")
    });
    expect(downloadArchive).toHaveBeenCalledTimes(2);
  });

  it("rejects overlapping archive file partitions before downloading any part", async () => {
    const fixture = await createFixture("1.0.0");
    const manifest: ComponentPackageManifest = fixture.manifest;
    manifest.archive.filePaths = [manifest.files[0]!.path];
    manifest.additionalArchives = [
      {
        url: "https://packages.example.test/edge-tts-1.0.0-other.tar.gz",
        bytes: 10,
        sha256: "1".repeat(64),
        format: "tar.gz",
        filePaths: [manifest.files[0]!.path]
      }
    ];
    manifest.signature = crypto
      .sign(null, Buffer.from(canonicalManifest(manifest)), keyPair.privateKey)
      .toString("base64");
    const downloadArchive = vi.fn(async (_manifest: ComponentPackageManifest, destination: string) => {
      await fs.copyFile(fixture.archivePath, destination);
    });
    const manager = createManager(manifest, fixture.archivePath, downloadArchive);

    await expect(manager.install("edge-tts")).rejects.toMatchObject({ code: "COMPONENT_MANIFEST_INVALID" });
    expect(downloadArchive).not.toHaveBeenCalled();
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
      platform: "win32-x64",
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

  it("restores the previous generation when the installed runtime fails its health check", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fixture = await createFixture("1.0.0");
    const root = path.join(temporaryRoot, "packages");
    await createManager(fixture.manifest, fixture.archivePath).install("edge-tts");
    const currentPath = path.join(root, "edge-tts", "current.json");
    const before = await fs.readFile(currentPath, "utf8");
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: { manifests: [fixture.manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
      downloadArchive: async (_manifest, destination) => fs.copyFile(fixture.archivePath, destination),
      onAfterMutation: async (_componentId, operation) => {
        if (operation !== "uninstall") throw new Error("worker failed health check");
      }
    });

    const job = await manager.startReinstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({
      operation: "reinstall",
      state: "failed",
      errorCode: "COMPONENT_INSTALL_FAILED"
    });
    await expect(fs.readFile(currentPath, "utf8")).resolves.toBe(before);
    await expect(fs.readdir(path.join(root, "edge-tts", "versions"))).resolves.toEqual(["1.0.0"]);
  });

  it("blocks reinstall while its runtime is used by an active task", async () => {
    const fixture = await createFixture("1.0.0");
    const root = path.join(temporaryRoot, "packages");
    await createManager(fixture.manifest, fixture.archivePath).install("edge-tts");
    const refreshRuntime = vi.fn(async () => undefined);
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
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
      platform: "win32-x64",
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
    const pythonUpdates: import("@toolbox/shared").ComponentJob[] = [];
    const unsubscribe = manager.subscribe(job.id, (value) => {
      if (value.phase === "building-python") pythonUpdates.push(value);
    });
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({ state: "completed" });
    expect(calls.length).toBe(5);
    unsubscribe();
    expect(pythonUpdates.some((value) => value.progress.python?.completedSteps === 5)).toBe(true);
    expect(pythonUpdates.every((value) => value.progress.processedFiles === fixture.manifest.files.length)).toBe(true);
    expect(calls.every((call) => call.cwd === path.join(root, "edge-tts", "versions", "1.0.0"))).toBe(true);
    expect(calls[3].args).toContain("--no-index");
    expect(calls[3].args).toContain("--no-cache-dir");
    expect(calls[3].environment?.TEMP).toBe(path.join(root, "edge-tts", "versions", "1.0.0", ".python-build-temp"));
  });

  it("builds a dependent Python environment from its separately signed shared runtime", async () => {
    const runtime = await createFixture("3.11.16-20260901", { id: "python-311" });
    const dependent = await createFixture("7.2.8-1", {
      id: "edge-tts",
      dependencyIds: ["python-311"],
      pythonEnvironment: "python-311"
    });
    const archives = new Map([
      ["python-311", runtime.archivePath],
      ["edge-tts", dependent.archivePath]
    ]);
    const root = path.join(temporaryRoot, "shared-python-packages");
    const calls: Array<{ executable: string; args: string[]; cwd: string }> = [];
    const manager = new ComponentManager({
      root,
      platform: "win32-x64",
      catalog: {
        manifests: [runtime.manifest, dependent.manifest],
        trustedPublicKeys: { "test-ed25519": publicKey }
      },
      downloadArchive: async (manifest, destination) => fs.copyFile(archives.get(manifest.id)!, destination),
      runPythonProcess: async (executable, args, cwd) => {
        calls.push({ executable, args, cwd });
        if (args[0] === "-m" && args[1] === "venv") {
          const scriptsDirectory = path.join(args[2], "Scripts");
          await fs.mkdir(scriptsDirectory, { recursive: true });
          await fs.writeFile(path.join(scriptsDirectory, "python.exe"), "test venv interpreter");
        }
        return args[0] === "-c" ? "3.11\n" : "";
      }
    });

    const blocked = await manager.startInstall("edge-tts");
    await expect(waitForJob(manager, blocked.id)).resolves.toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_DEPENDENCY_MISSING"
    });
    await manager.install("python-311");
    const runtimePython = path.join(root, "python-311", "versions", "3.11.16-20260901", "python", "python.exe");
    const job = await manager.startInstall("edge-tts");
    await expect(waitForJob(manager, job.id)).resolves.toMatchObject({ state: "completed" });
    expect(calls[0]).toMatchObject({
      executable: runtimePython,
      args: ["-c", expect.any(String)],
      cwd: path.join(root, "edge-tts", "versions", "7.2.8-1")
    });
    expect(calls[1].args).toEqual(["-m", "venv", path.join(root, "edge-tts", "versions", "7.2.8-1", "venv")]);
    await expect(manager.resolveInstalledPython("edge-tts")).resolves.toMatchObject({
      path: path.join(root, "edge-tts", "versions", "7.2.8-1", "venv", "Scripts", "python.exe")
    });
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
      platform: "win32-x64",
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
      platform: "win32-x64",
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
      platform: "win32-x64",
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
      new ComponentManager({
        root: temporaryRoot,
        platform: "win32-x64",
        catalog: { manifests: [], trustedPublicKeys: {} }
      })
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

  it("accepts offline archives only when explicitly enabled and applies the signed package size limit", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-component-offline-route-"));
    const fixture = await createFixture("1.0.0");
    const manager = createManager(fixture.manifest, fixture.archivePath, async () => {
      throw new Error("offline route must not download");
    });
    const app = fastify({ bodyLimit: 1 });
    await app.register(multipart);
    app.addHook("preSerialization", async (request, _reply, payload) => {
      if (typeof payload !== "object" || payload === null) return payload;
      const value = payload as Record<string, unknown>;
      return typeof value.success === "boolean" ? { ...value, requestId: request.id } : payload;
    });
    registerComponentRoutes(app, manager, { allowOfflineImport: true });

    const archive = await fs.readFile(fixture.archivePath);
    const boundary = "offline-import-test-boundary";
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="archives"; filename="edge-tts.tar.gz"\r\nContent-Type: application/gzip\r\n\r\n`
      ),
      archive,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/components/edge-tts/offline-import",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload
    });
    expect(response.statusCode, response.body).toBe(200);
    const jobId = (response.json() as { data: { id: string } }).data.id;
    await expect(waitForJob(manager, jobId)).resolves.toMatchObject({ state: "completed" });

    const disabledApp = fastify();
    registerComponentRoutes(disabledApp, manager);
    await expect(
      disabledApp.inject({
        method: "POST",
        url: "/api/v1/components/edge-tts/offline-import",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload
      })
    ).resolves.toMatchObject({ statusCode: 404 });
    await Promise.all([app.close(), disabledApp.close()]);
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
    pythonEnvironment?: boolean | string;
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
  if (componentId === "python-311") {
    await fs.mkdir(path.join(source, "python"), { recursive: true });
    await fs.writeFile(path.join(source, "python", "python.exe"), "signed test interpreter");
    relativeFiles.push("python/python.exe");
  }
  let pythonEnvironment: ComponentPackageManifest["pythonEnvironment"];
  if (overrides.pythonEnvironment) {
    await fs.mkdir(path.join(source, "wheelhouse"));
    const pythonComponentId = typeof overrides.pythonEnvironment === "string" ? overrides.pythonEnvironment : undefined;
    if (!pythonComponentId) {
      await fs.mkdir(path.join(source, "python"), { recursive: true });
      await fs.writeFile(path.join(source, "python", "python.exe"), "signed test interpreter");
    }
    await fs.writeFile(path.join(source, "wheelhouse", "sample.whl"), "wheel");
    const lock = "sample==1.2.3 --hash=sha256:" + "a".repeat(64) + "\n";
    await fs.writeFile(path.join(source, "requirements.lock"), lock);
    if (!pythonComponentId) relativeFiles.push("python/python.exe");
    relativeFiles.push("wheelhouse/sample.whl", "requirements.lock");
    pythonEnvironment = {
      ...(pythonComponentId ? { pythonComponentId } : {}),
      pythonExecutablePath: "python/python.exe",
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
    platform: "win32-x64",
    catalog: { manifests: [manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
    downloadArchive,
    ...extra
  });
}

async function seedCurrent(root: string, id: string, version: string) {
  const directory = path.join(root, id);
  await fs.mkdir(path.join(directory, "versions", version), { recursive: true });
  await fs.writeFile(
    path.join(directory, "current.json"),
    JSON.stringify({
      protocolVersion: 1,
      id,
      version,
      directory: version,
      installedAt: new Date().toISOString(),
      manifestSha256: "a".repeat(64)
    })
  );
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
