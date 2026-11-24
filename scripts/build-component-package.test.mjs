/**
 * 中文模块说明：测试能力包构建产物的签名、文件摘要、SBOM 和可复现归档。
 */
import { strict as assert } from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { after, describe, it } from "node:test";
import {
  buildComponentPackage,
  canonicalManifest,
  componentArchiveFileName,
  componentManifestFileName,
  componentSbomFileName
} from "./build-component-package.mjs";
import {
  assembleComponentCatalog,
  assertCompleteMacCatalog,
  MACOS_COMPONENT_IDS,
  writeGeneratedCatalog
} from "./assemble-component-catalog.mjs";
import { preparePython311Runtime } from "./prepare-python-311-runtime.mjs";

const repositoryRoot = process.cwd();
const HOST_PLATFORM = process.platform === "darwin" ? "darwin-arm64" : "win32-x64";
const IS_MACOS = HOST_PLATFORM === "darwin-arm64";
const require = createRequire(path.join(repositoryRoot, "apps", "api", "package.json"));
const tar = require("tar");
const temporaryRoots = [];

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-component-package-"));
  temporaryRoots.push(root);
  return root;
}

async function createSigningKey(root) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyPath = path.join(root, "component-signing-private.pem");
  await fs.writeFile(privateKeyPath, privateKey.export({ format: "pem", type: "pkcs8" }));
  return { privateKeyPath, publicKey };
}

function definition(overrides = {}) {
  return {
    id: "edge-tts",
    groupId: "audio",
    displayName: "Edge-TTS",
    purpose: "在线自然配音",
    dependencyIds: [],
    taskToolIds: ["edge-tts"],
    installConditions: ["生成语音时需要联网"],
    platform: HOST_PLATFORM,
    version: "1.0.0",
    installedBytes: 4096,
    ...overrides
  };
}

async function writeDefinition(root, value) {
  const definitionPath = path.join(root, "definition.json");
  await fs.writeFile(definitionPath, JSON.stringify(value));
  return definitionPath;
}

after(async () => {
  await Promise.all(temporaryRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("buildComponentPackage", () => {
  it("defines exactly ten independent Mac packages with a closed Python 3.12 dependency graph", async () => {
    const definitionsDirectory = path.join(repositoryRoot, "scripts/component-definitions/macos");
    const definitions = await Promise.all(
      MACOS_COMPONENT_IDS.map(async (id) =>
        JSON.parse(await fs.readFile(path.join(definitionsDirectory, `${id}.json`), "utf8"))
      )
    );
    assert.deepEqual(definitions.map((item) => item.id).sort(), [...MACOS_COMPONENT_IDS].sort());
    for (const item of definitions) {
      assert.equal(item.platform, "darwin-arm64", item.id);
      assert.match(item.version, /darwin-arm64/u, item.id);
      assert.ok(!item.dependencyIds.includes("python-311"), item.id);
      if (item.pythonEnvironment) {
        assert.equal(item.pythonEnvironment.pythonComponentId, "python-312", item.id);
        assert.equal(item.pythonEnvironment.expectedPythonVersion, "3.12", item.id);
        assert.equal(item.pythonEnvironment.pythonExecutablePath, "python/bin/python3.12", item.id);
      }
    }
    const video = definitions.find((item) => item.id === "video-ai");
    assert.equal(video.pythonEnvironment.pythonComponentId, "python-312");
    assert.match(video.license.name, /S-Lab-1\.0/u);
    assert.match(video.license.name, /non-commercial/u);
    assert.equal(assertCompleteMacCatalog({ manifests: MACOS_COMPONENT_IDS.map((id) => ({ id })) }), undefined);
    assert.equal(
      assertCompleteMacCatalog({
        manifests: [...MACOS_COMPONENT_IDS, "video-interpolation"].map((id) => ({ id }))
      }),
      undefined
    );
    assert.throws(() => assertCompleteMacCatalog({ manifests: [{ id: "python-311" }] }), /必须包含十项基础能力/u);
  });

  it("keeps Windows asset names unchanged and isolates Mac asset names", () => {
    assert.equal(componentArchiveFileName("edge-tts", "1.0.0", "win32-x64"), "edge-tts-1.0.0.tar.gz");
    assert.equal(
      componentArchiveFileName("edge-tts", "1.0.0", "win32-x64", "voice-model"),
      "edge-tts-1.0.0-voice-model.tar.gz"
    );
    assert.equal(componentManifestFileName("edge-tts", "1.0.0", "win32-x64"), "edge-tts-1.0.0.manifest.json");
    assert.equal(componentSbomFileName("edge-tts", "1.0.0", "win32-x64"), "edge-tts-1.0.0.spdx.json");
    assert.equal(componentArchiveFileName("edge-tts", "1.0.0", "darwin-arm64"), "edge-tts-1.0.0-darwin-arm64.tar.gz");
    assert.equal(
      componentArchiveFileName("edge-tts", "1.0.0", "darwin-arm64", "voice-model"),
      "edge-tts-1.0.0-voice-model-darwin-arm64.tar.gz"
    );
    assert.equal(
      componentManifestFileName("edge-tts", "1.0.0", "darwin-arm64"),
      "edge-tts-1.0.0-darwin-arm64.manifest.json"
    );
    assert.equal(
      componentManifestFileName("edge-tts", "1.0.0", "darwin-arm64", true),
      "edge-tts-1.0.0-darwin-arm64.review.json"
    );
    assert.equal(componentSbomFileName("edge-tts", "1.0.0", "darwin-arm64"), "edge-tts-1.0.0-darwin-arm64.spdx.json");
  });

  it("refuses cross-platform builds and blocks non-Mac files from Apple Silicon manifests", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(stage);
    await fs.writeFile(path.join(stage, "worker.py"), "fixture");
    const definitionPath = await writeDefinition(root, definition());
    const otherPlatform = IS_MACOS ? "win32-x64" : "darwin-arm64";
    await assert.rejects(
      buildComponentPackage({
        definitionPath,
        stagingDirectory: stage,
        outputDirectory: path.join(root, "wrong-host"),
        assetBaseUrl: "https://packages.example.test/",
        platform: otherPlatform
      }),
      /原生构建机/u
    );
    if (IS_MACOS) {
      const invalidPaths = [
        ["legacy.dll", /Windows 文件/u],
        ["legacy.exe", /Windows 文件/u],
        ["wheelhouse/native-win_amd64.whl", /Windows 文件/u],
        ["Users/build-host/job/worker.py", /构建机绝对路径/u]
      ];
      for (const [relativePath, expectedError] of invalidPaths) {
        const fullPath = path.join(stage, relativePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, "not a Mac asset");
        await assert.rejects(
          buildComponentPackage({
            definitionPath,
            stagingDirectory: stage,
            outputDirectory: path.join(root, `mac-feed-${path.basename(relativePath)}`),
            assetBaseUrl: "https://packages.example.test/",
            reviewOnly: true
          }),
          expectedError
        );
        await fs.unlink(fullPath);
      }
      const pythonStdlibPath = path.join(stage, "python/lib/python3.12/multiprocessing/popen_spawn_win32.py");
      await fs.mkdir(path.dirname(pythonStdlibPath), { recursive: true });
      await fs.writeFile(pythonStdlibPath, "# Windows-only stdlib implementation, inert on macOS.\n");
      const accepted = await buildComponentPackage({
        definitionPath,
        stagingDirectory: stage,
        outputDirectory: path.join(root, "mac-feed-python-stdlib"),
        assetBaseUrl: "https://packages.example.test/",
        reviewOnly: true
      });
      assert.ok(await fs.stat(accepted.reviewPath));

      const key = await createSigningKey(root);
      await buildComponentPackage({
        definitionPath,
        stagingDirectory: stage,
        outputDirectory: path.join(root, "mac-feed-python-stdlib-signed"),
        assetBaseUrl: "https://packages.example.test/",
        signingKeyPath: key.privateKeyPath
      });
      assert.equal(
        (await assembleComponentCatalog(path.join(root, "mac-feed-python-stdlib-signed"), HOST_PLATFORM)).manifests
          .length,
        1
      );
    }
  });

  it("signs the five pinned Chromium framework links separately from the regular-file archive", async () => {
    if (!IS_MACOS) return;
    const root = await makeRoot();
    const stage = path.join(root, "chromium-stage");
    const appPath = "browser/Google Chrome for Testing.app";
    const policy = JSON.parse(
      await fs.readFile(path.join(repositoryRoot, "tooling/components/macos/chromium-framework-links.json"), "utf8")
    );
    const framework = path.posix.join(appPath, policy.frameworkPath);
    const current = policy.links.find((link) => link.path.endsWith("/Versions/Current"))?.target;
    assert.ok(current);
    const versionRoot = path.posix.join(framework, "Versions", current);
    const stagedPaths = [
      `${versionRoot}/Resources/resource.dat`,
      `${versionRoot}/Libraries/library.dylib`,
      `${versionRoot}/Helpers/helper`,
      `${versionRoot}/Google Chrome for Testing Framework`
    ];
    await fs.mkdir(stage, { recursive: true });
    for (const relativePath of stagedPaths) {
      const fullPath = path.join(stage, ...relativePath.split("/"));
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, `fixture:${relativePath}`);
    }
    for (const link of policy.links) {
      const fullPath = path.join(stage, appPath, ...link.path.split("/"));
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.symlink(link.target, fullPath);
    }

    const key = await createSigningKey(root);
    const artifact = await buildComponentPackage({
      definitionPath: path.join(repositoryRoot, "scripts/component-definitions/macos/xhs-browser.json"),
      stagingDirectory: stage,
      outputDirectory: path.join(root, "signed-feed"),
      assetBaseUrl: "https://packages.example.test/components/",
      signingKeyPath: key.privateKeyPath
    });
    const manifest = JSON.parse(await fs.readFile(artifact.manifestPath, "utf8"));
    const sbom = JSON.parse(await fs.readFile(artifact.sbomPath, "utf8"));
    assert.equal(manifest.links.length, 5);
    assert.deepEqual(
      manifest.links,
      policy.links
        .map((link) => ({ path: path.posix.join(appPath, link.path), target: link.target }))
        .sort((left, right) => left.path.localeCompare(right.path))
    );
    assert.equal(
      crypto.verify(
        null,
        Buffer.from(canonicalManifest(manifest)),
        key.publicKey,
        Buffer.from(manifest.signature, "base64")
      ),
      true
    );
    const archiveEntries = [];
    await tar.t({ file: artifact.archivePath, onReadEntry: (entry) => archiveEntries.push(entry.type) });
    assert.ok(archiveEntries.length >= stagedPaths.length);
    assert.ok(archiveEntries.every((type) => type === "File" || type === "Directory"));
    assert.equal(sbom.files.length, stagedPaths.length + policy.links.length);
    assert.ok(sbom.files.filter((file) => file.fileTypes?.includes("OTHER")).length === policy.links.length);

    const extraLink = path.join(stage, "unexpected-link");
    await fs.symlink("outside", extraLink);
    await assert.rejects(
      buildComponentPackage({
        definitionPath: path.join(repositoryRoot, "scripts/component-definitions/macos/xhs-browser.json"),
        stagingDirectory: stage,
        outputDirectory: path.join(root, "rejected-feed"),
        assetBaseUrl: "https://packages.example.test/components/",
        reviewOnly: true
      }),
      /未允许的符号链接/u
    );
  });

  it("does not package Mac video engines before their frozen support definition exists", async () => {
    if (!IS_MACOS) return;
    const root = await makeRoot();
    const stage = path.join(root, "video-stage");
    await fs.mkdir(stage);
    await assert.rejects(
      buildComponentPackage({
        definitionPath: path.join(repositoryRoot, "scripts/component-definitions/macos/video-ai.json"),
        stagingDirectory: stage,
        outputDirectory: path.join(root, "video-feed"),
        assetBaseUrl: "https://packages.example.test/",
        reviewOnly: true
      }),
      /缺少 M01 冻结的 MPS 支持定义/u
    );
  });

  it("creates non-installable review archives and SBOM without a key, trusted key directory or signed manifest", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(stage);
    await fs.writeFile(path.join(stage, "worker.py"), "review fixture");
    const options = {
      definitionPath: await writeDefinition(root, definition()),
      stagingDirectory: stage,
      outputDirectory: path.join(root, "review"),
      assetBaseUrl: "https://example.invalid/review/",
      reviewOnly: true
    };
    const result = await buildComponentPackage(options);
    const review = JSON.parse(await fs.readFile(result.reviewPath, "utf8"));
    assert.equal(review.reviewFormat, "toolbox-component-review-v1");
    assert.equal(review.installable, false);
    assert.equal(review.requiresSignature, true);
    assert.equal(review.protocolVersion, undefined);
    for (const field of ["signature", "keyId", "protocolVersion"]) assert.equal(review.candidate[field], undefined);
    assert.equal(result.manifestPath, undefined);
    assert.equal(result.publicKeyPath, undefined);
    await assert.rejects(fs.access(path.join(options.outputDirectory, "trusted-keys")), { code: "ENOENT" });
    assert.ok(!(await fs.readdir(result.artifactDirectory)).some((file) => file.endsWith(".manifest.json")));
    const contents = [];
    await tar.t({ file: result.archivePath, onReadEntry: (entry) => contents.push(entry.path) });
    assert.deepEqual(contents, ["worker.py"]);
    const sbom = JSON.parse(await fs.readFile(result.sbomPath, "utf8"));
    assert.equal(sbom.spdxVersion, "SPDX-2.3");
    assert.equal(sbom.files.length, 1);
    await assert.rejects(buildComponentPackage(options), /已存在/);
    await assert.rejects(
      buildComponentPackage({ ...options, signingKeyPath: path.join(root, "must-not-read.pem") }),
      /不接受签名密钥/
    );
  });

  it("merges verified existing entries without downloading old assets, while checking all new assets", async () => {
    const root = await makeRoot(),
      key = await createSigningKey(root);
    const stage = path.join(root, "stage");
    await fs.mkdir(stage);
    await fs.writeFile(path.join(stage, "worker.py"), "signed fixture");
    const feed = path.join(root, "feed"),
      baseline = path.join(root, "baseline.ts"),
      output = path.join(root, "merged.ts");
    const build = (id) =>
      buildComponentPackage({
        definitionPath: path.join(root, `${id}.json`),
        stagingDirectory: stage,
        outputDirectory: feed,
        signingKeyPath: key.privateKeyPath,
        assetBaseUrl: "https://packages.example.test/"
      });
    await fs.writeFile(path.join(root, "base.json"), JSON.stringify(definition({ id: "base" })));
    const old = await build("base");
    await writeTestCatalog(feed, baseline);
    await fs.unlink(old.archivePath);
    await fs.writeFile(
      path.join(root, "extension.json"),
      JSON.stringify(definition({ id: "extension", dependencyIds: ["base"] }))
    );
    const added = await build("extension");
    await assert.rejects(assembleComponentCatalog(feed), /ENOENT/);
    assert.equal((await writeTestCatalog(feed, output, undefined, baseline)).manifestCount, 2);
    const original = await fs.readFile(output, "utf8");
    await fs.appendFile(added.archivePath, "corrupt");
    await assert.rejects(writeTestCatalog(feed, output, undefined, baseline), /摘要不匹配/);
    assert.equal(await fs.readFile(output, "utf8"), original);
    const tamperedBase = (await fs.readFile(baseline, "utf8")).replace(
      '"purpose": "在线自然配音"',
      '"purpose": "changed"'
    );
    await fs.writeFile(path.join(root, "bad-base.ts"), tamperedBase);
    await assert.rejects(writeTestCatalog(feed, output, undefined, path.join(root, "bad-base.ts")), /签名无效/);
    await fs.writeFile(path.join(root, "not-generated.ts"), "process.exit(99)");
    await assert.rejects(writeTestCatalog(feed, output, undefined, path.join(root, "not-generated.ts")), /标准生成/);
  });
  it("the Python 3.12 catalog gate verifies real signatures and preserves output when legacy Python remains", async () => {
    const root = await makeRoot();
    const key = await createSigningKey(root);
    const output = path.join(root, "catalog.ts");
    await fs.writeFile(output, "existing trusted catalog");
    for (const id of IS_MACOS ? ["python-312"] : ["python-311", "python-312"]) {
      const stage = path.join(root, `stage-${id}`);
      await fs.mkdir(stage);
      await fs.writeFile(path.join(stage, "runtime.txt"), "signed runtime fixture");
      const feed = path.join(root, `feed-${id}`);
      await buildComponentPackage({
        definitionPath: await writeDefinition(
          root,
          definition({
            id,
            groupId: "shared",
            taskToolIds: [],
            ...(IS_MACOS ? { version: "3.12.14-darwin-arm64.1" } : {})
          })
        ),
        stagingDirectory: stage,
        outputDirectory: feed,
        assetBaseUrl: "https://packages.example.test/components/",
        signingKeyPath: key.privateKeyPath
      });
      if (id === "python-311") {
        await assert.rejects(writeTestCatalog(feed, output, "3.12"), /旧 python-311/);
        assert.equal(await fs.readFile(output, "utf8"), "existing trusted catalog");
      } else {
        const result = await writeTestCatalog(feed, output, "3.12");
        assert.equal(result.manifestCount, 1);
        assert.match(await fs.readFile(output, "utf8"), /python-312/);
      }
    }
  });

  it("抖音匿名能力从真实分发模板生成签名与 SBOM，不重复打包浏览器", async () => {
    const root = await makeRoot();
    const key = await createSigningKey(root);
    const result = await buildComponentPackage({
      definitionPath: path.join(
        repositoryRoot,
        IS_MACOS
          ? "scripts/component-definitions/macos/douyin-archive.json"
          : "scripts/component-definitions/douyin-archive.json"
      ),
      stagingDirectory: path.join(repositoryRoot, "packaging/components/douyin-archive"),
      outputDirectory: path.join(root, "feed"),
      signingKeyPath: key.privateKeyPath,
      githubReleaseUrl: "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/"
    });
    const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
    assert.equal(manifest.id, "douyin-archive");
    assert.deepEqual(manifest.dependencyIds, ["xhs-browser"]);
    assert.deepEqual(
      manifest.files.map((file) => file.path),
      ["adapter/manifest.json"]
    );
    assert.equal(manifest.pythonEnvironment, undefined);
    assert.equal(
      crypto.verify(
        null,
        Buffer.from(canonicalManifest(manifest)),
        key.publicKey,
        Buffer.from(manifest.signature, "base64")
      ),
      true
    );
    const sbom = JSON.parse(await fs.readFile(result.sbomPath, "utf8"));
    assert.equal(sbom.files.length, 1);
    assert.equal(sbom.files[0].fileName, "./adapter/manifest.json");
    assert.ok((await fs.stat(result.archivePath)).size < 4096);
  });
  it("rejects an unpinned Python runtime archive before creating a staging directory", async () => {
    const root = await makeRoot();
    const archivePath = path.join(root, "python-runtime.tar.gz");
    const stagingDirectory = path.join(root, "python-stage");
    await fs.writeFile(archivePath, "not the pinned Python runtime");

    await assert.rejects(preparePython311Runtime({ archivePath, stagingDirectory }), /归档大小不匹配/);
    await assert.rejects(fs.access(stagingDirectory), { code: "ENOENT" });
  });

  it("creates a deterministic archive, signed manifest, public key and SPDX inventory", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(path.join(stage, "scripts"), { recursive: true });
    const workerPath = path.join(stage, "scripts", "edge-tts-generate.py");
    await fs.writeFile(workerPath, "print('ready')\n");
    const key = await createSigningKey(root);
    const definitionPath = await writeDefinition(root, definition());
    const options = {
      definitionPath,
      stagingDirectory: stage,
      outputDirectory: path.join(root, "out"),
      assetBaseUrl: "https://packages.example.test/components/",
      signingKeyPath: key.privateKeyPath
    };

    const first = await buildComponentPackage(options);
    const manifest = JSON.parse(await fs.readFile(first.manifestPath, "utf8"));
    const publicKey = await fs.readFile(first.publicKeyPath, "utf8");
    assert.equal(
      manifest.archive.url,
      `https://packages.example.test/components/edge-tts/1.0.0/${componentArchiveFileName("edge-tts", "1.0.0", HOST_PLATFORM)}`
    );
    assert.equal(
      manifest.sbom.url,
      `https://packages.example.test/components/edge-tts/1.0.0/${componentSbomFileName("edge-tts", "1.0.0", HOST_PLATFORM)}`
    );
    assert.equal(manifest.files.length, 1);
    assert.equal(manifest.files[0].path, "scripts/edge-tts-generate.py");
    assert.equal(
      crypto.verify(
        null,
        Buffer.from(canonicalManifest(manifest)),
        publicKey,
        Buffer.from(manifest.signature, "base64")
      ),
      true
    );
    assert.equal(
      crypto
        .createHash("sha256")
        .update(await fs.readFile(first.archivePath))
        .digest("hex"),
      manifest.archive.sha256
    );

    const extracted = path.join(root, "extracted");
    await fs.mkdir(extracted);
    await tar.x({ file: first.archivePath, cwd: extracted, strict: true });
    assert.equal(
      await fs.readFile(path.join(extracted, "scripts", "edge-tts-generate.py"), "utf8"),
      "print('ready')\n"
    );

    const sbom = JSON.parse(await fs.readFile(first.sbomPath, "utf8"));
    assert.equal(sbom.spdxVersion, "SPDX-2.3");
    assert.equal(sbom.packages[0].name, `edge-tts-${IS_MACOS ? "darwin-arm64" : "windows-x64"}`);
    assert.equal(first.totalArchiveBytes, first.archiveBytes);
    assert.equal(first.estimatedInstallPeakBytes, first.totalArchiveBytes + definition().installedBytes);
    assert.equal(sbom.files[0].checksums[0].checksumValue, manifest.files[0].sha256);
    assert.equal(sbom.packages[0].checksums[0].checksumValue, manifest.archive.sha256);
    const catalog = await assembleComponentCatalog(options.outputDirectory);
    assert.deepEqual(
      catalog.manifests.map((item) => item.id),
      ["edge-tts"]
    );
    assert.equal(catalog.trustedPublicKeys[manifest.keyId], publicKey);
    const generatedPath = path.join(root, "catalog.generated.ts");
    await expectGeneratedCatalog(options.outputDirectory, generatedPath);
    if (IS_MACOS) {
      await assert.rejects(
        writeGeneratedCatalog(options.outputDirectory, path.join(root, "incomplete-macos-catalog.ts"), HOST_PLATFORM),
        /必须包含十项基础能力/u
      );
    }

    const tamperedFeed = path.join(root, "tampered-feed");
    await fs.cp(options.outputDirectory, tamperedFeed, { recursive: true });
    const tamperedManifestPath = path.join(
      tamperedFeed,
      "edge-tts",
      "1.0.0",
      componentManifestFileName("edge-tts", "1.0.0", HOST_PLATFORM)
    );
    const tamperedManifest = JSON.parse(await fs.readFile(tamperedManifestPath, "utf8"));
    tamperedManifest.signature = Buffer.from("tampered").toString("base64");
    await fs.writeFile(tamperedManifestPath, JSON.stringify(tamperedManifest));
    await assert.rejects(assembleComponentCatalog(tamperedFeed), /签名无效/);

    if (IS_MACOS) {
      const unsafeManifestFeed = path.join(root, "unsafe-manifest-feed");
      await fs.cp(options.outputDirectory, unsafeManifestFeed, { recursive: true });
      const unsafeManifestPath = path.join(
        unsafeManifestFeed,
        "edge-tts",
        "1.0.0",
        componentManifestFileName("edge-tts", "1.0.0", HOST_PLATFORM)
      );
      const unsafeManifest = JSON.parse(await fs.readFile(unsafeManifestPath, "utf8"));
      unsafeManifest.files.push({ path: "legacy/worker.exe", bytes: 1, sha256: "a".repeat(64) });
      unsafeManifest.signature = crypto
        .sign(
          null,
          Buffer.from(canonicalManifest(unsafeManifest)),
          crypto.createPrivateKey(await fs.readFile(key.privateKeyPath))
        )
        .toString("base64");
      await fs.writeFile(unsafeManifestPath, JSON.stringify(unsafeManifest));
      await assert.rejects(assembleComponentCatalog(unsafeManifestFeed), /文件清单无效/u);
    }

    const tamperedAssetFeed = path.join(root, "tampered-asset-feed");
    await fs.cp(options.outputDirectory, tamperedAssetFeed, { recursive: true });
    await fs.appendFile(
      path.join(tamperedAssetFeed, "edge-tts", "1.0.0", componentArchiveFileName("edge-tts", "1.0.0", HOST_PLATFORM)),
      "tampered"
    );
    await assert.rejects(assembleComponentCatalog(tamperedAssetFeed), /摘要不匹配/);

    await fs.utimes(workerPath, new Date("2000-01-01T00:00:00Z"), new Date("2000-01-01T00:00:00Z"));
    const secondDefinitionPath = await writeDefinition(root, definition({ version: "1.0.1" }));
    const second = await buildComponentPackage({ ...options, definitionPath: secondDefinitionPath });
    const secondManifest = JSON.parse(await fs.readFile(second.manifestPath, "utf8"));
    assert.equal(secondManifest.archive.sha256, manifest.archive.sha256);
    assert.equal(await fs.access(key.privateKeyPath).then(() => true), true);
    await assert.rejects(fs.access(path.join(first.artifactDirectory, path.basename(key.privateKeyPath))));
  });

  it("creates flat, immutable GitHub Release asset URLs and verifies the signed feed locally", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(path.join(stage, "scripts"), { recursive: true });
    await fs.writeFile(path.join(stage, "scripts", "edge-tts-generate.py"), "print('release')\n");
    const key = await createSigningKey(root);
    const definitionPath = await writeDefinition(root, definition());
    const options = {
      definitionPath,
      stagingDirectory: stage,
      outputDirectory: path.join(root, "out"),
      githubReleaseUrl: "https://github.com/example/toolbox/releases/download/components-v1/",
      signingKeyPath: key.privateKeyPath
    };

    const artifact = await buildComponentPackage(options);
    const manifest = JSON.parse(await fs.readFile(artifact.manifestPath, "utf8"));
    const publicKey = await fs.readFile(artifact.publicKeyPath, "utf8");
    assert.equal(
      manifest.archive.url,
      `https://github.com/example/toolbox/releases/download/components-v1/${componentArchiveFileName("edge-tts", "1.0.0", HOST_PLATFORM)}`
    );
    assert.equal(
      manifest.sbom.url,
      `https://github.com/example/toolbox/releases/download/components-v1/${componentSbomFileName("edge-tts", "1.0.0", HOST_PLATFORM)}`
    );
    assert.equal(
      crypto.verify(
        null,
        Buffer.from(canonicalManifest(manifest)),
        publicKey,
        Buffer.from(manifest.signature, "base64")
      ),
      true
    );
    assert.deepEqual((await assembleComponentCatalog(options.outputDirectory)).manifests, [manifest]);
    const sbom = JSON.parse(await fs.readFile(artifact.sbomPath, "utf8"));
    assert.equal(sbom.packages[0].downloadLocation, manifest.archive.url);
  });

  it("builds one signed component from independently verified archive parts", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(path.join(stage, "scripts"), { recursive: true });
    await fs.mkdir(path.join(stage, "models", "chatterbox"), { recursive: true });
    await fs.writeFile(path.join(stage, "scripts", "worker.py"), "print('ready')\n");
    await fs.writeFile(path.join(stage, "models", "chatterbox", "voice.bin"), "voice model\n");
    await fs.writeFile(path.join(stage, "models", "chatterbox", "decoder.bin"), "decoder model\n");
    const key = await createSigningKey(root);
    const definitionPath = await writeDefinition(
      root,
      definition({
        additionalArchives: [
          { name: "voice-model", paths: ["models/chatterbox/voice.bin"] },
          { name: "decoder-model", paths: ["models/chatterbox/decoder.bin"] }
        ]
      })
    );
    const outputDirectory = path.join(root, "out");
    const artifact = await buildComponentPackage({
      definitionPath,
      stagingDirectory: stage,
      outputDirectory,
      githubReleaseUrl: "https://github.com/example/toolbox/releases/download/components-v1/",
      signingKeyPath: key.privateKeyPath
    });
    const manifest = JSON.parse(await fs.readFile(artifact.manifestPath, "utf8"));
    const signedParts = [manifest.archive, ...manifest.additionalArchives];
    assert.equal(signedParts.length, 3);
    assert.deepEqual(
      signedParts.map((part) => path.basename(new URL(part.url).pathname)),
      [
        componentArchiveFileName("edge-tts", "1.0.0", HOST_PLATFORM),
        componentArchiveFileName("edge-tts", "1.0.0", HOST_PLATFORM, "voice-model"),
        componentArchiveFileName("edge-tts", "1.0.0", HOST_PLATFORM, "decoder-model")
      ]
    );
    assert.deepEqual(
      signedParts.flatMap((part) => part.filePaths).sort(),
      manifest.files.map((file) => file.path).sort()
    );
    assert.equal(artifact.archivePaths.length, 3);
    assert.equal(artifact.additionalArchivePaths.length, 2);
    assert.equal(
      artifact.totalArchiveBytes,
      (await Promise.all(artifact.archivePaths.map(async (archivePath) => (await fs.stat(archivePath)).size))).reduce(
        (total, bytes) => total + bytes,
        0
      )
    );
    assert.equal(artifact.estimatedInstallPeakBytes, artifact.totalArchiveBytes + definition().installedBytes);
    const catalog = await assembleComponentCatalog(outputDirectory);
    assert.equal(catalog.manifests[0].additionalArchives.length, 2);

    const extracted = path.join(root, "extracted");
    await fs.mkdir(extracted);
    for (const archivePath of artifact.archivePaths) {
      await tar.x({ file: archivePath, cwd: extracted, strict: true });
    }
    await assert.doesNotReject(fs.access(path.join(extracted, "scripts", "worker.py")));
    assert.equal(await fs.readFile(path.join(extracted, "models", "chatterbox", "voice.bin"), "utf8"), "voice model\n");
    assert.equal(
      await fs.readFile(path.join(extracted, "models", "chatterbox", "decoder.bin"), "utf8"),
      "decoder model\n"
    );
  });

  it("signs a large-file assembly while keeping every GitHub Release archive below 2 GiB", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    const partDirectory = path.join(stage, "wheelhouse", ".parts");
    await fs.mkdir(path.join(stage, "scripts"), { recursive: true });
    await fs.mkdir(partDirectory, { recursive: true });
    await fs.writeFile(path.join(stage, "scripts", "worker.py"), "print('ready')\n");
    const partOne = Buffer.from("large-wheel-first-part-");
    const partTwo = Buffer.from("second-part\n");
    const assembledWheel = Buffer.concat([partOne, partTwo]);
    const firstPath = "wheelhouse/.parts/torch.whl.part-0001";
    const secondPath = "wheelhouse/.parts/torch.whl.part-0002";
    await fs.writeFile(path.join(stage, ...firstPath.split("/")), partOne);
    await fs.writeFile(path.join(stage, ...secondPath.split("/")), partTwo);
    const key = await createSigningKey(root);
    const definitionPath = await writeDefinition(
      root,
      definition({
        assembledFiles: [
          {
            path: "wheelhouse/torch.whl",
            bytes: assembledWheel.length,
            sha256: crypto.createHash("sha256").update(assembledWheel).digest("hex"),
            parts: [firstPath, secondPath]
          }
        ],
        additionalArchives: [
          { name: "cuda-torch-part-0001", paths: [firstPath] },
          { name: "cuda-torch-part-0002", paths: [secondPath] }
        ]
      })
    );
    const outputDirectory = path.join(root, "out");
    const artifact = await buildComponentPackage({
      definitionPath,
      stagingDirectory: stage,
      outputDirectory,
      githubReleaseUrl: "https://github.com/example/toolbox/releases/download/components-v1/",
      signingKeyPath: key.privateKeyPath
    });
    const manifest = JSON.parse(await fs.readFile(artifact.manifestPath, "utf8"));
    const publicKey = await fs.readFile(artifact.publicKeyPath, "utf8");

    assert.deepEqual(manifest.files.map((file) => file.path).sort(), ["scripts/worker.py", "wheelhouse/torch.whl"]);
    assert.equal(manifest.assembledFiles[0].parts.length, 2);
    assert.equal(
      crypto.verify(
        null,
        Buffer.from(canonicalManifest(manifest)),
        publicKey,
        Buffer.from(manifest.signature, "base64")
      ),
      true
    );
    assert.deepEqual(
      [manifest.archive, ...manifest.additionalArchives].flatMap((archive) => archive.filePaths).sort(),
      ["scripts/worker.py", firstPath, secondPath].sort()
    );
    assert.equal(artifact.archivePaths.length, 3);
    const catalog = await assembleComponentCatalog(outputDirectory);
    assert.deepEqual(catalog.manifests[0].assembledFiles, manifest.assembledFiles);
  });

  it("hashes the Python lock into the signed manifest and lists pinned packages in the SBOM", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(path.join(stage, "wheelhouse"), { recursive: true });
    await fs.writeFile(path.join(stage, "worker.py"), "print('worker')\n");
    const torchVersion = IS_MACOS ? "2.6.0" : "2.6.0+cpu";
    await fs.writeFile(
      path.join(
        stage,
        "wheelhouse",
        IS_MACOS ? "torch-2.6.0-cp312-cp312-macosx_11_0_arm64.whl" : "torch-2.6.0+cpu.whl"
      ),
      "wheel"
    );
    await fs.writeFile(
      path.join(stage, "requirements.lock"),
      "torch==" +
        torchVersion +
        " --hash=sha256:" +
        "a".repeat(64) +
        "\neinops==0.8.1 --hash=sha256:" +
        "b".repeat(64) +
        "\nscipy==1.17.1 --hash=sha256:" +
        "c".repeat(64) +
        "\n"
    );
    const key = await createSigningKey(root);
    const definitionPath = await writeDefinition(
      root,
      definition({
        id: "edge-tts",
        groupId: "media",
        dependencyIds: [IS_MACOS ? "python-312" : "python-311"],
        taskToolIds: ["edge-tts"],
        pythonEnvironment: {
          pythonComponentId: IS_MACOS ? "python-312" : "python-311",
          pythonExecutablePath: IS_MACOS ? "python/bin/python3.12" : "python/python.exe",
          wheelhousePath: "wheelhouse",
          requirementsLockPath: "requirements.lock",
          expectedPythonVersion: IS_MACOS ? "3.12" : "3.11"
        }
      })
    );

    const artifact = await buildComponentPackage({
      definitionPath,
      stagingDirectory: stage,
      outputDirectory: path.join(root, "out"),
      assetBaseUrl: "https://packages.example.test/components",
      signingKeyPath: key.privateKeyPath
    });
    const manifest = JSON.parse(await fs.readFile(artifact.manifestPath, "utf8"));
    const sbom = JSON.parse(await fs.readFile(artifact.sbomPath, "utf8"));
    const lock = await fs.readFile(path.join(stage, "requirements.lock"));

    assert.equal(
      manifest.pythonEnvironment.requirementsLockSha256,
      crypto.createHash("sha256").update(lock).digest("hex")
    );
    assert.equal(manifest.pythonEnvironment.expectedPythonVersion, IS_MACOS ? "3.12" : "3.11");
    assert.equal(manifest.pythonEnvironment.pythonComponentId, IS_MACOS ? "python-312" : "python-311");
    assert.ok(sbom.packages.some((item) => item.name === "torch" && item.versionInfo === torchVersion));
    const pythonPackages = sbom.packages.filter((item) => item.SPDXID.startsWith("SPDXRef-Python-"));
    assert.deepEqual(
      pythonPackages.map((item) => [item.name, item.versionInfo]),
      [
        ["torch", torchVersion],
        ["einops", "0.8.1"],
        ["scipy", "1.17.1"]
      ]
    );
    assert.equal(sbom.relationships.filter((item) => item.relationshipType === "DEPENDS_ON").length, 3);
  });

  it("rejects HTTPS violations, path escape definitions and private keys inside the staged package", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(stage);
    await fs.writeFile(path.join(stage, "worker.py"), "print('ready')\n");
    const key = await createSigningKey(root);
    const definitionPath = await writeDefinition(root, definition());
    const options = {
      definitionPath,
      stagingDirectory: stage,
      outputDirectory: path.join(root, "out"),
      assetBaseUrl: "http://packages.example.test/",
      signingKeyPath: key.privateKeyPath
    };

    await assert.rejects(buildComponentPackage(options), /HTTPS/);
    const badReleaseUrl = await writeDefinition(root, definition());
    await assert.rejects(
      buildComponentPackage({
        ...options,
        definitionPath: badReleaseUrl,
        assetBaseUrl: undefined,
        githubReleaseUrl: "https://github.com/example/toolbox/releases/latest/download/"
      }),
      /固定 tag/
    );
    await assert.rejects(
      buildComponentPackage({
        ...options,
        definitionPath: badReleaseUrl,
        githubReleaseUrl: "https://github.com/example/toolbox/releases/download/v1/",
        assetBaseUrl: "https://packages.example.test/"
      }),
      /只能指定/
    );
    const unsafeDefinitionPath = await writeDefinition(
      root,
      definition({
        pythonEnvironment: {
          pythonExecutablePath: "../python.exe",
          wheelhousePath: "wheelhouse",
          requirementsLockPath: "requirements.lock",
          expectedPythonVersion: "3.11"
        }
      })
    );
    await assert.rejects(
      buildComponentPackage({
        ...options,
        definitionPath: unsafeDefinitionPath,
        assetBaseUrl: "https://packages.example.test/"
      }),
      /pythonEnvironment/
    );

    const undeclaredPythonDependency = await writeDefinition(
      root,
      definition({
        pythonEnvironment: {
          pythonComponentId: "python-311",
          pythonExecutablePath: "python/python.exe",
          wheelhousePath: "wheelhouse",
          requirementsLockPath: "requirements.lock",
          expectedPythonVersion: "3.11"
        }
      })
    );
    await assert.rejects(
      buildComponentPackage({
        ...options,
        definitionPath: undeclaredPythonDependency,
        assetBaseUrl: "https://packages.example.test/"
      }),
      /pythonEnvironment/
    );

    await writeDefinition(root, definition());
    const bundledKeyPath = path.join(stage, "private.pem");
    await fs.writeFile(bundledKeyPath, await fs.readFile(key.privateKeyPath));
    await assert.rejects(
      buildComponentPackage({
        ...options,
        assetBaseUrl: "https://packages.example.test/",
        signingKeyPath: bundledKeyPath
      }),
      /不能位于能力目录中/
    );
  });
});

async function writeTestCatalog(feedDirectory, outputPath, pythonVersion, baseCatalogPath) {
  return writeGeneratedCatalog(feedDirectory, outputPath, HOST_PLATFORM, pythonVersion, baseCatalogPath, {
    requireCompleteMacCatalog: false
  });
}

async function expectGeneratedCatalog(feedDirectory, outputPath) {
  const result = await writeTestCatalog(feedDirectory, outputPath);
  assert.equal(result.manifestCount, 1);
  const source = await fs.readFile(outputPath, "utf8");
  assert.match(source, /\/\/ prettier-ignore/);
  assert.match(source, /"id": "edge-tts"/);
  assert.match(source, /"ed25519-[a-f0-9]{24}": "-----BEGIN PUBLIC KEY-----/);
  assert.doesNotMatch(source, /PRIVATE KEY/);
}
