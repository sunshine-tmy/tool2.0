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
import { buildComponentPackage, canonicalManifest } from "./build-component-package.mjs";
import { assembleComponentCatalog, writeGeneratedCatalog } from "./assemble-component-catalog.mjs";
import { preparePython311Runtime } from "./prepare-python-311-runtime.mjs";

const repositoryRoot = process.cwd();
const require = createRequire(path.join(repositoryRoot, "backend", "package.json"));
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
    assert.equal(manifest.archive.url, "https://packages.example.test/components/edge-tts/1.0.0/edge-tts-1.0.0.tar.gz");
    assert.equal(manifest.sbom.url, "https://packages.example.test/components/edge-tts/1.0.0/edge-tts-1.0.0.spdx.json");
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

    const tamperedFeed = path.join(root, "tampered-feed");
    await fs.cp(options.outputDirectory, tamperedFeed, { recursive: true });
    const tamperedManifestPath = path.join(tamperedFeed, "edge-tts", "1.0.0", "edge-tts-1.0.0.manifest.json");
    const tamperedManifest = JSON.parse(await fs.readFile(tamperedManifestPath, "utf8"));
    tamperedManifest.signature = Buffer.from("tampered").toString("base64");
    await fs.writeFile(tamperedManifestPath, JSON.stringify(tamperedManifest));
    await assert.rejects(assembleComponentCatalog(tamperedFeed), /签名无效/);

    const tamperedAssetFeed = path.join(root, "tampered-asset-feed");
    await fs.cp(options.outputDirectory, tamperedAssetFeed, { recursive: true });
    await fs.appendFile(path.join(tamperedAssetFeed, "edge-tts", "1.0.0", "edge-tts-1.0.0.tar.gz"), "tampered");
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
      "https://github.com/example/toolbox/releases/download/components-v1/edge-tts-1.0.0.tar.gz"
    );
    assert.equal(
      manifest.sbom.url,
      "https://github.com/example/toolbox/releases/download/components-v1/edge-tts-1.0.0.spdx.json"
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
      ["edge-tts-1.0.0.tar.gz", "edge-tts-1.0.0-voice-model.tar.gz", "edge-tts-1.0.0-decoder-model.tar.gz"]
    );
    assert.deepEqual(
      signedParts.flatMap((part) => part.filePaths).sort(),
      manifest.files.map((file) => file.path).sort()
    );
    assert.equal(artifact.archivePaths.length, 3);
    assert.equal(artifact.additionalArchivePaths.length, 2);
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

  it("hashes the Python lock into the signed manifest and lists pinned packages in the SBOM", async () => {
    const root = await makeRoot();
    const stage = path.join(root, "stage");
    await fs.mkdir(path.join(stage, "wheelhouse"), { recursive: true });
    await fs.writeFile(path.join(stage, "worker.py"), "print('worker')\n");
    await fs.writeFile(path.join(stage, "wheelhouse", "torch-2.6.0+cpu.whl"), "wheel");
    await fs.writeFile(
      path.join(stage, "requirements.lock"),
      "torch==2.6.0+cpu \\\n    --hash=sha256:" + "a".repeat(64) + "\n"
    );
    const key = await createSigningKey(root);
    const definitionPath = await writeDefinition(
      root,
      definition({
        id: "video-text",
        groupId: "media",
        dependencyIds: ["python-311"],
        taskToolIds: ["video-text"],
        pythonEnvironment: {
          pythonComponentId: "python-311",
          pythonExecutablePath: "python/python.exe",
          wheelhousePath: "wheelhouse",
          requirementsLockPath: "requirements.lock",
          expectedPythonVersion: "3.11"
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
    assert.equal(manifest.pythonEnvironment.expectedPythonVersion, "3.11");
    assert.equal(manifest.pythonEnvironment.pythonComponentId, "python-311");
    assert.ok(sbom.packages.some((item) => item.name === "torch" && item.versionInfo === "2.6.0+cpu"));
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

async function expectGeneratedCatalog(feedDirectory, outputPath) {
  const result = await writeGeneratedCatalog(feedDirectory, outputPath);
  assert.equal(result.manifestCount, 1);
  const source = await fs.readFile(outputPath, "utf8");
  assert.match(source, /\/\/ prettier-ignore/);
  assert.match(source, /"id": "edge-tts"/);
  assert.match(source, /"ed25519-[a-f0-9]{24}": "-----BEGIN PUBLIC KEY-----/);
  assert.doesNotMatch(source, /PRIVATE KEY/);
}
