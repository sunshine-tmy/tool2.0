import fsp from "node:fs/promises";
import path from "node:path";
import type { ComponentPlatform } from "@toolbox/shared";
import type { ComponentPackageManifest } from "./types";
import { ComponentManagerError } from "./component-error";
import { safeChildPath } from "./package-paths";
import {
  hasExactMacOSChromiumFrameworkLinks,
  MACOS_CHROMIUM_FRAMEWORK_PATH,
  resolveMacOSChromiumLinkPath
} from "./chromium-framework-links";

export async function materializeManifestLinks(
  root: string,
  manifest: ComponentPackageManifest,
  platform: ComponentPlatform | undefined,
  signal?: AbortSignal
) {
  const links = manifest.links ?? [];
  if (!links.length) return;
  if (!hasExactMacOSChromiumFrameworkLinks(manifest.id, manifest.version, platform, manifest.links)) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包链接不在固定的 Chromium framework 范围内");
  }

  for (const link of links) {
    signal?.throwIfAborted();
    const destination = safeChildPath(root, link.path);
    await assertPlainDirectoryChain(root, path.dirname(destination));
    if (await lstatIfExists(destination)) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包链接目标路径已存在");
    }
    if (!resolveMacOSChromiumLinkPath(link.path)) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包链接目标越过 Chromium framework");
    }
    await fsp.symlink(link.target, destination);
  }
}

export async function listInstalledEntries(root: string, manifest: ComponentPackageManifest) {
  const expectedLinks = new Map((manifest.links ?? []).map((link) => [link.path, link]));
  if (
    expectedLinks.size &&
    !hasExactMacOSChromiumFrameworkLinks(manifest.id, manifest.version, "darwin-arm64", manifest.links)
  ) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "已安装能力包含不受支持的链接清单");
  }
  const files: Array<{ path: string; fullPath: string; bytes: number; mode: number }> = [];
  const links = new Set<string>();
  const absoluteRoot = path.resolve(root);
  const frameworkRoot = expectedLinks.size
    ? await fsp.realpath(safeChildPath(absoluteRoot, MACOS_CHROMIUM_FRAMEWORK_PATH)).catch(() => undefined)
    : undefined;
  if (expectedLinks.size && !frameworkRoot) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "Chromium framework 目录缺失");
  }

  async function walk(directory: string, prefix: string) {
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = await fsp.lstat(fullPath);
      if (stat.isSymbolicLink()) {
        const expected = expectedLinks.get(relative);
        if (!expected || (await fsp.readlink(fullPath)) !== expected.target) {
          throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含未声明或错误的链接");
        }
        const resolvedTarget = await fsp.realpath(fullPath).catch(() => undefined);
        const resolvedFramework = frameworkRoot!;
        const relativeTarget = resolvedTarget ? path.relative(resolvedFramework, resolvedTarget) : "..";
        const targetStat = resolvedTarget ? await fsp.lstat(resolvedTarget) : undefined;
        if (
          !resolvedTarget ||
          !relativeTarget ||
          relativeTarget === ".." ||
          relativeTarget.startsWith(".." + path.sep) ||
          path.isAbsolute(relativeTarget) ||
          !targetStat ||
          (!targetStat.isFile() && !targetStat.isDirectory())
        ) {
          throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "Chromium framework 链接目标缺失或越界");
        }
        links.add(relative);
      } else if (stat.isDirectory()) await walk(fullPath, relative);
      else if (stat.isFile()) files.push({ path: relative, fullPath, bytes: stat.size, mode: stat.mode });
      else throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含不支持的文件类型");
    }
  }

  await walk(absoluteRoot, "");
  if (links.size !== expectedLinks.size || [...expectedLinks.keys()].some((link) => !links.has(link))) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包链接清单校验失败");
  }
  return { files: files.sort((left, right) => left.path.localeCompare(right.path)), links };
}

async function assertPlainDirectoryChain(root: string, directory: string) {
  const absoluteRoot = path.resolve(root);
  const relative = path.relative(absoluteRoot, directory);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包链接父目录越界");
  }
  let current = absoluteRoot;
  const rootStat = await fsp.lstat(current);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包暂存根目录无效");
  }
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await fsp.lstat(current).catch(() => undefined);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包链接父目录缺失或不安全");
    }
  }
}

async function lstatIfExists(candidate: string) {
  return fsp.lstat(candidate).then(
    (stat) => stat,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
  );
}
