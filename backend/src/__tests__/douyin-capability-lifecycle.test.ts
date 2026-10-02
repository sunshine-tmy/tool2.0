/** 签名能力真实生命周期：临时 Ed25519 清单和真实 tar 安装，浏览器执行隔离模拟，保留测试作品与音色。 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import * as tar from "tar";
import type { Page } from "playwright-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ComponentManager,
  canonicalManifest,
  type ComponentPackageManifest
} from "../modules/components/component-manager";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";
import { DouyinRuntimeManager } from "../modules/media-archive/douyin-runtime";

let root: string;
let runtime: DouyinRuntimeManager | undefined;
const keys = crypto.generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ format: "pem", type: "spki" }).toString();
const descriptorPath = new URL("../../../packaging/components/douyin-archive/adapter/manifest.json", import.meta.url);
const workUrl = "https://v.douyin.com/D_DcsZsE5O8/";
const source = {
  platform: "douyin" as const,
  contentId: "7464977705159691570",
  canonicalUrl: "https://www.douyin.com/video/7464977705159691570",
  type: "video" as const,
  title: "测试",
  description: "",
  tags: [],
  author: {},
  media: []
};
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-douyin-capability-"));
  await fs.mkdir(path.join(root, "storage"));
  await fs.writeFile(path.join(root, "storage", "archived-video.mp4"), "historical-media");
  await fs.writeFile(path.join(root, "storage", "permanent-voice.wav"), "permanent-voice");
});
afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-douyin-capability-")
  )
    throw new Error("测试清理路径越界");
  await fs.rm(root, { recursive: true, force: true });
});
const digest = (input: Buffer) => crypto.createHash("sha256").update(input).digest("hex");
async function packageFixture(id: "xhs-browser" | "douyin-archive") {
  const version = id === "xhs-browser" ? "1.63.0-chromium-1243" : "1.0.0-anonymous-27468de";
  const relative = id === "xhs-browser" ? "browser/chrome.exe" : "adapter/manifest.json";
  const bytes = id === "xhs-browser" ? Buffer.from("isolated-test-browser") : await fs.readFile(descriptorPath);
  const stage = path.join(root, "stage", id);
  await fs.mkdir(path.join(stage, path.dirname(relative)), { recursive: true });
  await fs.writeFile(path.join(stage, relative), bytes);
  const archive = path.join(root, id + ".tar.gz");
  await tar.c({ cwd: stage, file: archive, gzip: true, portable: true, mtime: new Date(0) }, [relative]);
  const archiveBytes = await fs.readFile(archive);
  const manifest: ComponentPackageManifest = {
    protocolVersion: 1,
    id,
    moduleId: id,
    version,
    groupId: "archive",
    displayName: id,
    purpose: "隔离生命周期验收",
    platform: "win32-x64",
    dependencyIds: id === "douyin-archive" ? ["xhs-browser"] : [],
    taskToolIds: id === "douyin-archive" ? ["xhs-archive"] : [],
    installConditions: ["测试专用"],
    archive: {
      url: `https://component.example/${id}.tar.gz`,
      bytes: archiveBytes.length,
      sha256: digest(archiveBytes),
      format: "tar.gz"
    },
    files: [{ path: relative, bytes: bytes.length, sha256: digest(bytes) }],
    installedBytes: bytes.length,
    sbom: { url: `https://component.example/${id}.spdx.json`, sha256: "a".repeat(64) },
    keyId: "test-ed25519",
    signature: ""
  };
  manifest.signature = crypto.sign(null, Buffer.from(canonicalManifest(manifest)), keys.privateKey).toString("base64");
  return { manifest, archive };
}
async function setup() {
  const fixtures = await Promise.all([packageFixture("xhs-browser"), packageFixture("douyin-archive")]);
  const close = vi.fn(async () => undefined);
  const openBrowser = vi.fn(async () => ({
    context: { newPage: async () => ({}) as Page },
    browserVersion: "153.0.8010.12",
    close,
    networkStatus: vi.fn()
  })) as unknown as NonNullable<ConstructorParameters<typeof DouyinRuntimeManager>[1]>["openBrowser"] &
    ReturnType<typeof vi.fn>;
  const readWork = vi.fn(async (_page: Page, _input: string, _options: { signal?: AbortSignal } = {}) => ({
    source,
    via: "normal-browser-ssr" as const
  }));
  const manager = new ComponentManager({
    root: path.join(root, "packages"),
    platform: "win32-x64",
    catalog: {
      manifests: fixtures.map((fixture) => fixture.manifest),
      trustedPublicKeys: { "test-ed25519": publicKey }
    },
    availableDiskBytes: async () => Number.MAX_SAFE_INTEGER,
    downloadArchive: async (manifest, destination) => {
      await fs.copyFile(fixtures.find((fixture) => fixture.manifest.id === manifest.id)!.archive, destination);
    },
    selfTest: createDesktopComponentSelfTest(async () => "<html>isolated browser self-test</html>"),
    isInUse: (id) => ["xhs-browser", "douyin-archive"].includes(id) && Boolean(runtime?.isActive()),
    onBeforeUninstall: async () => runtime?.stop()
  });
  runtime = new DouyinRuntimeManager(manager, { platform: "win32", arch: "x64", openBrowser, readWork });
  return { manager, runtime, openBrowser, readWork, close };
}
async function completed(manager: ComponentManager, job: Awaited<ReturnType<ComponentManager["startReinstall"]>>) {
  return vi.waitFor(
    async () => {
      const state = await manager.getJob(job.id);
      expect(["completed", "failed", "cancelled"]).toContain(state.state);
      return state;
    },
    { timeout: 3000 }
  );
}

describe("抖音能力安装与资产生命周期", () => {
  it("真实签名安装依赖、获取、重装、卸载均不修改历史媒体和永久音色", async () => {
    const f = await setup();
    await expect(f.manager.install("douyin-archive")).rejects.toMatchObject({ code: "COMPONENT_DEPENDENCY_MISSING" });
    expect(await f.runtime.status()).toMatchObject({ available: false, state: "not-installed" });
    await f.manager.install("xhs-browser");
    await f.manager.install("douyin-archive");
    expect(await f.runtime.status()).toMatchObject({ available: true, state: "ready" });
    expect(await f.runtime.extract(workUrl)).toMatchObject({ source });
    expect(f.close).toHaveBeenCalledOnce();
    expect(await completed(f.manager, await f.manager.startReinstall("douyin-archive"))).toMatchObject({
      state: "completed"
    });
    expect(await f.runtime.status()).toMatchObject({ available: true });
    expect(await completed(f.manager, await f.manager.startUninstall("xhs-browser"))).toMatchObject({
      state: "failed",
      errorCode: "COMPONENT_IN_USE"
    });
    expect(await completed(f.manager, await f.manager.startUninstall("douyin-archive"))).toMatchObject({
      state: "completed"
    });
    expect(await f.runtime.status()).toMatchObject({ state: "not-installed" });
    expect(await completed(f.manager, await f.manager.startUninstall("xhs-browser"))).toMatchObject({
      state: "completed"
    });
    expect(await fs.readFile(path.join(root, "storage", "archived-video.mp4"), "utf8")).toBe("historical-media");
    expect(await fs.readFile(path.join(root, "storage", "permanent-voice.wav"), "utf8")).toBe("permanent-voice");
  });

  it("网页首次获取按依赖顺序自动安装受信任组件并报告进度", async () => {
    const f = await setup();
    runtime = new DouyinRuntimeManager(f.manager, {
      platform: "win32",
      arch: "x64",
      installationMode: "automatic",
      installTimeoutMs: 30_000,
      openBrowser: f.openBrowser,
      readWork: f.readWork
    });
    const progress: Array<[number, string]> = [];
    expect(await runtime.status()).toMatchObject({
      available: false,
      state: "not-installed",
      installMode: "automatic"
    });
    expect(
      await runtime.extract(workUrl, { onInstallProgress: (value, message) => progress.push([value, message]) })
    ).toMatchObject({
      source
    });
    expect(await f.manager.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "xhs-browser", installed: true }),
        expect.objectContaining({ id: "douyin-archive", installed: true })
      ])
    );
    expect(progress.some(([value]) => value >= 3)).toBe(true);
    expect(progress.at(-1)?.[0]).toBe(28);
    expect(await runtime.status()).toMatchObject({ available: true, installMode: "automatic" });
  });

  it("损坏的描述文件阻止启动，重装受信任包后恢复且保留原 generation", async () => {
    const f = await setup();
    await f.manager.install("xhs-browser");
    await f.manager.install("douyin-archive");
    const oldAsset = await f.manager.resolveInstalledAsset("douyin-archive", "adapter/manifest.json");
    await fs.writeFile(oldAsset.path, "corrupted");
    expect(await f.runtime.status()).toMatchObject({ available: false, errorCode: "DOUYIN_COMPONENT_UNAVAILABLE" });
    await expect(f.runtime.extract(workUrl)).rejects.toMatchObject({ code: "DOUYIN_COMPONENT_UNAVAILABLE" });
    expect(f.openBrowser).not.toHaveBeenCalled();
    expect(await completed(f.manager, await f.manager.startReinstall("douyin-archive"))).toMatchObject({
      state: "completed"
    });
    const repaired = await f.manager.resolveInstalledAsset("douyin-archive", "adapter/manifest.json");
    expect(repaired.generationRoot).not.toBe(oldAsset.generationRoot);
    expect(await fs.readFile(repaired.path)).toEqual(await fs.readFile(descriptorPath));
    expect(await fs.readFile(oldAsset.path, "utf8")).toBe("corrupted");
    expect(await f.runtime.status()).toMatchObject({ available: true });
  });

  it("获取占用期间阻止共享浏览器和适配器重装/卸载；取消后释放占用", async () => {
    const f = await setup();
    await f.manager.install("xhs-browser");
    await f.manager.install("douyin-archive");
    f.readWork.mockImplementationOnce(
      async (_page, _input, { signal } = {}) =>
        new Promise((_resolve, reject) =>
          signal!.addEventListener("abort", () => reject(signal!.reason), { once: true })
        )
    );
    const pending = f.runtime.extract(workUrl);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(f.readWork).toHaveBeenCalledOnce());
    try {
      for (const id of ["xhs-browser", "douyin-archive"]) {
        expect(await completed(f.manager, await f.manager.startReinstall(id))).toMatchObject({
          state: "failed",
          errorCode: "COMPONENT_IN_USE"
        });
        // 浏览器有已安装依赖者时优先拒绝依赖删除，适配器由运行占用拒绝。
        expect(await completed(f.manager, await f.manager.startUninstall(id))).toMatchObject({
          state: "failed",
          errorCode: "COMPONENT_IN_USE"
        });
      }
    } finally {
      await f.runtime.stop();
      await assertion;
    }
    expect(await completed(f.manager, await f.manager.startReinstall("douyin-archive"))).toMatchObject({
      state: "completed"
    });
    expect(f.runtime.isActive()).toBe(false);
  });
});
