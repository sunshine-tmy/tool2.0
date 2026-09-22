/**
 * 中文模块说明：能力包安装器，负责签名验证、受控下载、安全解压和 current.json 原子切换。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import type { ComponentPackageStatus } from "@toolbox/shared";

const COMPONENT_PROTOCOL_VERSION = 1;
const COMPONENT_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_MANIFEST_FILES = 100_000;

export type ComponentManifestFile = {
  path: string;
  bytes: number;
  sha256: string;
};

export type ComponentPackageManifest = {
  protocolVersion: number;
  id: string;
  displayName: string;
  version: string;
  platform: "win32-x64";
  archive: { url: string; bytes: number; sha256: string; format: "tar.gz" };
  files: ComponentManifestFile[];
  license: { name: string; url: string };
  sbom: { url: string; sha256: string };
  keyId: string;
  signature: string;
};

export type ComponentCatalog = {
  manifests: ComponentPackageManifest[];
  trustedPublicKeys: Record<string, string>;
};

export type ComponentManagerOptions = {
  root: string;
  catalog: ComponentCatalog;
  maxArchiveBytes?: number;
  downloadArchive?: (manifest: ComponentPackageManifest, destination: string) => Promise<void>;
};

type CurrentRecord = {
  protocolVersion: number;
  id: string;
  version: string;
  previousVersion?: string;
  installedAt: string;
  manifestSha256: string;
};

export class ComponentManagerError extends Error {
  constructor(
    readonly code: "COMPONENT_NOT_FOUND" | "COMPONENT_MANIFEST_INVALID" | "COMPONENT_INSTALL_FAILED",
    message: string
  ) {
    super(message);
    this.name = "ComponentManagerError";
  }
}

/**
 * Renderer 只可请求目录中的 id；这里从已签名 manifest 获取 URL、摘要和文件清单，
 * 不接受 URL、命令或目标目录作为 API 输入。
 */
export class ComponentManager {
  private readonly root: string;
  private readonly manifests: Map<string, ComponentPackageManifest>;
  private readonly trustedPublicKeys: Record<string, string>;
  private readonly maxArchiveBytes: number;
  private readonly downloadArchive: (manifest: ComponentPackageManifest, destination: string) => Promise<void>;
  private readonly installs = new Map<string, Promise<ComponentPackageStatus>>();

  constructor(options: ComponentManagerOptions) {
    this.root = path.resolve(options.root);
    this.manifests = new Map(options.catalog.manifests.map((manifest) => [manifest.id, manifest]));
    if (this.manifests.size !== options.catalog.manifests.length) {
      throw new Error("Component catalog contains duplicate ids");
    }
    this.trustedPublicKeys = { ...options.catalog.trustedPublicKeys };
    this.maxArchiveBytes = options.maxArchiveBytes ?? 20 * 1024 * 1024 * 1024;
    this.downloadArchive = options.downloadArchive ?? downloadArchive;
  }

  async list(): Promise<ComponentPackageStatus[]> {
    return Promise.all(
      [...this.manifests.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(async (manifest) => this.status(manifest))
    );
  }

  install(componentId: string): Promise<ComponentPackageStatus> {
    const existing = this.installs.get(componentId);
    if (existing) return existing;
    const install = this.installComponent(componentId).finally(() => this.installs.delete(componentId));
    this.installs.set(componentId, install);
    return install;
  }

  private async installComponent(componentId: string) {
    const manifest = this.manifests.get(componentId);
    if (!manifest) throw new ComponentManagerError("COMPONENT_NOT_FOUND", "未找到可安装的能力包");
    this.verifyManifest(manifest);

    const componentRoot = this.componentRoot(manifest.id);
    const versionsRoot = path.join(componentRoot, "versions");
    const archiveRoot = path.join(componentRoot, "archives");
    const target = safeChildPath(versionsRoot, manifest.version);
    await Promise.all([fsp.mkdir(versionsRoot, { recursive: true }), fsp.mkdir(archiveRoot, { recursive: true })]);

    if (await pathExists(target)) {
      await this.verifyInstalledFiles(target, manifest);
      await this.switchCurrent(componentRoot, manifest);
      return this.status(manifest);
    }

    const archivePath = safeChildPath(archiveRoot, `${manifest.version}.${crypto.randomUUID()}.partial`);
    const staging = safeChildPath(versionsRoot, `.${manifest.version}.${crypto.randomUUID()}.partial`);
    try {
      await this.downloadArchive(manifest, archivePath);
      await this.verifyArchive(archivePath, manifest);
      await fsp.mkdir(staging, { recursive: false });
      await inspectArchive(archivePath);
      await tar.x({ file: archivePath, cwd: staging, strict: true, preservePaths: false });
      await this.verifyInstalledFiles(staging, manifest);
      await fsp.rename(staging, target);
      await this.switchCurrent(componentRoot, manifest);
      return this.status(manifest);
    } catch (error) {
      if (error instanceof ComponentManagerError) throw error;
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", safeErrorMessage(error));
    } finally {
      await Promise.all([
        fsp.rm(archivePath, { force: true }).catch(() => undefined),
        fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined)
      ]);
    }
  }

  private async status(manifest: ComponentPackageManifest): Promise<ComponentPackageStatus> {
    const current = await this.readCurrent(this.componentRoot(manifest.id), manifest.id);
    return {
      id: manifest.id,
      displayName: manifest.displayName,
      version: manifest.version,
      platform: manifest.platform,
      installed: Boolean(current),
      ...(current ? { installedVersion: current.version, installedAt: current.installedAt } : {}),
      ...(current?.previousVersion ? { previousVersion: current.previousVersion } : {}),
      licenseName: manifest.license.name
    };
  }

  private verifyManifest(manifest: ComponentPackageManifest) {
    if (
      manifest.protocolVersion !== COMPONENT_PROTOCOL_VERSION ||
      !COMPONENT_ID.test(manifest.id) ||
      !SAFE_VERSION.test(manifest.version) ||
      manifest.platform !== "win32-x64" ||
      !manifest.displayName.trim() ||
      !manifest.license.name.trim() ||
      !isHttpsUrl(manifest.license.url) ||
      !isHttpsUrl(manifest.sbom.url) ||
      !SHA256.test(manifest.sbom.sha256) ||
      !isHttpsUrl(manifest.archive.url) ||
      manifest.archive.format !== "tar.gz" ||
      !Number.isSafeInteger(manifest.archive.bytes) ||
      manifest.archive.bytes < 1 ||
      manifest.archive.bytes > this.maxArchiveBytes ||
      !SHA256.test(manifest.archive.sha256) ||
      !Array.isArray(manifest.files) ||
      !manifest.files.length ||
      manifest.files.length > MAX_MANIFEST_FILES
    ) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包 manifest 不符合安全约束");
    }
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
    const digest = await sha256File(archivePath);
    if (digest !== manifest.archive.sha256) {
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

  private async switchCurrent(componentRoot: string, manifest: ComponentPackageManifest) {
    const previous = await this.readCurrent(componentRoot, manifest.id);
    const record: CurrentRecord = {
      protocolVersion: COMPONENT_PROTOCOL_VERSION,
      id: manifest.id,
      version: manifest.version,
      ...(previous && previous.version !== manifest.version
        ? { previousVersion: previous.version }
        : previous?.previousVersion
          ? { previousVersion: previous.previousVersion }
          : {}),
      installedAt: new Date().toISOString(),
      manifestSha256: sha256Text(canonicalManifest(manifest))
    };
    const currentPath = path.join(componentRoot, "current.json");
    const pendingPath = path.join(componentRoot, `.current.${crypto.randomUUID()}.partial`);
    await fsp.mkdir(componentRoot, { recursive: true });
    await fsp.writeFile(pendingPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
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
        (raw.previousVersion !== undefined &&
          (typeof raw.previousVersion !== "string" || !SAFE_VERSION.test(raw.previousVersion))) ||
        typeof raw.installedAt !== "string" ||
        Number.isNaN(Date.parse(raw.installedAt)) ||
        typeof raw.manifestSha256 !== "string" ||
        !SHA256.test(raw.manifestSha256)
      ) {
        return undefined;
      }
      return raw as CurrentRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return undefined;
    }
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

async function downloadArchive(manifest: ComponentPackageManifest, destination: string) {
  const response = await fetch(manifest.archive.url, {
    redirect: "error",
    signal: AbortSignal.timeout(10 * 60 * 1000)
  });
  if (!response.ok || !response.body) throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载失败");
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength !== manifest.archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
  }
  const file = await fsp.open(destination, "wx");
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > manifest.archive.bytes)
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应超过清单大小");
      await file.write(chunk);
    }
  } finally {
    await file.close();
  }
  if (bytes !== manifest.archive.bytes)
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包响应大小校验失败");
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
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = await fsp.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含链接");
      if (stat.isDirectory()) {
        await walk(fullPath, relative);
      } else if (stat.isFile()) {
        files.push({ path: relative, fullPath, bytes: stat.size });
      } else {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含不支持的文件类型");
      }
    }
  }
  await walk(root, "");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function safeChildPath(root: string, child: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, child);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包路径越界");
  }
  return resolved;
}

function isSafeRelativePath(value: string) {
  if (!value || value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && !normalized.startsWith("../") && normalized !== ".." && !value.split("/").includes("");
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
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("Manifest contains an unsupported value");
}

function pathExists(candidate: string) {
  return fsp.access(candidate).then(
    () => true,
    () => false
  );
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "能力包安装失败";
  return message.replace(/[\r\n]/g, " ").slice(0, 200);
}
