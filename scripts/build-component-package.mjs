/**
 * 中文模块说明：从已准备好的 Windows 能力目录生成可复现归档、SPDX SBOM 和 Ed25519 签名清单。
 * 私钥只从调用方指定的安全文件读取，不复制到产物或仓库。
 */
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const require = createRequire(path.join(REPOSITORY_ROOT, "backend", "package.json"));
const tar = require("tar");
const COMPONENT_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_GITHUB_RELEASE_ASSET_BYTES = 2 * 1024 * 1024 * 1024;
const GROUP_IDS = new Set(["shared", "media", "audio", "image", "archive", "translation"]);

export async function buildComponentPackage(options) {
  const definition = await readJson(options.definitionPath, "能力包定义");
  const stageRoot = await fs.realpath(options.stagingDirectory);
  const outputPath = path.resolve(options.outputDirectory);
  const assetUrl = createAssetUrlResolver(options);
  validateDefinition(definition);
  const stageStat = await fs.stat(stageRoot);
  if (!stageStat.isDirectory()) throw new Error("能力目录必须是文件夹");
  await fs.mkdir(outputPath, { recursive: true });
  const outputRoot = await fs.realpath(outputPath);
  if (stageRoot === outputRoot || isPathWithin(stageRoot, outputRoot) || isPathWithin(outputRoot, stageRoot)) {
    throw new Error("能力目录与产物目录不能互相包含");
  }
  const signingKeyPath = await fs.realpath(options.signingKeyPath);
  if (isPathWithin(stageRoot, signingKeyPath)) {
    throw new Error("签名私钥不能位于能力目录中");
  }

  const files = await scanFiles(stageRoot);
  if (!files.length) throw new Error("能力目录为空，拒绝生成空能力包");
  const payloadBytes = files.reduce((total, file) => total + file.bytes, 0);
  if (definition.installedBytes < payloadBytes) {
    throw new Error(`installedBytes (${definition.installedBytes}) 小于解压资产大小 (${payloadBytes})`);
  }
  const additionalGroups = resolveAdditionalArchiveGroups(definition, files);
  const additionalPathSet = new Set(additionalGroups.flatMap((group) => group.files.map((file) => file.path)));
  const archiveGroups = [
    { name: undefined, files: files.filter((file) => !additionalPathSet.has(file.path)) },
    ...additionalGroups
  ];
  if (!archiveGroups[0].files.length) throw new Error("主归档必须至少包含一个文件");

  const pythonEnvironment = await validatePythonEnvironment(definition.pythonEnvironment, stageRoot);
  const privateKey = crypto.createPrivateKey({
    key: await fs.readFile(signingKeyPath),
    format: "pem",
    ...(process.env.COMPONENT_SIGNING_KEY_PASSPHRASE
      ? { passphrase: process.env.COMPONENT_SIGNING_KEY_PASSPHRASE }
      : {})
  });
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("能力包签名密钥必须是 Ed25519 私钥");
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const keyId =
    "ed25519-" +
    crypto
      .createHash("sha256")
      .update(publicKey.export({ format: "der", type: "spki" }))
      .digest("hex")
      .slice(0, 24);

  const artifactDirectory = path.join(outputRoot, definition.id, definition.version);
  if (await pathExists(artifactDirectory)) throw new Error("该能力版本的产物目录已存在，拒绝覆盖");
  const stagingOutput = path.join(outputRoot, `.partial-${definition.id}-${definition.version}-${crypto.randomUUID()}`);
  await fs.mkdir(stagingOutput, { recursive: true });

  try {
    const builtArchives = [];
    for (const group of archiveGroups) {
      const archiveName = `${definition.id}-${definition.version}${group.name ? `-${group.name}` : ""}.tar.gz`;
      const archivePath = path.join(stagingOutput, archiveName);
      await tar.c(
        {
          cwd: stageRoot,
          file: archivePath,
          gzip: { level: 9 },
          mtime: new Date(0),
          portable: true,
          strict: true
        },
        group.files.map((file) => file.path)
      );
      const archiveBytes = (await fs.stat(archivePath)).size;
      if (options.githubReleaseUrl && archiveBytes >= MAX_GITHUB_RELEASE_ASSET_BYTES) {
        throw new Error(`GitHub Release 单个文件必须小于 2 GiB：${archiveName}`);
      }
      builtArchives.push({
        path: archivePath,
        asset: {
          url: assetUrl(archiveName, definition),
          bytes: archiveBytes,
          sha256: await sha256File(archivePath),
          format: "tar.gz",
          ...(additionalGroups.length ? { filePaths: group.files.map((file) => file.path) } : {})
        }
      });
    }
    const mainArchive = builtArchives[0];
    const archiveName = path.basename(mainArchive.path);
    const archiveUrl = mainArchive.asset.url;
    const archiveSha256 = mainArchive.asset.sha256;
    const additionalArchives = builtArchives.slice(1).map(({ asset }) => asset);
    const sbomName = `${definition.id}-${definition.version}.spdx.json`;
    const manifestName = `${definition.id}-${definition.version}.manifest.json`;
    const sbomUrl = assetUrl(sbomName, definition);
    const lockText = pythonEnvironment
      ? await fs.readFile(path.join(stageRoot, ...pythonEnvironment.requirementsLockPath.split("/")), "utf8")
      : "";
    const sbom = createSpdxSbom({ definition, files, archiveUrl, archiveSha256, lockText });
    const sbomText = JSON.stringify(sbom, null, 2) + "\n";
    const sbomPath = path.join(stagingOutput, sbomName);
    await fs.writeFile(sbomPath, sbomText, { flag: "wx" });

    const manifest = {
      protocolVersion: 1,
      id: definition.id,
      moduleId: definition.id,
      groupId: definition.groupId,
      displayName: definition.displayName,
      purpose: definition.purpose,
      dependencyIds: definition.dependencyIds,
      taskToolIds: definition.taskToolIds,
      installConditions: definition.installConditions,
      version: definition.version,
      platform: "win32-x64",
      archive: mainArchive.asset,
      ...(additionalArchives.length ? { additionalArchives } : {}),
      installedBytes: definition.installedBytes,
      files: files.map(({ path: filePath, bytes, sha256 }) => ({ path: filePath, bytes, sha256 })),
      ...(pythonEnvironment ? { pythonEnvironment } : {}),
      ...(definition.license ? { license: definition.license } : {}),
      sbom: { url: sbomUrl, sha256: sha256Text(sbomText) },
      keyId,
      signature: ""
    };
    manifest.signature = crypto.sign(null, Buffer.from(canonicalManifest(manifest)), privateKey).toString("base64");
    const manifestPath = path.join(stagingOutput, manifestName);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });

    const keyDirectory = path.join(outputRoot, "trusted-keys");
    const keyDirectoryStat = await fs.lstat(keyDirectory).catch((error) => {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    });
    if (keyDirectoryStat?.isSymbolicLink() || (keyDirectoryStat && !keyDirectoryStat.isDirectory())) {
      throw new Error("trusted-keys 必须是普通目录");
    }
    await fs.mkdir(keyDirectory, { recursive: true });
    const publicKeyPath = path.join(keyDirectory, `${keyId}.pem`);
    const publicKeyStat = await fs.lstat(publicKeyPath).catch((error) => {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    });
    if (publicKeyStat?.isSymbolicLink() || (publicKeyStat && !publicKeyStat.isFile())) {
      throw new Error(`keyId ${keyId} 公钥目标不是普通文件`);
    }
    const existingKey = publicKeyStat ? await fs.readFile(publicKeyPath, "utf8") : undefined;
    if (existingKey !== undefined && existingKey !== publicKeyPem) {
      throw new Error(`keyId ${keyId} 已存在但公钥内容不匹配`);
    }
    if (existingKey === undefined) await fs.writeFile(publicKeyPath, publicKeyPem, { flag: "wx" });

    await fs.mkdir(path.dirname(artifactDirectory), { recursive: true });
    await fs.rename(stagingOutput, artifactDirectory);
    return {
      artifactDirectory,
      archivePath: path.join(artifactDirectory, archiveName),
      manifestPath: path.join(artifactDirectory, manifestName),
      sbomPath: path.join(artifactDirectory, sbomName),
      publicKeyPath,
      keyId,
      archiveBytes: mainArchive.asset.bytes,
      archivePaths: builtArchives.map(({ path: filePath }) => path.join(artifactDirectory, path.basename(filePath))),
      additionalArchivePaths: builtArchives
        .slice(1)
        .map(({ path: filePath }) => path.join(artifactDirectory, path.basename(filePath))),
      fileCount: files.length
    };
  } finally {
    await fs.rm(stagingOutput, { recursive: true, force: true });
  }
}

export function canonicalManifest(manifest) {
  const { signature: _signature, ...unsigned } = manifest;
  return stableStringify(unsigned);
}

function validateDefinition(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("能力包定义必须是 JSON 对象");
  if (typeof value.id !== "string" || !COMPONENT_ID.test(value.id) || !GROUP_IDS.has(value.groupId)) {
    throw new Error("能力包 id 或 groupId 无效");
  }
  if (typeof value.version !== "string" || !SAFE_VERSION.test(value.version)) throw new Error("能力包 version 无效");
  if (typeof value.displayName !== "string" || !value.displayName.trim()) throw new Error("displayName 不能为空");
  if (typeof value.purpose !== "string" || !value.purpose.trim()) throw new Error("purpose 不能为空");
  if (!Number.isSafeInteger(value.installedBytes) || value.installedBytes < 0) {
    throw new Error("installedBytes 必须是非负安全整数");
  }
  for (const field of ["dependencyIds", "taskToolIds", "installConditions"]) {
    if (!Array.isArray(value[field])) throw new Error(`${field} 必须是数组`);
  }
  if (
    value.dependencyIds.some((id) => typeof id !== "string" || !COMPONENT_ID.test(id)) ||
    value.taskToolIds.some((id) => typeof id !== "string" || !COMPONENT_ID.test(id)) ||
    value.dependencyIds.includes(value.id) ||
    new Set(value.dependencyIds).size !== value.dependencyIds.length ||
    new Set(value.taskToolIds).size !== value.taskToolIds.length ||
    value.installConditions.some(
      (condition) => typeof condition !== "string" || !condition.trim() || condition.length > 300
    )
  ) {
    throw new Error("依赖、任务或安装条件列表无效");
  }
  if (value.additionalArchives !== undefined) {
    if (
      !Array.isArray(value.additionalArchives) ||
      !value.additionalArchives.length ||
      value.additionalArchives.length > 16
    ) {
      throw new Error("additionalArchives 必须是 1 到 16 个分片定义");
    }
    const names = new Set();
    const paths = new Set();
    for (const group of value.additionalArchives) {
      if (
        !group ||
        typeof group.name !== "string" ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(group.name) ||
        names.has(group.name) ||
        !Array.isArray(group.paths) ||
        !group.paths.length ||
        group.paths.some((filePath) => typeof filePath !== "string" || !isSafeRelativePath(filePath))
      ) {
        throw new Error("additionalArchives 分片定义无效");
      }
      names.add(group.name);
      for (const filePath of group.paths) {
        if (paths.has(filePath)) throw new Error(`additionalArchives 文件重复分配：${filePath}`);
        paths.add(filePath);
      }
    }
  }
  if (
    value.license !== undefined &&
    (!value.license ||
      typeof value.license.name !== "string" ||
      !value.license.name.trim() ||
      (value.license.url !== undefined && !isHttpsUrl(value.license.url)))
  ) {
    throw new Error("可选 license 元数据格式无效");
  }
  if (value.pythonEnvironment !== undefined) {
    const environment = value.pythonEnvironment;
    if (
      !environment ||
      !["3.11", "3.12"].includes(environment.expectedPythonVersion) ||
      (environment.pythonComponentId !== undefined &&
        (typeof environment.pythonComponentId !== "string" ||
          !COMPONENT_ID.test(environment.pythonComponentId) ||
          !value.dependencyIds.includes(environment.pythonComponentId))) ||
      !isSimpleRelativePath(environment.pythonExecutablePath) ||
      !isSimpleRelativePath(environment.wheelhousePath) ||
      !isSimpleRelativePath(environment.requirementsLockPath)
    ) {
      throw new Error("pythonEnvironment 声明无效");
    }
  }
}

function resolveAdditionalArchiveGroups(definition, files) {
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  return (definition.additionalArchives ?? []).map((group) => ({
    name: group.name,
    files: group.paths.map((filePath) => {
      const file = fileByPath.get(filePath);
      if (!file) throw new Error(`additionalArchives 引用了暂存目录中不存在的文件：${filePath}`);
      return file;
    })
  }));
}

async function validatePythonEnvironment(environment, stageRoot) {
  if (!environment) return undefined;
  const python = environment.pythonComponentId
    ? undefined
    : await resolveStagedAsset(stageRoot, environment.pythonExecutablePath, "Python 解释器");
  const wheelhouse = await resolveStagedAsset(stageRoot, environment.wheelhousePath, "wheelhouse");
  const lock = await resolveStagedAsset(stageRoot, environment.requirementsLockPath, "Python 锁文件");
  if (
    (python && !(await fs.stat(python)).isFile()) ||
    !(await fs.stat(wheelhouse)).isDirectory() ||
    !(await fs.stat(lock)).isFile()
  ) {
    throw new Error("Python 环境资产类型无效");
  }
  return {
    ...(environment.pythonComponentId ? { pythonComponentId: environment.pythonComponentId } : {}),
    pythonExecutablePath: environment.pythonExecutablePath,
    wheelhousePath: environment.wheelhousePath,
    requirementsLockPath: environment.requirementsLockPath,
    requirementsLockSha256: await sha256File(lock),
    expectedPythonVersion: environment.expectedPythonVersion
  };
}

async function resolveStagedAsset(stageRoot, relativePath, label) {
  if (!isSimpleRelativePath(relativePath)) throw new Error(`${label}路径不安全`);
  const candidate = path.resolve(stageRoot, ...relativePath.split("/"));
  if (!isPathWithin(stageRoot, candidate)) throw new Error(`${label}路径越界`);
  const resolved = await fs.realpath(candidate);
  if (!isPathWithin(stageRoot, resolved)) throw new Error(`${label}符号链接越界`);
  return resolved;
}

async function scanFiles(root) {
  const files = [];
  async function visit(directory, relativeDirectory) {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name)
    )) {
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (!isSafeRelativePath(relative)) throw new Error(`能力目录包含不安全路径：${relative}`);
      const fullPath = path.join(directory, entry.name);
      const stat = await fs.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error(`能力目录不允许包含符号链接：${relative}`);
      if (stat.isDirectory()) await visit(fullPath, relative);
      else if (stat.isFile())
        files.push({ path: relative, fullPath, bytes: stat.size, sha256: await sha256File(fullPath) });
      else throw new Error(`能力目录包含非普通文件：${relative}`);
    }
  }
  await visit(root, "");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function createSpdxSbom({ definition, files, archiveUrl, archiveSha256, lockText }) {
  const timestamp = Number(process.env.SOURCE_DATE_EPOCH ?? "0");
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 8_640_000_000_000) {
    throw new Error("SOURCE_DATE_EPOCH 必须是有效的非负时间戳");
  }
  const created = new Date(timestamp * 1000).toISOString().replace(".000Z", "Z");
  const rootPackageId = "SPDXRef-Package-Root";
  const spdxFiles = files.map((file, index) => ({
    fileName: `./${file.path}`,
    SPDXID: `SPDXRef-File-${index + 1}`,
    checksums: [{ algorithm: "SHA256", checksumValue: file.sha256 }],
    licenseConcluded: "NOASSERTION",
    licenseInfoInFiles: ["NOASSERTION"],
    copyrightText: "NOASSERTION"
  }));
  const sbomPackages = [];
  const relationships = spdxFiles.map((file) => ({
    spdxElementId: rootPackageId,
    relationshipType: "CONTAINS",
    relatedSpdxElement: file.SPDXID
  }));
  if (lockText) {
    for (const match of lockText.matchAll(/^([A-Za-z0-9][A-Za-z0-9_.-]*)==([^\s\\]+)\s*\\?\s*$/gm)) {
      const packageId = `SPDXRef-Python-${sbomPackages.length + 1}`;
      sbomPackages.push({
        name: match[1],
        SPDXID: packageId,
        versionInfo: match[2],
        downloadLocation: "NOASSERTION",
        filesAnalyzed: false,
        licenseConcluded: "NOASSERTION",
        licenseDeclared: "NOASSERTION",
        copyrightText: "NOASSERTION"
      });
      relationships.push({
        spdxElementId: rootPackageId,
        relationshipType: "DEPENDS_ON",
        relatedSpdxElement: packageId
      });
    }
  }
  const documentNamespace = `https://spdx.org/spdxdocs/${definition.id}-${definition.version}-${archiveSha256}`;
  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${definition.id}-${definition.version}`,
    documentNamespace,
    creationInfo: { creators: ["Tool: Toolbox Component Packager"], created },
    packages: [
      {
        name: `${definition.id}-windows-x64`,
        SPDXID: rootPackageId,
        versionInfo: definition.version,
        downloadLocation: archiveUrl,
        filesAnalyzed: true,
        packageFileName: path.posix.basename(archiveUrl),
        checksums: [{ algorithm: "SHA256", checksumValue: archiveSha256 }],
        licenseConcluded: "NOASSERTION",
        licenseDeclared: "NOASSERTION",
        copyrightText: "NOASSERTION"
      },
      ...sbomPackages
    ],
    files: spdxFiles,
    relationships: [
      { spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES", relatedSpdxElement: rootPackageId },
      ...relationships
    ]
  };
}

function parseBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("asset base URL 无效");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("asset base URL 必须是无凭据、无查询参数的 HTTPS 地址");
  }
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  return parsed;
}

function parseGitHubReleaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("GitHub Release URL 无效");
  }
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com" || parsed.port) {
    throw new Error("GitHub Release URL 必须是 github.com 上的 HTTPS 发布资产目录");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("GitHub Release URL 不得包含凭据、查询参数或片段");
  }
  const segments = parsed.pathname.split("/");
  if (segments[0] === "") segments.shift();
  if (segments.at(-1) === "") segments.pop();
  if (
    segments.length !== 5 ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(segments[0]) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(segments[1]) ||
    segments[2] !== "releases" ||
    segments[3] !== "download" ||
    !SAFE_VERSION.test(segments[4])
  ) {
    throw new Error("GitHub Release URL 格式必须为 https://github.com/<owner>/<repo>/releases/download/<固定 tag>/");
  }
  parsed.pathname = `/${segments.join("/")}/`;
  return parsed;
}

function createAssetUrlResolver(options) {
  const hasAssetBaseUrl = typeof options.assetBaseUrl === "string" && options.assetBaseUrl.length > 0;
  const hasGitHubReleaseUrl = typeof options.githubReleaseUrl === "string" && options.githubReleaseUrl.length > 0;
  if (hasAssetBaseUrl === hasGitHubReleaseUrl) {
    throw new Error("必须且只能指定 --asset-base-url 或 --github-release-url 其中之一");
  }
  if (hasAssetBaseUrl) {
    const baseUrl = parseBaseUrl(options.assetBaseUrl);
    return (filename, definition) => new URL(`${definition.id}/${definition.version}/${filename}`, baseUrl).href;
  }
  const releaseUrl = parseGitHubReleaseUrl(options.githubReleaseUrl);
  // GitHub Release 资产名不能包含目录；模块 ID 和版本已编码在文件名中，避免同一 Release 冲突。
  return (filename) => new URL(filename, releaseUrl).href;
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function isSimpleRelativePath(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
    !value.includes("\\") &&
    !value.split("/").some((part) => part === ".." || part === "." || part === "")
  );
}

function isSafeRelativePath(value) {
  if (!value || value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const segments = value.split("/");
  return (
    path.posix.normalize(value) === value &&
    !segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes(":") ||
        segment.split("").some((character) => character.charCodeAt(0) < 32)
    )
  );
}

function isPathWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function stableStringify(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Manifest contains an unsupported value");
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label}读取失败：${error.message}`);
  }
}

async function sha256File(filePath) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function pathExists(candidate) {
  return fs.access(candidate).then(
    () => true,
    () => false
  );
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  const signingKeyPath = values.get("signing-key-file") || process.env.COMPONENT_SIGNING_KEY_FILE;
  for (const required of ["definition", "stage", "output"]) {
    if (!values.has(required)) throw new Error(`缺少参数 --${required}`);
  }
  if (values.has("asset-base-url") === values.has("github-release-url")) {
    throw new Error("必须且只能指定 --asset-base-url 或 --github-release-url 其中之一");
  }
  if (!signingKeyPath) throw new Error("请通过 --signing-key-file 或 COMPONENT_SIGNING_KEY_FILE 提供内部签名私钥");
  const allowed = new Set([
    "definition",
    "stage",
    "output",
    "asset-base-url",
    "github-release-url",
    "signing-key-file"
  ]);
  for (const key of values.keys()) if (!allowed.has(key)) throw new Error(`未知参数 --${key}`);
  return {
    definitionPath: path.resolve(values.get("definition")),
    stagingDirectory: path.resolve(values.get("stage")),
    outputDirectory: path.resolve(values.get("output")),
    ...(values.has("asset-base-url") ? { assetBaseUrl: values.get("asset-base-url") } : {}),
    ...(values.has("github-release-url") ? { githubReleaseUrl: values.get("github-release-url") } : {}),
    signingKeyPath: path.resolve(signingKeyPath)
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildComponentPackage(parseArguments(process.argv.slice(2)));
    console.log(`能力包已生成：${result.artifactDirectory}`);
    console.log(`归档：${result.archiveBytes} bytes；${result.fileCount} 个文件；受信任密钥 ID：${result.keyId}`);
    console.log(`清单：${result.manifestPath}`);
    console.log(`SBOM：${result.sbomPath}`);
    console.log(`公钥：${result.publicKeyPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "能力包生成失败");
    process.exitCode = 1;
  }
}
