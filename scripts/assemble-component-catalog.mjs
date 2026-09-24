/**
 * 中文模块说明：核验内部能力包、归档与 SBOM，并生成后端可嵌入的受信任能力目录。
 */
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalManifest } from "./build-component-package.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const SHA256 = /^[a-f0-9]{64}$/;
const COMPONENT_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export async function assembleComponentCatalog(feedDirectory) {
  const feedRoot = await fs.realpath(feedDirectory);
  const stat = await fs.stat(feedRoot);
  if (!stat.isDirectory()) throw new Error("内部能力包源目录必须是文件夹");
  const manifestPaths = await findManifests(feedRoot);
  const manifests = [];
  const trustedPublicKeys = {};
  const seenIds = new Set();

  for (const manifestPath of manifestPaths) {
    const manifest = await readJson(manifestPath);
    validateCatalogManifest(manifest);
    if (seenIds.has(manifest.id)) throw new Error(`能力目录包含重复 id：${manifest.id}`);
    seenIds.add(manifest.id);

    const keyPath = path.join(feedRoot, "trusted-keys", `${manifest.keyId}.pem`);
    const keyStat = await fs.lstat(keyPath);
    if (!keyStat.isFile() || keyStat.isSymbolicLink()) throw new Error(`能力包 ${manifest.id} 的公钥文件类型无效`);
    const publicKeyPem = await fs.readFile(keyPath, "utf8");
    const publicKey = crypto.createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519" || publicKeyId(publicKey) !== manifest.keyId) {
      throw new Error(`能力包 ${manifest.id} 的受信任公钥 ID 不匹配`);
    }
    if (
      !crypto.verify(
        null,
        Buffer.from(canonicalManifest(manifest)),
        publicKey,
        Buffer.from(manifest.signature, "base64")
      )
    ) {
      throw new Error(`能力包 ${manifest.id} 的 manifest 签名无效`);
    }

    const manifestDirectory = path.dirname(manifestPath);
    await verifyLocalAsset(
      manifest.archive,
      manifestDirectory,
      "能力归档",
      `${manifest.id}-${manifest.version}.tar.gz`
    );
    await verifyLocalAsset(
      manifest.sbom,
      manifestDirectory,
      "SPDX SBOM",
      `${manifest.id}-${manifest.version}.spdx.json`
    );
    trustedPublicKeys[manifest.keyId] = publicKeyPem;
    manifests.push(manifest);
  }

  for (const manifest of manifests) {
    for (const dependencyId of manifest.dependencyIds) {
      if (!seenIds.has(dependencyId)) {
        throw new Error(`能力包 ${manifest.id} 引用了目录中不存在的依赖：${dependencyId}`);
      }
    }
  }
  manifests.sort((left, right) => left.id.localeCompare(right.id));
  return { manifests, trustedPublicKeys };
}

export async function writeGeneratedCatalog(
  feedDirectory,
  outputPath = path.join(REPOSITORY_ROOT, "backend/src/modules/components/catalog.generated.ts")
) {
  const catalog = await assembleComponentCatalog(feedDirectory);
  const resolvedOutput = path.resolve(outputPath);
  const outputDirectory = path.dirname(resolvedOutput);
  await fs.mkdir(outputDirectory, { recursive: true });
  const temporaryPath = `${resolvedOutput}.${crypto.randomUUID()}.partial`;
  const source = [
    "/** 中文模块说明：由 scripts/assemble-component-catalog.mjs 生成；请勿手工编辑。 */",
    'import type { ComponentCatalog } from "./component-manager";',
    "// prettier-ignore",
    `export const packagedComponentCatalog = ${JSON.stringify(catalog, null, 2)} satisfies ComponentCatalog;`,
    ""
  ].join("\n");
  try {
    await fs.writeFile(temporaryPath, source, { flag: "wx" });
    await fs.rename(temporaryPath, resolvedOutput);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
  return { outputPath: resolvedOutput, manifestCount: catalog.manifests.length };
}

async function findManifests(feedRoot) {
  const manifests = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      const stat = await fs.lstat(candidate);
      if (stat.isSymbolicLink()) throw new Error("内部能力包源目录不允许包含符号链接");
      if (entry.isDirectory() && entry.name !== "trusted-keys") await visit(candidate);
      else if (entry.isFile() && entry.name.endsWith(".manifest.json")) manifests.push(candidate);
    }
  }
  await visit(feedRoot);
  if (!manifests.length) throw new Error("内部能力包源目录中没有 manifest");
  return manifests.sort((left, right) => left.localeCompare(right));
}

async function verifyLocalAsset(reference, directory, label, expectedFilename) {
  if (!reference || typeof reference.url !== "string" || !isHttpsUrl(reference.url) || !SHA256.test(reference.sha256)) {
    throw new Error(`${label}链接或摘要无效`);
  }
  const filename = path.basename(new URL(reference.url).pathname);
  if (!filename || filename === "." || filename === ".." || filename !== expectedFilename) {
    throw new Error(`${label}文件名无效`);
  }
  const assetPath = path.join(directory, filename);
  const assetStat = await fs.lstat(assetPath);
  if (assetStat.isSymbolicLink()) throw new Error(`${label}不允许是符号链接`);
  if (!assetStat.isFile() || (await sha256File(assetPath)) !== reference.sha256) {
    throw new Error(`${label}缺失或摘要不匹配：${filename}`);
  }
  if (reference.bytes !== undefined && assetStat.size !== reference.bytes)
    throw new Error(`${label}大小不匹配：${filename}`);
}

function validateCatalogManifest(manifest) {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    manifest.protocolVersion !== 1 ||
    typeof manifest.id !== "string" ||
    !COMPONENT_ID.test(manifest.id) ||
    manifest.moduleId !== manifest.id ||
    typeof manifest.version !== "string" ||
    !SAFE_VERSION.test(manifest.version) ||
    manifest.platform !== "win32-x64" ||
    !["shared", "media", "audio", "image", "archive", "translation"].includes(manifest.groupId) ||
    typeof manifest.displayName !== "string" ||
    !manifest.displayName.trim() ||
    typeof manifest.purpose !== "string" ||
    !manifest.purpose.trim() ||
    !Number.isSafeInteger(manifest.installedBytes) ||
    manifest.installedBytes < 0 ||
    typeof manifest.keyId !== "string" ||
    !/^ed25519-[a-f0-9]{24}$/.test(manifest.keyId) ||
    typeof manifest.signature !== "string" ||
    !manifest.signature
  ) {
    throw new Error("能力目录中存在格式无效的 manifest");
  }
  if (
    !manifest.archive ||
    !Number.isSafeInteger(manifest.archive.bytes) ||
    manifest.archive.bytes < 1 ||
    manifest.archive.format !== "tar.gz" ||
    !manifest.sbom ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    !Array.isArray(manifest.dependencyIds) ||
    manifest.dependencyIds.some((id) => typeof id !== "string" || !COMPONENT_ID.test(id))
  ) {
    throw new Error(`能力包 ${manifest.id} 缺少归档、SBOM 或依赖信息`);
  }
}

function publicKeyId(publicKey) {
  return (
    "ed25519-" +
    crypto
      .createHash("sha256")
      .update(publicKey.export({ format: "der", type: "spki" }))
      .digest("hex")
      .slice(0, 24)
  );
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

async function sha256File(filePath) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`manifest 读取失败：${error.message}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const values = new Map();
    if (args.length % 2 !== 0)
      throw new Error("用法：node scripts/assemble-component-catalog.mjs --feed <目录> [--output <TS 文件>]");
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index];
      const value = args[index + 1];
      if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
      if (!["feed", "output"].includes(key.slice(2))) throw new Error(`未知参数 ${key}`);
      values.set(key.slice(2), value);
    }
    if (!values.has("feed")) throw new Error("缺少参数 --feed");
    const feedDirectory = path.resolve(values.get("feed"));
    const outputPath = values.has("output") ? path.resolve(values.get("output")) : undefined;
    const result = await writeGeneratedCatalog(feedDirectory, outputPath);
    console.log(`已核验并写入 ${result.manifestCount} 个能力包：${result.outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "能力目录组装失败");
    process.exitCode = 1;
  }
}
