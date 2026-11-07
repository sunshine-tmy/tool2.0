/** Real synthetic signatures and ZIP files exercise an installed snapshot roundtrip without user packages or private keys. */
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import nodeFs from "node:fs";
import * as tar from "tar";
import * as yauzl from "yauzl";
import { ZipArchive } from "archiver";
import fastify from "fastify";
import multipart from "@fastify/multipart";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ComponentManager,
  canonicalManifest,
  type ComponentPackageManifest
} from "../modules/components/component-manager";
import { extractComponentBundle, bundleMetadata } from "../modules/components/offline-bundle";
import { registerComponentRoutes } from "../modules/components/routes";
import * as python from "../modules/components/python-environment";
import { startDesktopLanGateway } from "../runtime/desktop-lan-gateway";
async function readArchiveZip(buffer: Buffer) {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, value) => (error ? reject(error) : resolve(value!)))
  );
  const result = new Map<string, Buffer>();
  await new Promise<void>((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", (entry: yauzl.Entry) => {
      zip.openReadStream(entry, async (error, stream) => {
        if (error || !stream) return reject(error);
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of stream) chunks.push(Buffer.from(chunk));
          result.set(entry.fileName, Buffer.concat(chunks));
          zip.readEntry();
        } catch (cause) {
          reject(cause);
        }
      });
    });
    zip.readEntry();
  });
  return result;
}

let root: string;
const hash = (bytes: string | Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
const keys = crypto.generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ format: "pem", type: "spki" }).toString();
const sign = (m: ComponentPackageManifest) => {
  m.signature = crypto.sign(null, Buffer.from(canonicalManifest(m)), keys.privateKey).toString("base64");
  return m;
};
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-component-bundle-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-component-bundle-"))
    throw new Error("测试清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
async function fixture(platform: "win32-x64" | "darwin-arm64" = "win32-x64") {
  const archives = new Map<string, string>();
  async function make(id: string, files: Record<string, string>, deps: string[] = []) {
    const directory = path.join(root, `input-${id}`);
    await fs.mkdir(directory);
    for (const [name, value] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(directory, name)), { recursive: true });
      await fs.writeFile(path.join(directory, name), value, { mode: 0o755 });
    }
    const archive = path.join(root, `${id}.tar.gz`);
    await tar.c({ cwd: directory, file: archive, gzip: true }, Object.keys(files));
    archives.set(id, archive);
    const bytes = await fs.readFile(archive);
    return sign({
      protocolVersion: 1,
      id,
      moduleId: id,
      groupId: "shared",
      displayName: id,
      purpose: "fixture",
      dependencyIds: deps,
      taskToolIds: [],
      installConditions: [],
      version: "1.0.0",
      platform,
      archive: { url: `https://example.test/${id}.tar.gz`, bytes: bytes.length, sha256: hash(bytes), format: "tar.gz" },
      installedBytes: 1024,
      files: Object.entries(files).map(([name, value]) => ({
        path: name,
        bytes: Buffer.byteLength(value),
        sha256: hash(value)
      })),
      sbom: { url: "https://example.test/sbom.json", sha256: "a".repeat(64) },
      keyId: "test",
      signature: ""
    });
  }
  const base = await make("python-312", {
    "bin/python": "signed-python",
    LICENSE: "python-license",
    "lib/cache.py": "signed-source",
    "lib/__pycache__/cache.cpython-312.pyc": "signed-bytecode"
  });
  const engine = await make(
    "edge-tts",
    {
      "worker.py": "signed-worker",
      "vendor/__pycache__/worker.cpython-312.pyc": "signed-worker-cache",
      "wheelhouse/package.whl": "signed-wheel",
      "requirements.lock": "signed-lock",
      "model.bin": "part-onepart-two"
    },
    [base.id]
  );
  // Release archives contain model parts; installed generations only retain the assembled model.
  const engineSource = path.join(root, "input-edge-tts");
  const parts = ["part-one", "part-two"].map((content, index) => ({
    path: `model.part${index}`,
    bytes: content.length,
    sha256: hash(content)
  }));
  await fs.writeFile(path.join(engineSource, parts[0].path), "part-one");
  await fs.writeFile(path.join(engineSource, parts[1].path), "part-two");
  const archiveNames = [
    ...engine.files.filter((file) => file.path !== "model.bin").map((file) => file.path),
    ...parts.map((part) => part.path)
  ];
  await tar.c({ cwd: engineSource, file: archives.get(engine.id)!, gzip: true }, archiveNames);
  const splitArchive = await fs.readFile(archives.get(engine.id)!);
  engine.archive = {
    ...engine.archive,
    bytes: splitArchive.length,
    sha256: hash(splitArchive),
    filePaths: archiveNames
  };
  engine.assembledFiles = [{ path: "model.bin", bytes: 16, sha256: hash("part-onepart-two"), parts }];
  engine.pythonEnvironment = {
    pythonComponentId: base.id,
    pythonExecutablePath: "bin/python",
    wheelhousePath: "wheelhouse",
    requirementsLockPath: "requirements.lock",
    requirementsLockSha256: hash("signed-lock"),
    expectedPythonVersion: "3.12"
  };
  sign(engine);
  const manifests = [base, engine],
    catalog = { manifests, trustedPublicKeys: { test: publicKey } };
  const build = vi.spyOn(python, "buildPythonEnvironment").mockImplementation(async (options) => {
    const environmentDirectory = path.join(options.packageRoot, "venv");
    await fs.mkdir(environmentDirectory);
    await fs.writeFile(path.join(environmentDirectory, "generated.pyc"), "not-exported");
    return {
      environmentDirectory,
      pythonExecutable: path.join(environmentDirectory, "python.exe"),
      pythonVersion: options.expectedPythonVersion
    };
  });
  const download = vi.fn(async (m: ComponentPackageManifest, destination: string) =>
    fs.copyFile(archives.get(m.id)!, destination)
  );
  const sourceRoot = path.join(root, "source");
  const manager = new ComponentManager({ root: sourceRoot, catalog, platform, downloadArchive: download });
  await manager.install(base.id);
  await manager.install(engine.id);
  const exported = await manager.createOfflineExport(engine.id, new AbortController().signal);
  const file = path.join(root, exported.filename);
  await pipeline(exported.stream, nodeFs.createWriteStream(file));
  return { manager, manifests, catalog, file, build, sourceRoot, download, platform };
}
async function* upload(file: string) {
  yield { fieldName: "bundle", filename: path.basename(file), stream: nodeFs.createReadStream(file) };
}
async function done(manager: ComponentManager, id: string) {
  await vi.waitFor(
    async () => expect(["completed", "failed", "cancelled"]).toContain((await manager.getJob(id)).state),
    { timeout: 3000 }
  );
  return manager.getJob(id);
}

it.each(["win32-x64", "darwin-arm64"] as const)(
  "%s 导出依赖及签名文件，空设备导入无需网络并重建 Python 环境",
  async (platform) => {
    const f = await fixture(platform);
    const entries = await readArchiveZip(await fs.readFile(f.file));
    expect([...entries.keys()]).toContain("packages/python-312/bin/python");
    expect([...entries.keys()]).toContain("packages/edge-tts/model.bin");
    expect([...entries.keys()].some((name) => name.includes("venv"))).toBe(false);
    const offline = vi.fn(async () => {
      throw new Error("network must not run");
    });
    const targetRoot = path.join(root, "target");
    const target = new ComponentManager({ root: targetRoot, platform, catalog: f.catalog, downloadArchive: offline });
    const job = await target.startOfflineBundleImport("edge-tts", upload(f.file));
    expect(await done(target, job.id)).toMatchObject({ state: "completed" });
    expect((await target.list()).every((entry) => entry.installed && entry.health === "healthy")).toBe(true);
    expect(offline).not.toHaveBeenCalled();
    expect(f.build).toHaveBeenCalledTimes(2);
    expect(await fs.readFile(path.join(targetRoot, "edge-tts/versions/1.0.0/model.bin"), "utf8")).toBe(
      "part-onepart-two"
    );
    expect(await fs.readFile(path.join(targetRoot, "edge-tts/versions/1.0.0/venv/generated.pyc"), "utf8")).toBe(
      "not-exported"
    );
  }
);

async function mutated(
  f: Awaited<ReturnType<typeof fixture>>,
  change: (entries: Map<string, Buffer>) => void,
  mode?: number
) {
  const entries = await readArchiveZip(await fs.readFile(f.file));
  change(entries);
  const target = path.join(root, crypto.randomUUID() + ".toolbox-capabilities.zip");
  const zip = new ZipArchive({ zlib: { level: 0 } });
  const writing = pipeline(zip, nodeFs.createWriteStream(target));
  for (const [name, bytes] of entries) {
    if (mode && name === "packages/edge-tts/worker.py") zip.symlink(name, bytes.toString());
    else zip.append(bytes, { name });
  }
  await zip.finalize();
  await writing;
  return target;
}
it("恢复运行后变化的 Python 缓存，仅导出原始签名字节，原安装不变且目标可离线导入", async () => {
  const f = await fixture();
  const cache = path.join(f.sourceRoot, "python-312/versions/1.0.0/lib/__pycache__/cache.cpython-312.pyc");
  await fs.writeFile(cache, "runtime-recompiled-cache");
  f.download.mockClear();
  const exported = await f.manager.createOfflineExport("edge-tts", new AbortController().signal);
  const file = path.join(root, "recovered.toolbox-capabilities.zip");
  await pipeline(exported.stream, nodeFs.createWriteStream(file));
  const entries = await readArchiveZip(await fs.readFile(file));
  expect(entries.get("packages/python-312/lib/__pycache__/cache.cpython-312.pyc")?.toString()).toBe("signed-bytecode");
  expect(await fs.readFile(cache, "utf8")).toBe("runtime-recompiled-cache");
  expect(f.download).toHaveBeenCalledTimes(1);
  const offline = vi.fn(async () => {
    throw new Error("no network");
  });
  const target = new ComponentManager({
    root: path.join(root, "recovered-target"),
    catalog: f.catalog,
    platform: f.platform,
    downloadArchive: offline
  });
  const job = await target.startOfflineBundleImport("edge-tts", upload(file));
  expect(await done(target, job.id)).toMatchObject({ state: "completed" });
  expect(offline).not.toHaveBeenCalled();
  await vi.waitFor(async () => expect(await fs.readdir(path.join(f.sourceRoot, "python-312/archives"))).toEqual([]));
});
it("业务包缓存变化也恢复原始字节，取消恢复不会保留临时文件或能力锁", async () => {
  const f = await fixture();
  const cache = path.join(f.sourceRoot, "edge-tts/versions/1.0.0/vendor/__pycache__/worker.cpython-312.pyc");
  await fs.writeFile(cache, "runtime-cache");
  f.download.mockClear();
  const exported = await f.manager.createOfflineExport("edge-tts", new AbortController().signal);
  const file = path.join(root, "vendor-cache.zip");
  await pipeline(exported.stream, nodeFs.createWriteStream(file));
  expect(
    (await readArchiveZip(await fs.readFile(file)))
      .get("packages/edge-tts/vendor/__pycache__/worker.cpython-312.pyc")
      ?.toString()
  ).toBe("signed-worker-cache");
  expect(f.download).toHaveBeenCalledTimes(1);
  const controller = new AbortController();
  f.download.mockImplementationOnce(async () => {
    controller.abort();
    throw new Error("cancelled");
  });
  await expect(f.manager.createOfflineExport("edge-tts", controller.signal)).rejects.toBeDefined();
  expect(f.manager.hasActiveJobs()).toBe(false);
  await vi.waitFor(async () => expect(await fs.readdir(path.join(f.sourceRoot, "edge-tts/archives"))).toEqual([]));
  expect(await fs.readFile(cache, "utf8")).toBe("runtime-cache");
});
it("恢复缓存时拒绝被篡改原始归档，释放锁和临时文件，源码变更仍拒绝导出", async () => {
  const f = await fixture();
  const runtime = path.join(f.sourceRoot, "python-312/versions/1.0.0");
  await fs.writeFile(path.join(runtime, "lib/__pycache__/cache.cpython-312.pyc"), "changed");
  f.download.mockImplementationOnce(async (_m, destination) => {
    await fs.writeFile(destination, "corrupt");
  });
  await expect(f.manager.createOfflineExport("edge-tts", new AbortController().signal)).rejects.toThrow(
    "恢复原始签名缓存失败"
  );
  expect(f.manager.hasActiveJobs()).toBe(false);
  expect(await fs.readdir(path.join(f.sourceRoot, "python-312/archives"))).toEqual([]);
  await fs.writeFile(path.join(runtime, "lib/cache.py"), "tampered-source");
  const exported = await f.manager.createOfflineExport("edge-tts", new AbortController().signal);
  await expect(
    pipeline(exported.stream, nodeFs.createWriteStream(path.join(root, "invalid.zip")))
  ).rejects.toBeDefined();
});
it.each(["tampered", "extra", "missing", "wrong-version", "wrong-platform", "link"])(
  "拒绝 %s，不切换任何已安装代，也不联网",
  async (mode) => {
    const f = await fixture();
    const file = await mutated(
      f,
      (entries) => {
        if (mode === "tampered") entries.set("packages/edge-tts/worker.py", Buffer.from("broken-worker"));
        if (mode === "extra") entries.set("packages/edge-tts/secret.txt", Buffer.from("private"));
        if (mode === "missing") entries.delete("packages/python-312/LICENSE");
        if (mode === "wrong-version" || mode === "wrong-platform") {
          const info = JSON.parse(entries.get("bundle.json")!.toString());
          info.components[0][mode === "wrong-version" ? "version" : "platform"] =
            mode === "wrong-version" ? "9.0.0" : "darwin-arm64";
          entries.set("bundle.json", Buffer.from(JSON.stringify(info)));
        }
      },
      mode === "link" ? 0o120777 : undefined
    );
    const before = await fs.readFile(path.join(f.sourceRoot, "edge-tts/current.json"), "utf8");
    await expect(f.manager.startOfflineBundleImport("edge-tts", upload(file))).rejects.toMatchObject({
      code: "COMPONENT_IMPORT_INVALID"
    });
    expect(await fs.readFile(path.join(f.sourceRoot, "edge-tts/current.json"), "utf8")).toBe(before);
    expect(f.manager.hasActiveJobs()).toBe(false);
  }
);

it("导出拒绝变更文件、旧版本及目录链接，不修改当前代；传输中阻止卸载", async () => {
  const f = await fixture();
  const active = await f.manager.createOfflineExport("edge-tts", new AbortController().signal);
  await expect(f.manager.startUninstall("edge-tts")).rejects.toMatchObject({ code: "COMPONENT_OPERATION_CONFLICT" });
  active.stream.destroy();
  await vi.waitFor(() => expect(f.manager.hasActiveJobs()).toBe(false));
  await fs.writeFile(path.join(f.sourceRoot, "edge-tts/versions/1.0.0/worker.py"), "modified");
  const exported = await f.manager.createOfflineExport("edge-tts", new AbortController().signal);
  await expect(pipeline(exported.stream, nodeFs.createWriteStream(path.join(root, "bad.zip")))).rejects.toBeDefined();
  const currentPath = path.join(f.sourceRoot, "edge-tts/current.json"),
    current = JSON.parse(await fs.readFile(currentPath, "utf8"));
  current.version = "0.9.0";
  await fs.writeFile(currentPath, JSON.stringify(current));
  await expect(f.manager.createOfflineExport("edge-tts", new AbortController().signal)).rejects.toMatchObject({
    code: "COMPONENT_MANIFEST_INVALID"
  });
});

it("依赖缺失、错误签名、磁盘不足及错误卡片均不能导入导出", async () => {
  const f = await fixture();
  const noSpace = new ComponentManager({
    root: path.join(root, "no-space"),
    catalog: f.catalog,
    platform: f.platform,
    availableDiskBytes: async () => 0
  });
  await expect(noSpace.startOfflineBundleImport("edge-tts", upload(f.file))).rejects.toMatchObject({
    code: "COMPONENT_DISK_SPACE_LOW"
  });
  await expect(f.manager.startOfflineBundleImport("python-312", upload(f.file))).rejects.toMatchObject({
    code: "COMPONENT_IMPORT_INVALID"
  });
  const bad = structuredClone(f.catalog);
  bad.manifests[1].signature = "bad";
  await expect(
    new ComponentManager({
      root: path.join(root, "bad-signature"),
      catalog: bad,
      platform: f.platform
    }).createOfflineExport("edge-tts", new AbortController().signal)
  ).rejects.toMatchObject({ code: "COMPONENT_MANIFEST_INVALID" });
  await expect(noSpace.createOfflineExport("edge-tts", new AbortController().signal)).rejects.toMatchObject({
    code: "COMPONENT_NOT_INSTALLED"
  });
});

it("备份包校验结束前不会解包未声明路径，也不接受业务数据 ZIP", async () => {
  const f = await fixture();
  const file = await mutated(f, (entries) => {
    entries.clear();
    entries.set("bundle.json", Buffer.from(bundleMetadata("edge-tts", f.manifests)));
    entries.set("outside.txt", Buffer.from("unsafe"));
  });
  await expect(
    extractComponentBundle(file, path.join(root, "extracted"), "edge-tts", f.manifests)
  ).rejects.toMatchObject({ code: "COMPONENT_IMPORT_INVALID" });
  await expect(fs.access(path.join(root, "extracted"))).rejects.toBeDefined();
});

it("HTTP 导出仅向桌面开放，返回可导入的流式 ZIP，原 tar.gz 入口仍保留", async () => {
  const f = await fixture();
  const app = fastify();
  await app.register(multipart);
  registerComponentRoutes(app, f.manager, { allowOfflineImport: true });
  const response = await app.inject({ method: "POST", url: "/api/v1/components/edge-tts/offline-export" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toContain("application/zip");
  expect((await readArchiveZip(response.rawPayload)).has("packages/edge-tts/worker.py")).toBe(true);
  await app.close();
  const web = fastify();
  registerComponentRoutes(web, f.manager);
  expect((await web.inject({ method: "POST", url: "/api/v1/components/edge-tts/offline-export" })).statusCode).toBe(
    404
  );
  await web.close();
});

it("HTTP multipart 导入导出的备份包，并拒绝非备份请求", async () => {
  const f = await fixture();
  const target = new ComponentManager({
    root: path.join(root, "http-target"),
    catalog: f.catalog,
    platform: f.platform,
    downloadArchive: async () => {
      throw new Error("no network");
    }
  });
  const app = fastify();
  try {
    app.addHook("preSerialization", async (request, _reply, payload) => {
      const value = payload as { success?: boolean };
      return typeof value?.success === "boolean" ? { ...value, requestId: request.id } : payload;
    });
    await app.register(multipart);
    registerComponentRoutes(app, target, { allowOfflineImport: true });
    const url = "/api/v1/components/edge-tts/offline-bundle-import";
    expect((await app.inject({ method: "POST", url, payload: {} })).statusCode).toBe(422);
    const payload = Buffer.concat([
      Buffer.from(
        `--fixture\r\nContent-Disposition: form-data; name="bundle"; filename="${path.basename(f.file)}"\r\nContent-Type: application/zip\r\n\r\n`
      ),
      await fs.readFile(f.file),
      Buffer.from("\r\n--fixture--\r\n")
    ]);
    const response = await app.inject({
      method: "POST",
      url,
      headers: { "content-type": "multipart/form-data; boundary=fixture" },
      payload: Readable.from([payload])
    });
    await vi.waitFor(() => expect(target.hasActiveJobs()).toBe(false));
    expect(response.statusCode, response.body).toBe(200);
    expect(await done(target, response.json().data.id)).toMatchObject({ state: "completed" });
  } finally {
    await app.close();
  }
});

it("依赖自检失败时保留原代，阻止后续安装并释放占用", async () => {
  const f = await fixture();
  const target = new ComponentManager({
    root: f.sourceRoot,
    catalog: f.catalog,
    platform: f.platform,
    selfTest: async () => {
      throw new Error("self-test failed");
    }
  });
  const before = await fs.readFile(path.join(f.sourceRoot, "python-312/current.json"), "utf8");
  const job = await target.startOfflineBundleImport("edge-tts", upload(f.file));
  expect(await done(target, job.id)).toMatchObject({ state: "failed", errorCode: "COMPONENT_DEPENDENCY_MISSING" });
  expect(await fs.readFile(path.join(f.sourceRoot, "python-312/current.json"), "utf8")).toBe(before);
  expect(target.hasActiveJobs()).toBe(false);
});

it("取消导出释放互斥，并拒绝正在使用能力的导入", async () => {
  const f = await fixture();
  const controller = new AbortController();
  const exported = await f.manager.createOfflineExport("edge-tts", controller.signal);
  const copying = pipeline(exported.stream, nodeFs.createWriteStream(path.join(root, "cancelled.zip")));
  controller.abort();
  await expect(copying).rejects.toBeDefined();
  await vi.waitFor(() => expect(f.manager.hasActiveJobs()).toBe(false));
  const busy = new ComponentManager({
    root: f.sourceRoot,
    catalog: f.catalog,
    platform: f.platform,
    isInUse: async () => true
  });
  await expect(busy.startOfflineBundleImport("edge-tts", upload(f.file))).rejects.toMatchObject({
    code: "COMPONENT_IN_USE"
  });
  expect(busy.hasActiveJobs()).toBe(false);
});

it("局域网网关不开放能力导入导出", async () => {
  const upstream = http.createServer((_request, response) => {
    response.end("must not reach");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("invalid test address");
  const gateway = await startDesktopLanGateway(`http://127.0.0.1:${address.port}`, 0);
  try {
    for (const operation of ["offline-export", "offline-bundle-import", "offline-import"]) {
      expect(
        (await fetch(`http://127.0.0.1:${gateway.port}/api/v1/components/edge-tts/${operation}`, { method: "POST" }))
          .status
      ).toBe(404);
    }
  } finally {
    await gateway.close();
    await new Promise<void>((resolve, reject) => upstream.close((error) => (error ? reject(error) : resolve())));
  }
});

it("导出拒绝签名文件路径中途的目录链接", async () => {
  const f = await fixture();
  const wheelhouse = path.join(f.sourceRoot, "edge-tts/versions/1.0.0/wheelhouse");
  const other = path.join(root, "other-wheelhouse");
  await fs.rename(wheelhouse, other);
  await fs.symlink(other, wheelhouse, "junction");
  const exported = await f.manager.createOfflineExport("edge-tts", new AbortController().signal);
  await expect(pipeline(exported.stream, nodeFs.createWriteStream(path.join(root, "symlink.zip")))).rejects.toThrow(
    "包含链接"
  );
  expect(f.manager.hasActiveJobs()).toBe(false);
});
