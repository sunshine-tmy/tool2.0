/** Versioned sequence assets are resolved only from verified video generations. */
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isPathWithin, isSafeRelativePath } from "./package-paths";
import type { VerifiedComponentAsset } from "./types";

export const VIDEO_AI_SEQUENCE_SUPPORT = "scripts/video-ai-sequence-support.json";
export const VIDEO_AI_MACOS_SEQUENCE_SUPPORT = "scripts/video-ai-sequence-support-macos.json";
export const VIDEO_AI_SEQUENCE_LOADER = "scripts/video_ai_engine_assets.py";
export const VIDEO_AI_SEQUENCE_RUNTIME_FILES = [
  "scripts/video_ai_sequence.py",
  "scripts/video_ai_sttn.py",
  "scripts/video_ai_propainter.py"
];
export const videoAiSequenceBundle = (engine: "sttn" | "propainter") =>
  `models/video-ai/engines/${engine}/sequence-bundle.json`;

const MACOS_SEQUENCE_EXPECTATIONS = {
  sttn: {
    repository: "https://github.com/researchmm/STTN",
    revision: "f39f62c5bbbe3e3eba084c487353a2c651bfdcde",
    license: "MIT",
    namespace: "toolbox_video_ai_vendor.sttn",
    executionMode: "mps",
    weights: ["weights/sttn.pth"],
    requiredSources: ["vendor/__init__.py", "vendor/model/sttn.py"]
  },
  propainter: {
    repository: "https://github.com/sczhou/ProPainter",
    revision: "326782529a63d997cab80ab21439b92ed422b3d3",
    license: "LicenseRef-S-Lab-1.0",
    namespace: "toolbox_video_ai_vendor.propainter",
    executionMode: "hybrid",
    weights: ["weights/ProPainter.pth", "weights/raft-things.pth", "weights/recurrent_flow_completion.pth"],
    requiredSources: [
      "vendor/__init__.py",
      "vendor/RAFT/raft.py",
      "vendor/model/propainter.py",
      "vendor/model/recurrent_flow_completion.py"
    ]
  }
} as const;

type SequenceEngineName = keyof typeof MACOS_SEQUENCE_EXPECTATIONS;

/**
 * Resolve Mac sequence engines only from the signed video-ai generation.
 * A missing or unaccepted engine is omitted so the basic CPU worker can still
 * run; it can never fall through to an unmanifested development/legacy path.
 */
export async function macOSVideoAiSequenceEnvironment(
  base: VerifiedComponentAsset,
  { requireBothEngines = false }: { requireBothEngines?: boolean } = {}
) {
  const environment: Record<string, string> = {};
  if (
    base.manifest.id !== "video-ai" ||
    base.manifest.platform !== "darwin-arm64" ||
    base.manifest.pythonEnvironment?.expectedPythonVersion !== "3.12"
  ) {
    throw new Error("Mac 视频时序资源需要 darwin-arm64 Python 3.12 视频基础包");
  }

  if (!base.manifest.files?.some((file) => file.path === VIDEO_AI_MACOS_SEQUENCE_SUPPORT)) {
    if (requireBothEngines) throw new Error("Mac 视频基础包缺少已签名的时序支持定义");
    for (const engine of Object.keys(MACOS_SEQUENCE_EXPECTATIONS) as SequenceEngineName[]) {
      environment[`VIDEO_AI_${engine.toUpperCase()}_SEQUENCE_REASON`] = "Mac 视频包未包含已签名的时序支持定义";
    }
    return environment;
  }

  const supportPath = await verifiedVideoFile(base, VIDEO_AI_MACOS_SEQUENCE_SUPPORT, 128 * 1024);
  const supportFile = listedFile(base, VIDEO_AI_MACOS_SEQUENCE_SUPPORT);
  const support = await readJson(base, VIDEO_AI_MACOS_SEQUENCE_SUPPORT);
  if (
    support.assetSchemaVersion !== 1 ||
    support.workerFeature !== "sequence-assets-v1" ||
    support.sequenceRuntime !== 1 ||
    support.platform !== "darwin-arm64" ||
    support.torchVersion !== "2.6.0" ||
    support.torchvisionVersion !== "0.21.0"
  ) {
    throw new Error("Mac 视频时序支持定义的平台、协议或 PyTorch 版本不兼容");
  }

  environment.VIDEO_AI_SEQUENCE_PACKAGE_ROOT = await fs.realpath(base.generationRoot);
  environment.VIDEO_AI_SEQUENCE_SUPPORT_PATH = supportPath;
  environment.VIDEO_AI_SEQUENCE_SUPPORT_SHA256 = supportFile.sha256;
  environment.VIDEO_AI_SEQUENCE_DEVICE = "mps";

  for (const engine of Object.keys(MACOS_SEQUENCE_EXPECTATIONS) as SequenceEngineName[]) {
    try {
      const definition = support.engines;
      if (!isRecord(definition) || !isRecord(definition[engine])) {
        throw new Error("Mac 视频时序支持定义缺少引擎条目");
      }
      const entry = definition[engine];
      const expected = MACOS_SEQUENCE_EXPECTATIONS[engine];
      if (
        entry.repository !== expected.repository ||
        entry.revision !== expected.revision ||
        entry.license !== expected.license ||
        entry.namespace !== expected.namespace ||
        entry.adapterReady !== true ||
        entry.executionMode !== expected.executionMode ||
        !isStringArray(entry.supportedDevices) ||
        entry.supportedDevices.length !== 1 ||
        entry.supportedDevices[0] !== "mps"
      ) {
        throw new Error("Mac 视频引擎尚未通过对应设备与画质验收");
      }
      const root = await validateMacSequenceBundle(base, engine, entry, expected);
      environment[`VIDEO_AI_${engine.toUpperCase()}_ENGINE_ROOT`] = root;
    } catch (error) {
      if (requireBothEngines) throw error;
      environment[`VIDEO_AI_${engine.toUpperCase()}_SEQUENCE_REASON`] =
        error instanceof Error ? error.message : "Mac 视频时序资源校验失败";
    }
  }
  return environment;
}

async function validateMacSequenceBundle(
  base: VerifiedComponentAsset,
  engine: SequenceEngineName,
  definition: Record<string, unknown>,
  expected: (typeof MACOS_SEQUENCE_EXPECTATIONS)[SequenceEngineName]
) {
  const descriptorPath = videoAiSequenceBundle(engine);
  const descriptor = await readJson(base, descriptorPath);
  if (
    descriptor.assetSchemaVersion !== 1 ||
    descriptor.engine !== engine ||
    descriptor.repository !== expected.repository ||
    descriptor.revision !== expected.revision ||
    descriptor.license !== expected.license ||
    descriptor.namespace !== expected.namespace ||
    descriptor.adapterReady !== true
  ) {
    throw new Error("Mac 视频引擎 descriptor 与已验收资源定义不匹配");
  }
  const files = descriptor.files;
  if (!Array.isArray(files) || files.length < 1 || files.length > 128) {
    throw new Error("Mac 视频引擎 descriptor 文件闭包无效");
  }
  const declared = new Map<string, { path: string; role: string; bytes: number; sha256: string }>();
  for (const value of files) {
    if (!isRecord(value)) throw new Error("Mac 视频引擎 descriptor 文件条目无效");
    const { path: relative, role, bytes, sha256 } = value;
    if (
      typeof relative !== "string" ||
      !isSafeRelativePath(relative) ||
      typeof role !== "string" ||
      !Number.isSafeInteger(bytes) ||
      Number(bytes) < 1 ||
      typeof sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(sha256) ||
      declared.has(relative.toLowerCase())
    ) {
      throw new Error("Mac 视频引擎 descriptor 文件闭包字段无效或重复");
    }
    declared.set(relative.toLowerCase(), { path: relative, role, bytes: Number(bytes), sha256 });
  }
  const weights = [...declared.values()]
    .filter((file) => file.role === "weight")
    .map((file) => file.path)
    .sort();
  if (JSON.stringify(weights) !== JSON.stringify([...expected.weights].sort())) {
    throw new Error("Mac 视频引擎权重集合与冻结清单不匹配");
  }
  for (const required of expected.requiredSources) {
    if (declared.get(required.toLowerCase())?.role !== "source") {
      throw new Error("Mac 视频引擎源码闭包不完整");
    }
  }
  if (declared.get("license")?.role !== "license" || declared.get("provenance.json")?.role !== "provenance") {
    throw new Error("Mac 视频引擎缺少许可证或来源 provenance");
  }
  for (const file of declared.values()) {
    const relative = `${path.posix.dirname(descriptorPath)}/${file.path}`;
    const supportWeight =
      file.role === "weight" && Array.isArray(definition.weights)
        ? definition.weights.find((weight) => isRecord(weight) && weight.path === file.path)
        : undefined;
    if (
      supportWeight !== undefined &&
      (!isRecord(supportWeight) ||
        !Number.isSafeInteger(supportWeight.bytes) ||
        Number(supportWeight.bytes) < 1 ||
        Number(supportWeight.bytes) > 200_000_000 ||
        typeof supportWeight.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(supportWeight.sha256))
    ) {
      throw new Error("Mac 视频引擎权重定义无效或超出上限");
    }
    const resolved = await verifiedVideoFile(
      base,
      relative,
      supportWeight && isRecord(supportWeight) ? Number(supportWeight.bytes) : 128 * 1024
    );
    const stat = await fs.stat(resolved);
    const digest = await sha256File(resolved);
    if (
      stat.size !== file.bytes ||
      digest !== file.sha256 ||
      (supportWeight &&
        isRecord(supportWeight) &&
        (stat.size !== supportWeight.bytes || digest !== supportWeight.sha256))
    ) {
      throw new Error("Mac 视频引擎逐文件摘要或大小与 descriptor 不符");
    }
  }

  const provenance = await readJson(base, `${path.posix.dirname(descriptorPath)}/PROVENANCE.json`);
  if (
    provenance.repository !== expected.repository ||
    provenance.revision !== expected.revision ||
    provenance.license !== expected.license
  ) {
    throw new Error("Mac 视频引擎来源 provenance 与固定 revision 不匹配");
  }
  const supportSources = definition.sources;
  const sourceProvenance = provenance.sources;
  if (!Array.isArray(supportSources) || !Array.isArray(sourceProvenance)) {
    throw new Error("Mac 视频引擎来源清单不完整");
  }
  const licenseSource = supportSources.find((source) => isRecord(source) && source.path === "LICENSE");
  const licenseSources = supportSources.filter((source) => isRecord(source) && source.path === "LICENSE");
  const codeSources = supportSources.filter(
    (source): source is Record<string, unknown> => isRecord(source) && source.path !== "LICENSE"
  );
  if (
    !isRecord(licenseSource) ||
    licenseSources.length !== 1 ||
    supportSources.length !== codeSources.length + 1 ||
    declared.get("license")?.sha256 !== licenseSource.sha256 ||
    codeSources.length !== sourceProvenance.length ||
    new Set(codeSources.map((source) => source.path)).size !== codeSources.length
  ) {
    throw new Error("Mac 视频引擎源码与许可证来源清单不完整");
  }
  const expectedBundledSources = new Set<string>();
  for (let index = 0; index < codeSources.length; index += 1) {
    const expectedSource = codeSources[index];
    const source = sourceProvenance[index];
    if (
      !isRecord(source) ||
      typeof expectedSource.path !== "string" ||
      !isSafeRelativePath(expectedSource.path) ||
      typeof expectedSource.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(expectedSource.sha256) ||
      typeof expectedSource.gitBlobSha1 !== "string" ||
      !/^[a-f0-9]{40}$/u.test(expectedSource.gitBlobSha1) ||
      expectedSource.path !== source.path ||
      expectedSource.sha256 !== source.originalSha256 ||
      expectedSource.gitBlobSha1 !== source.gitBlobSha1 ||
      typeof source.bundledSha256 !== "string" ||
      declared.get(`vendor/${source.path}`.toLowerCase())?.sha256 !== source.bundledSha256
    ) {
      throw new Error("Mac 视频引擎源码摘要与冻结来源清单不匹配");
    }
    expectedBundledSources.add(`vendor/${expectedSource.path}`.toLowerCase());
  }
  for (const file of declared.values()) {
    if (
      file.role === "source" &&
      !expectedBundledSources.has(file.path.toLowerCase()) &&
      !/^vendor\/__init__\.py$/u.test(file.path) &&
      !/^vendor\/.+\/__init__\.py$/u.test(file.path)
    ) {
      throw new Error("Mac 视频引擎包含冻结清单以外的源码");
    }
  }
  const supportWeights = definition.weights;
  const provenanceWeights = provenance.weights;
  if (
    !Array.isArray(supportWeights) ||
    !Array.isArray(provenanceWeights) ||
    supportWeights.length !== expected.weights.length ||
    provenanceWeights.length !== supportWeights.length
  ) {
    throw new Error("Mac 视频引擎权重来源清单不完整");
  }
  const normalizedWeights = supportWeights
    .filter(isRecord)
    .map((weight) => {
      if (
        typeof weight.path !== "string" ||
        !isSafeRelativePath(weight.path) ||
        !Number.isSafeInteger(weight.bytes) ||
        Number(weight.bytes) < 1 ||
        Number(weight.bytes) > 200_000_000 ||
        typeof weight.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(weight.sha256)
      ) {
        throw new Error("Mac 视频引擎权重定义无效或超出上限");
      }
      return weight.path;
    })
    .sort();
  if (JSON.stringify(normalizedWeights) !== JSON.stringify([...expected.weights].sort())) {
    throw new Error("Mac 视频引擎权重定义与冻结清单不匹配");
  }
  for (let index = 0; index < supportWeights.length; index += 1) {
    const expectedWeight = supportWeights[index];
    const weight = provenanceWeights[index];
    if (
      !isRecord(expectedWeight) ||
      !isRecord(weight) ||
      expectedWeight.path !== `weights/${String(weight.name)}` ||
      expectedWeight.bytes !== weight.bytes ||
      expectedWeight.sha256 !== weight.sha256 ||
      declared.get(String(expectedWeight.path).toLowerCase())?.sha256 !== expectedWeight.sha256
    ) {
      throw new Error("Mac 视频引擎权重摘要与冻结来源清单不匹配");
    }
  }
  await verifyDeclaredDirectory(base, path.posix.dirname(descriptorPath), declared);
  return path.dirname(await verifiedVideoFile(base, descriptorPath, 128 * 1024));
}

async function verifyDeclaredDirectory(
  base: VerifiedComponentAsset,
  relativeRoot: string,
  declared: Map<string, { path: string }>
) {
  const root = await fs.realpath(path.join(base.generationRoot, ...relativeRoot.split("/")));
  if (!isPathWithin(await fs.realpath(base.generationRoot), root)) throw new Error("Mac 视频引擎目录路径越界");
  const expected = new Set([...declared.keys(), "sequence-bundle.json"]);
  const actual = new Set<string>();
  const visit = async (directory: string, prefix = "") => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Mac 视频引擎闭包不能包含链接");
      if (entry.isDirectory()) {
        await visit(absolute, relative);
      } else if (entry.isFile()) {
        actual.add(relative.toLowerCase());
      } else {
        throw new Error("Mac 视频引擎闭包包含非普通文件");
      }
    }
  };
  await visit(root);
  if (actual.size !== expected.size || [...expected].some((relative) => !actual.has(relative.toLowerCase()))) {
    throw new Error("Mac 视频引擎包含未声明或缺失文件");
  }
}

export function hasVideoAiSequenceAssets(asset: VerifiedComponentAsset) {
  return (
    asset.manifest.files?.some((file) =>
      [videoAiSequenceBundle("sttn"), videoAiSequenceBundle("propainter")].includes(file.path)
    ) === true
  );
}

export async function videoAiSequenceEnvironment(cuda: VerifiedComponentAsset, base: VerifiedComponentAsset) {
  if (!hasVideoAiSequenceAssets(cuda)) return {};
  if (
    cuda.manifest.id !== "video-ai-cuda" ||
    base.manifest.id !== "video-ai" ||
    cuda.manifest.platform !== "win32-x64" ||
    base.manifest.platform !== "win32-x64" ||
    cuda.manifest.pythonEnvironment?.expectedPythonVersion !== "3.12" ||
    base.manifest.pythonEnvironment?.expectedPythonVersion !== "3.12"
  )
    throw new Error("视频时序引擎需要兼容的 Windows Python 3.12 视频基础包");
  await validateVideoAiSequenceSupport(base);
  const roots: Record<string, string> = {};
  for (const engine of ["sttn", "propainter"] as const) {
    const relative = videoAiSequenceBundle(engine);
    const bundle = await readJson(cuda, relative);
    if (
      bundle.assetSchemaVersion !== 1 ||
      bundle.engine !== engine ||
      bundle.namespace !== `toolbox_video_ai_vendor.${engine}`
    )
      throw new Error(`视频 ${engine} 时序资源协议不兼容`);
    roots[`VIDEO_AI_${engine.toUpperCase()}_ENGINE_ROOT`] = path.dirname(
      await verifiedVideoFile(cuda, relative, 128 * 1024)
    );
  }
  return roots;
}

export async function validateVideoAiSequenceSupport(base: VerifiedComponentAsset) {
  const support = await readJson(base, VIDEO_AI_SEQUENCE_SUPPORT);
  if (
    support.assetSchemaVersion !== 1 ||
    support.workerFeature !== "sequence-assets-v1" ||
    support.sequenceRuntime !== 1
  )
    throw new Error("视频基础包不支持当前时序资源协议，请先升级基础包");
  for (const file of VIDEO_AI_SEQUENCE_RUNTIME_FILES) await verifiedVideoFile(base, file);
  return verifiedVideoFile(base, VIDEO_AI_SEQUENCE_LOADER, 128 * 1024);
}

export async function verifiedVideoFile(asset: VerifiedComponentAsset, relative: string, maxBytes = 128 * 1024) {
  if (!isSafeRelativePath(relative)) throw new Error("视频时序资源路径无效");
  const listed = asset.manifest.files?.find((file) => file.path === relative);
  if (!listed) throw new Error(`视频签名清单缺少 ${relative}，请升级或重新安装对应能力包`);
  const root = await fs.realpath(asset.generationRoot);
  const target = await fs.realpath(path.join(root, ...relative.split("/")));
  if (!isPathWithin(root, target)) throw new Error("视频时序资源路径越界");
  const stat = await fs.stat(target);
  if (!stat.isFile() || stat.size > maxBytes || stat.size !== listed.bytes) throw new Error("视频时序资源文件大小不符");
  if ((await sha256File(target)) !== listed.sha256) throw new Error("视频时序资源摘要不符");
  return target;
}

function listedFile(asset: VerifiedComponentAsset, relative: string) {
  const listed = asset.manifest.files?.find((file) => file.path === relative);
  if (!listed) throw new Error(`视频签名清单缺少 ${relative}，请升级或重新安装对应能力包`);
  return listed;
}

async function sha256File(file: string) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

async function readJson(asset: VerifiedComponentAsset, relative: string): Promise<Record<string, unknown>> {
  const decoded: unknown = JSON.parse(await fs.readFile(await verifiedVideoFile(asset, relative), "utf8"));
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("视频时序资源描述无效");
  return decoded as Record<string, unknown>;
}
