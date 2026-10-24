import path from "node:path";
import type { ComponentPlatform } from "@toolbox/shared";
import type { ComponentPackageManifest, ComponentArchiveAsset } from "./types";
import { ComponentManagerError } from "./component-error";
import { COMPONENT_PROTOCOL_VERSION, COMPONENT_ID, SAFE_VERSION, SHA256 } from "./package-constants";
import { isSafeRelativePath } from "./package-paths";
import { verifyManifestSignature } from "./manifest-signature";
const MAX_MANIFEST_FILES = 100_000;
export function componentArchiveAssets(manifest: ComponentPackageManifest) {
  return [manifest.archive, ...(manifest.additionalArchives ?? [])];
}

export function archiveAssetFileName(archive: ComponentArchiveAsset) {
  try {
    const fileName = decodeURIComponent(path.posix.basename(new URL(archive.url).pathname));
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,232}\.tar\.gz$/.test(fileName)) throw new Error("invalid archive filename");
    return fileName;
  } catch {
    throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包归档文件名无效");
  }
}

export function componentReleasePageUrl(manifest: ComponentPackageManifest) {
  const releasePages = componentArchiveAssets(manifest).map((archive) => {
    try {
      const url = new URL(archive.url);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password) return undefined;
      const match = /^\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/[^/]+$/.exec(url.pathname);
      if (!match) return undefined;
      const owner = decodeURIComponent(match[1]!);
      const repository = decodeURIComponent(match[2]!);
      const tag = decodeURIComponent(match[3]!);
      if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository) || !tag) return undefined;
      return "https://github.com/" + owner + "/" + repository + "/releases/tag/" + encodeURIComponent(tag);
    } catch {
      return undefined;
    }
  });
  const firstReleasePage = releasePages[0];
  return firstReleasePage && releasePages.every((releasePage) => releasePage === firstReleasePage)
    ? firstReleasePage
    : undefined;
}

export function componentDownloadBytes(manifest: ComponentPackageManifest) {
  return componentArchiveAssets(manifest).reduce((total, archive) => total + archive.bytes, 0);
}

function isValidArchiveAsset(archive: ComponentArchiveAsset, maxBytes: number) {
  return Boolean(
    archive &&
    typeof archive.url === "string" &&
    isHttpsUrl(archive.url) &&
    archive.format === "tar.gz" &&
    Number.isSafeInteger(archive.bytes) &&
    archive.bytes > 0 &&
    archive.bytes <= maxBytes &&
    SHA256.test(archive.sha256) &&
    (archive.filePaths === undefined ||
      (Array.isArray(archive.filePaths) && archive.filePaths.every((filePath) => typeof filePath === "string")))
  );
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function verifyManifest(
  manifest: ComponentPackageManifest,
  platform: ComponentPlatform | undefined,
  maxArchiveBytes: number,
  trustedPublicKeys: Record<string, string>
) {
  if (
    manifest.protocolVersion !== COMPONENT_PROTOCOL_VERSION ||
    !COMPONENT_ID.test(manifest.id) ||
    manifest.moduleId !== manifest.id ||
    !["shared", "media", "audio", "image", "archive", "translation"].includes(manifest.groupId) ||
    !SAFE_VERSION.test(manifest.version) ||
    manifest.platform !== platform ||
    (platform === "darwin-arm64" && manifest.id === "chatterbox-cuda") ||
    !manifest.displayName.trim() ||
    !manifest.purpose.trim() ||
    (manifest.license !== undefined &&
      (!manifest.license ||
        typeof manifest.license.name !== "string" ||
        !manifest.license.name.trim() ||
        (manifest.license.url !== undefined &&
          (typeof manifest.license.url !== "string" || !isHttpsUrl(manifest.license.url))))) ||
    !isHttpsUrl(manifest.sbom.url) ||
    !SHA256.test(manifest.sbom.sha256) ||
    !isValidArchiveAsset(manifest.archive, maxArchiveBytes) ||
    (manifest.assembledFiles !== undefined &&
      (!Array.isArray(manifest.assembledFiles) ||
        !manifest.assembledFiles.length ||
        manifest.assembledFiles.length > 16)) ||
    !Number.isSafeInteger(manifest.installedBytes) ||
    manifest.installedBytes < 0 ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > MAX_MANIFEST_FILES ||
    !Array.isArray(manifest.dependencyIds) ||
    !Array.isArray(manifest.taskToolIds) ||
    !Array.isArray(manifest.installConditions) ||
    manifest.dependencyIds.some((dependencyId) => !COMPONENT_ID.test(dependencyId)) ||
    manifest.taskToolIds.some((toolId) => !COMPONENT_ID.test(toolId)) ||
    manifest.installConditions.some(
      (condition) => typeof condition !== "string" || !condition.trim() || condition.length > 300
    ) ||
    (manifest.pythonEnvironment !== undefined &&
      (!manifest.pythonEnvironment ||
        !SHA256.test(manifest.pythonEnvironment.requirementsLockSha256) ||
        !["3.11", "3.12"].includes(manifest.pythonEnvironment.expectedPythonVersion) ||
        !isSafeRelativePath(manifest.pythonEnvironment.pythonExecutablePath) ||
        !isSafeRelativePath(manifest.pythonEnvironment.wheelhousePath) ||
        !isSafeRelativePath(manifest.pythonEnvironment.requirementsLockPath) ||
        (manifest.pythonEnvironment.pythonComponentId !== undefined &&
          (!COMPONENT_ID.test(manifest.pythonEnvironment.pythonComponentId) ||
            !manifest.dependencyIds.includes(manifest.pythonEnvironment.pythonComponentId)))))
  )
    throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包 manifest 不符合安全约束");
  if (
    manifest.additionalArchives !== undefined &&
    (!Array.isArray(manifest.additionalArchives) ||
      manifest.additionalArchives.length < 1 ||
      manifest.additionalArchives.length > 16 ||
      manifest.additionalArchives.some((archive) => !isValidArchiveAsset(archive, maxArchiveBytes)))
  ) {
    throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包归档分片不符合安全约束");
  }
  const names = new Set<string>();
  for (const file of manifest.files) {
    if (
      !isSafeRelativePath(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !SHA256.test(file.sha256) ||
      (file.executable !== undefined && typeof file.executable !== "boolean") ||
      names.has(file.path)
    ) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包文件清单不符合安全约束");
    }
    names.add(file.path);
  }
  const assemblyTargets = new Set<string>();
  const assemblyParts = new Set<string>();
  for (const assembly of manifest.assembledFiles ?? []) {
    if (!assembly || typeof assembly !== "object") {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包组装目标定义无效");
    }
    const targetFile = manifest.files.find((file) => file.path === assembly.path);
    if (
      !isSafeRelativePath(assembly.path) ||
      assemblyTargets.has(assembly.path) ||
      !Number.isSafeInteger(assembly.bytes) ||
      assembly.bytes < 1 ||
      !SHA256.test(assembly.sha256) ||
      !targetFile ||
      targetFile.bytes !== assembly.bytes ||
      targetFile.sha256 !== assembly.sha256 ||
      !Array.isArray(assembly.parts) ||
      assembly.parts.length < 2 ||
      assembly.parts.length > 64
    ) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包组装目标定义无效");
    }
    assemblyTargets.add(assembly.path);
    for (const part of assembly.parts) {
      if (
        !part ||
        typeof part !== "object" ||
        !isSafeRelativePath(part.path) ||
        part.path === assembly.path ||
        names.has(part.path) ||
        assemblyTargets.has(part.path) ||
        assemblyParts.has(part.path) ||
        !Number.isSafeInteger(part.bytes) ||
        part.bytes < 1 ||
        !SHA256.test(part.sha256)
      ) {
        throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包组装分片定义无效");
      }
      assemblyParts.add(part.path);
    }
  }
  if ([...assemblyTargets].some((target) => assemblyParts.has(target))) {
    throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包组装目标与分片路径冲突");
  }
  const archiveAssets = componentArchiveAssets(manifest);
  if (archiveAssets.length > 1 || manifest.archive.filePaths !== undefined || assemblyTargets.size > 0) {
    const archivePaths = new Set<string>();
    for (const archive of archiveAssets) {
      if (!Array.isArray(archive.filePaths) || !archive.filePaths.length) {
        throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "归档分片缺少文件路径清单");
      }
      for (const filePath of archive.filePaths) {
        if (!isSafeRelativePath(filePath) || archivePaths.has(filePath)) {
          throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "归档分片文件路径清单无效");
        }
        archivePaths.add(filePath);
      }
    }
    const expectedArchivedPaths = new Set([
      ...[...names].filter((name) => !assemblyTargets.has(name)),
      ...assemblyParts
    ]);
    if (
      archivePaths.size !== expectedArchivedPaths.size ||
      [...expectedArchivedPaths].some((name) => !archivePaths.has(name))
    ) {
      throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "归档分片没有完整覆盖签名文件清单");
    }
  }
  const publicKey = trustedPublicKeys[manifest.keyId];
  if (!publicKey || !verifyManifestSignature(manifest, publicKey)) {
    throw new ComponentManagerError("COMPONENT_MANIFEST_INVALID", "能力包签名校验失败");
  }
}
