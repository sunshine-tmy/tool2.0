import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import * as tar from "tar";
import type { ComponentPlatform } from "@toolbox/shared";
import type { ComponentPackageManifest, ComponentArchiveAsset } from "./types";
import { ComponentManagerError } from "./component-error";
import { safeChildPath, isSafeArchivePath } from "./package-paths";
import { sha256File } from "./package-hash";
import { listRegularFiles } from "./package-files";
export async function verifyArchive(archivePath: string, archive: ComponentArchiveAsset) {
  const stat = await fsp.stat(archivePath);
  if (!stat.isFile() || stat.size !== archive.bytes) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载大小校验失败");
  }
  if ((await sha256File(archivePath)) !== archive.sha256) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包下载摘要校验失败");
  }
}
export async function verifyInstalledFiles(
  root: string,
  manifest: ComponentPackageManifest,
  platform: ComponentPlatform | undefined,
  signal?: AbortSignal
) {
  const actual = await listRegularFiles(root);
  const expected = new Map(manifest.files.map((file) => [file.path, file]));
  if (actual.length !== expected.size || actual.some((file) => !expected.has(file.path))) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包文件清单校验失败");
  }
  for (const file of actual) {
    signal?.throwIfAborted();
    const expectedFile = expected.get(file.path);
    if (
      !expectedFile ||
      file.bytes !== expectedFile.bytes ||
      (platform === "darwin-arm64" && expectedFile.executable && (file.mode & 0o111) === 0) ||
      (await sha256File(file.fullPath)) !== expectedFile.sha256
    ) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包文件摘要校验失败");
    }
  }
}
export async function assembleFiles(root: string, manifest: ComponentPackageManifest, signal: AbortSignal) {
  for (const assembly of manifest.assembledFiles ?? []) {
    if (signal.aborted) throw new Error("download cancelled");
    const target = safeChildPath(root, assembly.path);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const output = fs.createWriteStream(target, { flags: "wx" });
    let outputError: Error | undefined;
    const outputFinished = new Promise<void>((resolve) => {
      output.once("error", (error) => {
        outputError = error;
        resolve();
      });
      output.once("finish", resolve);
    });
    const targetDigest = crypto.createHash("sha256");
    let targetBytes = 0;
    try {
      for (const part of assembly.parts) {
        if (signal.aborted) throw new Error("download cancelled");
        const partPath = safeChildPath(root, part.path);
        const partStat = await fsp.lstat(partPath);
        if (!partStat.isFile() || partStat.isSymbolicLink() || partStat.size !== part.bytes) {
          throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包组装分片大小校验失败");
        }
        const partDigest = crypto.createHash("sha256");
        let partBytes = 0;
        for await (const chunk of fs.createReadStream(partPath)) {
          if (signal.aborted) throw new Error("download cancelled");
          partBytes += chunk.length;
          targetBytes += chunk.length;
          partDigest.update(chunk);
          targetDigest.update(chunk);
          if (!output.write(chunk)) await once(output, "drain");
        }
        if (partBytes !== part.bytes || partDigest.digest("hex") !== part.sha256) {
          throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包组装分片摘要校验失败");
        }
      }
      output.end();
      await outputFinished;
      if (outputError) throw outputError;
      if (targetBytes !== assembly.bytes || targetDigest.digest("hex") !== assembly.sha256) {
        throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包组装目标摘要校验失败");
      }
      await Promise.all(assembly.parts.map((part) => fsp.rm(safeChildPath(root, part.path), { force: true })));
    } catch (error) {
      output.destroy();
      await fsp.rm(target, { force: true }).catch(() => undefined);
      if (error instanceof ComponentManagerError) throw error;
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分片重组失败");
    }
  }
}
export async function inspectArchive(archivePath: string, filePaths?: string[]) {
  const expectedFiles = filePaths ? new Set(filePaths) : undefined;
  const actualFiles = new Set<string>();
  try {
    await tar.t({
      file: archivePath,
      onReadEntry(entry) {
        if (!isSafeArchivePath(entry.path) || !["File", "Directory"].includes(entry.type)) {
          throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包归档包含不安全路径或链接");
        }
        if (entry.type === "File") {
          if (actualFiles.has(entry.path) || (expectedFiles && !expectedFiles.has(entry.path))) {
            throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分片包含重复或未声明文件");
          }
          actualFiles.add(entry.path);
        }
      }
    });
    if (
      expectedFiles &&
      (actualFiles.size !== expectedFiles.size || [...expectedFiles].some((filePath) => !actualFiles.has(filePath)))
    ) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包分片未完整包含其声明文件");
    }
  } catch (error) {
    if (error instanceof ComponentManagerError) throw error;
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包归档格式无效");
  }
}
export function extractArchive(archivePath: string, staging: string) {
  return tar.x({ file: archivePath, cwd: staging, strict: true, preservePaths: false });
}
