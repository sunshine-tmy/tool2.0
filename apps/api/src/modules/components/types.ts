import type { Readable } from "node:stream";
import type { ComponentJob, ComponentPlatform } from "@toolbox/shared";
import type { PythonEnvironmentBuildOptions, PythonRuntimeVersion } from "./python-environment";
export type ComponentManifestFile = { path: string; bytes: number; sha256: string; executable?: boolean };

export type ComponentArchiveAsset = {
  url: string;
  bytes: number;
  sha256: string;
  format: "tar.gz";
  /** Signed file partition, required when a manifest has multiple archive assets. */
  filePaths?: string[];
};

export type ComponentAssembledFile = {
  path: string;
  bytes: number;
  sha256: string;
  parts: ComponentManifestFile[];
};

export type OfflineArchiveUpload = {
  fieldName: string;
  filename: string;
  stream: Readable & { truncated?: boolean };
};

export type ComponentPackageManifest = {
  protocolVersion: number;
  id: string;
  moduleId: string;
  groupId: "shared" | "media" | "audio" | "image" | "archive" | "translation";
  displayName: string;
  purpose: string;
  dependencyIds: string[];
  taskToolIds: string[];
  installConditions: string[];
  version: string;
  platform: ComponentPlatform;
  archive: ComponentArchiveAsset;
  additionalArchives?: ComponentArchiveAsset[];
  assembledFiles?: ComponentAssembledFile[];
  installedBytes: number;
  files: ComponentManifestFile[];
  pythonEnvironment?: {
    /** Set when the interpreter belongs to a separately installed signed dependency. */
    pythonComponentId?: string;
    pythonExecutablePath: string;
    wheelhousePath: string;
    requirementsLockPath: string;
    requirementsLockSha256: string;
    expectedPythonVersion: PythonRuntimeVersion;
  };
  license?: { name: string; url?: string };
  sbom: { url: string; sha256: string };
  keyId: string;
  signature: string;
};

export type ComponentCatalog = {
  manifests: ComponentPackageManifest[];
  trustedPublicKeys: Record<string, string>;
};

export type VerifiedComponentAsset = {
  /** The canonical path of a file listed in the signed package manifest. */
  path: string;
  /** The immutable generation containing the verified file. */
  generationRoot: string;
  manifest: ComponentPackageManifest;
};

export type ComponentManagerOptions = {
  root: string;
  catalog: ComponentCatalog;
  /** Override only for deterministic platform-specific tests or package tools. */
  platform?: ComponentPlatform;
  maxArchiveBytes?: number;
  downloadArchive?: (
    manifest: ComponentPackageManifest,
    destination: string,
    options?: { signal?: AbortSignal; onProgress?: (downloadedBytes: number) => void }
  ) => Promise<void>;
  isInUse?: (componentId: string, taskToolIds: readonly string[]) => boolean | Promise<boolean>;
  availableDiskBytes?: (root: string) => Promise<number>;
  selfTest?: (manifest: ComponentPackageManifest, generationRoot: string) => Promise<void>;
  runPythonProcess?: PythonEnvironmentBuildOptions["runProcess"];
  onBeforeUninstall?: (componentId: string) => Promise<void>;
  onAfterMutation?: (componentId: string, operation: ComponentJob["operation"]) => Promise<void>;
};

export type CurrentRecord = {
  protocolVersion: number;
  id: string;
  version: string;
  directory: string;
  installedBytes?: number;
  previousVersion?: string;
  installedAt: string;
  manifestSha256: string;
};

export type InternalJob = {
  value: ComponentJob;
  controller?: AbortController;
  offlineArchivePaths?: string[];
  offlineImportRoot?: string;
};
