/** 中文模块说明：验证 Chatterbox 能力包的固定源码、离线依赖与模型资产准备流程。 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CHATTERBOX_MODEL_ASSETS,
  CHATTERBOX_MODEL_REVISION,
  CHATTERBOX_PACKAGE_VERSION,
  CHATTERBOX_SOURCE_COMMIT,
  prepareChatterboxComponent,
  verifyChatterboxModelAssets,
  verifyChatterboxSource,
  verifyChatterboxWheelhouse
} from "./prepare-chatterbox-component.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const temporaryRoots = [];

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "chatterbox-component-preparation-"));
  temporaryRoots.push(root);
  return root;
}

test.after(async () => {
  await Promise.all(temporaryRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
});

test("Chatterbox component pins its source, CPU model set and one user-facing module", async () => {
  const definition = JSON.parse(
    await fs.readFile(path.join(SCRIPT_DIRECTORY, "component-definitions/chatterbox.json"), "utf8")
  );
  assert.equal(definition.id, "chatterbox");
  assert.equal(definition.version, "1.0.0-cpu1");
  assert.deepEqual(definition.dependencyIds, ["ffmpeg", "python-311"]);
  assert.deepEqual(definition.taskToolIds, ["chatterbox"]);
  assert.equal(definition.additionalArchives.length, 2);
  assert.equal(definition.additionalArchives[0].paths[0], "models/chatterbox/t3_mtl23ls_v3.safetensors");
  assert.equal(definition.pythonEnvironment.expectedPythonVersion, "3.11");
  assert.equal(CHATTERBOX_PACKAGE_VERSION, "0.1.7");
  assert.equal(CHATTERBOX_SOURCE_COMMIT.length, 40);
  assert.equal(CHATTERBOX_MODEL_REVISION.length, 40);
  assert.equal(CHATTERBOX_MODEL_ASSETS.length, 4);
  assert.ok(CHATTERBOX_MODEL_ASSETS.every((asset) => /^[a-f0-9]{64}$/.test(asset.sha256)));
  assert.ok(definition.installConditions.some((condition) => condition.includes("16 GB 内存")));
});

test("source metadata must point to the exact official Chatterbox commit", async () => {
  const root = await makeRoot();
  const sitePackages = await makeSitePackages(root);
  assert.equal((await verifyChatterboxSource(sitePackages)).sitePackages, sitePackages);

  const directUrlPath = path.join(
    sitePackages,
    `chatterbox_tts-${CHATTERBOX_PACKAGE_VERSION}.dist-info`,
    "direct_url.json"
  );
  await fs.writeFile(
    directUrlPath,
    JSON.stringify({
      url: "https://github.com/resemble-ai/chatterbox.git",
      vcs_info: { vcs: "git", commit_id: "0".repeat(40), requested_revision: "0".repeat(40) }
    })
  );
  await assert.rejects(verifyChatterboxSource(sitePackages), /固定的官方 Git 提交/);
});

test("wheelhouse rejects assets not authorized by the pinned lock hashes", async () => {
  const root = await makeRoot();
  const wheelhouse = path.join(root, "wheelhouse");
  await fs.mkdir(wheelhouse);
  const payload = Buffer.from("verified wheel placeholder");
  await fs.writeFile(path.join(wheelhouse, "dependency-1.0-py3-none-any.whl"), payload);
  const sha256 = createHash("sha256").update(payload).digest("hex");
  const lockText = "package==1.0 --hash=sha256:" + sha256 + "\n";
  assert.equal((await verifyChatterboxWheelhouse(wheelhouse, lockText)).count, 1);
  await assert.rejects(
    verifyChatterboxWheelhouse(wheelhouse, "package==1.0 --hash=sha256:" + "0".repeat(64)),
    /未被锁文件摘要授权/
  );
});

test("model assets are size- and SHA-256-verified from the pinned snapshot", async () => {
  const root = await makeRoot();
  const snapshot = path.join(root, "models--ResembleAI--chatterbox", "snapshots", CHATTERBOX_MODEL_REVISION);
  await fs.mkdir(snapshot, { recursive: true });
  const payload = Buffer.from("small fixed model");
  const asset = {
    name: "toy-model.bin",
    relativePath: "models/chatterbox/toy-model.bin",
    bytes: payload.length,
    sha256: createHash("sha256").update(payload).digest("hex")
  };
  await fs.writeFile(path.join(snapshot, asset.name), payload);
  assert.equal((await verifyChatterboxModelAssets(snapshot, [asset]))[0].bytes, payload.length);
  const tampered = Buffer.from(payload);
  tampered[0] ^= 1;
  await fs.writeFile(path.join(snapshot, asset.name), tampered);
  await assert.rejects(verifyChatterboxModelAssets(snapshot, [asset]), /SHA-256 不匹配/);
});

test("preparation copies a clean vendor package and signed payload without copying a venv", async () => {
  const root = await makeRoot();
  const sitePackages = await makeSitePackages(root);
  await fs.mkdir(path.join(sitePackages, "chatterbox", "__pycache__"), { recursive: true });
  await fs.writeFile(path.join(sitePackages, "chatterbox", "__pycache__", "ignored.pyc"), "bytecode");
  const wheelhouse = path.join(root, "wheelhouse");
  await fs.mkdir(wheelhouse);
  const wheel = Buffer.from("locked wheel bytes");
  const wheelHash = createHash("sha256").update(wheel).digest("hex");
  await fs.writeFile(path.join(wheelhouse, "dependency-1.0-py3-none-any.whl"), wheel);
  const lockPath = path.join(root, "requirements.lock");
  await fs.writeFile(lockPath, `dependency==1.0 --hash=sha256:${wheelHash}\n`);
  const snapshot = path.join(root, "models--ResembleAI--chatterbox", "snapshots", CHATTERBOX_MODEL_REVISION);
  await fs.mkdir(snapshot, { recursive: true });
  const model = Buffer.from("tiny test model");
  const asset = {
    name: "test-model.bin",
    relativePath: "models/chatterbox/test-model.bin",
    bytes: model.length,
    sha256: createHash("sha256").update(model).digest("hex")
  };
  await fs.writeFile(path.join(snapshot, asset.name), model);
  const python = path.join(root, "python.exe");
  const runCommand = (_executable, args) => (args.at(-1).includes("sys.version_info") ? "3.11\n" : sitePackages + "\n");
  const stage = path.join(root, "stage");

  const result = await prepareChatterboxComponent({
    pythonExecutablePath: python,
    stagingDirectory: stage,
    wheelhouseDirectory: wheelhouse,
    modelSnapshotDirectory: snapshot,
    lockFilePath: lockPath,
    runCommand,
    assets: [asset]
  });

  assert.equal(result.wheelCount, 1);
  assert.equal(result.modelBytes, model.length);
  assert.equal(
    await fs.readFile(path.join(stage, "vendor", "chatterbox", "__init__.py"), "utf8"),
    "from chatterbox import test\n"
  );
  assert.equal(
    await fs.readFile(
      path.join(stage, "vendor", `chatterbox_tts-${CHATTERBOX_PACKAGE_VERSION}.dist-info`, "METADATA"),
      "utf8"
    ),
    `Name: chatterbox-tts\nVersion: ${CHATTERBOX_PACKAGE_VERSION}\n`
  );
  assert.equal(await fs.readFile(path.join(stage, "scripts", "worker_lifecycle.py"), "utf8").then(Boolean), true);
  assert.deepEqual(await fs.readFile(path.join(stage, "models", "chatterbox", "test-model.bin")), model);
  await assert.rejects(fs.access(path.join(stage, "vendor", "chatterbox", "__pycache__")));
  await assert.rejects(fs.access(path.join(stage, "venv")));
});

async function makeSitePackages(root) {
  const sitePackages = path.join(root, "site-packages");
  const packageRoot = path.join(sitePackages, "chatterbox");
  const distInfoRoot = path.join(sitePackages, `chatterbox_tts-${CHATTERBOX_PACKAGE_VERSION}.dist-info`);
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.mkdir(distInfoRoot, { recursive: true });
  await fs.writeFile(path.join(packageRoot, "__init__.py"), "from chatterbox import test\n");
  await fs.writeFile(
    path.join(distInfoRoot, "METADATA"),
    `Name: chatterbox-tts\nVersion: ${CHATTERBOX_PACKAGE_VERSION}\n`
  );
  await fs.writeFile(
    path.join(distInfoRoot, "direct_url.json"),
    JSON.stringify({
      url: "https://github.com/resemble-ai/chatterbox.git",
      vcs_info: {
        vcs: "git",
        commit_id: CHATTERBOX_SOURCE_COMMIT,
        requested_revision: CHATTERBOX_SOURCE_COMMIT
      }
    })
  );
  return sitePackages;
}
