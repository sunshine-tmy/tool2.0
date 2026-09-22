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

    await expect(manager.list()).resolves.toMatchObject([{ id: "edge-tts", installed: false }]);
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
});

async function createFixture(
  version: string,
  overrides: { archiveSha256?: string; signature?: string; omitManifestPath?: string } = {}
) {
  if (!temporaryRoot) temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-component-manager-"));
  const source = path.join(temporaryRoot, `source-${version}`);
  const archivePath = path.join(temporaryRoot, `edge-tts-${version}.tar.gz`);
  await fs.mkdir(path.join(source, "bin"), { recursive: true });
  await fs.writeFile(path.join(source, "bin", "runner.exe"), `runner-${version}`);
  await fs.writeFile(path.join(source, "LICENSE"), "MIT");
  await tar.c({ gzip: true, file: archivePath, cwd: source }, ["bin/runner.exe", "LICENSE"]);

  const allFiles = await Promise.all(
    ["LICENSE", "bin/runner.exe"].map(async (relativePath) => {
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
    id: "edge-tts",
    displayName: "Edge TTS",
    version,
    platform: "win32-x64" as const,
    archive: {
      url: "https://packages.example.test/edge-tts.tar.gz",
      bytes: archive.byteLength,
      sha256: overrides.archiveSha256 ?? crypto.createHash("sha256").update(archive).digest("hex"),
      format: "tar.gz" as const
    },
    files: allFiles.filter((file) => file.path !== overrides.omitManifestPath),
    license: { name: "MIT", url: "https://licenses.example.test/mit" },
    sbom: { url: "https://packages.example.test/edge-tts.sbom.json", sha256: "1".repeat(64) },
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
  downloadArchive = async (_manifest: ComponentPackageManifest, destination: string) =>
    fs.copyFile(archivePath, destination)
) {
  return new ComponentManager({
    root: path.join(temporaryRoot, "packages"),
    catalog: { manifests: [manifest], trustedPublicKeys: { "test-ed25519": publicKey } },
    downloadArchive
  });
}
