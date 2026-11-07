/** Recover mutable bytecode from the signed release, without changing the installed generation. */
import fs from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import type { ComponentPackageManifest, ComponentManagerOptions } from "./types";
import { componentArchiveAssets } from "./manifest";
import { inspectArchive, verifyArchive } from "./package-archive";
import { safeChildPath } from "./package-paths";
import { sha256File } from "./package-hash";
import { ComponentManagerError } from "./component-error";
import { signedPath } from "./offline-bundle";

export async function recoverExportCaches(
  manifest: ComponentPackageManifest,
  root: string,
  archiveRoot: string,
  download: NonNullable<ComponentManagerOptions["downloadArchive"]>,
  signal: AbortSignal
): Promise<string | undefined> {
  const changed = [];
  for (const file of manifest.files.filter((file) => file.path.endsWith(".pyc"))) {
    signal.throwIfAborted();
    const candidate = await signedPath(root, file.path);
    const stat = await fs.lstat(candidate);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "Python 缓存包含不安全文件，拒绝导出");
    if (stat.size !== file.bytes || (await sha256File(candidate)) !== file.sha256) changed.push(file);
  }
  if (!changed.length) return;
  await fs.mkdir(archiveRoot, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(archiveRoot, ".export-cache-"));
  const original = path.join(temporary, "original");
  try {
    await fs.mkdir(original);
    const needed = new Set(changed.map((file) => file.path));
    for (const [index, asset] of componentArchiveAssets(manifest).entries()) {
      if (asset.filePaths && !asset.filePaths.some((name) => needed.has(name))) continue;
      signal.throwIfAborted();
      const archive = path.join(temporary, `${index}.tar.gz`);
      await download({ ...manifest, archive: asset }, archive, { signal });
      await verifyArchive(archive, asset);
      await inspectArchive(archive, asset.filePaths);
      signal.throwIfAborted();
      await tar.x({
        file: archive,
        cwd: original,
        strict: true,
        preservePaths: false,
        filter: (name) => {
          signal.throwIfAborted();
          return needed.has(name);
        }
      });
      await fs.rm(archive);
    }
    for (const file of changed) {
      signal.throwIfAborted();
      const candidate = safeChildPath(original, file.path);
      const stat = await fs.lstat(candidate);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size !== file.bytes ||
        (await sha256File(candidate)) !== file.sha256
      )
        throw new Error("原始缓存文件未通过签名清单校验");
    }
    return temporary;
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    signal.throwIfAborted();
    throw new ComponentManagerError(
      "COMPONENT_IMPORT_INVALID",
      `${manifest.displayName} 运行缓存已变化，恢复原始签名缓存失败；请检查网络后重试。${error instanceof Error ? error.message : ""}`
    );
  }
}
