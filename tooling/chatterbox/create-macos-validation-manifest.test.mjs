import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { createManifest, parseArguments } from "./create-macos-validation-manifest.mjs";

const roots = new Set();
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "macos-chatterbox-manifest-"));
  roots.add(root);
  const assets = path.join(root, "assets");
  const archiveDirectory = path.join(assets, ".incoming");
  mkdirSync(path.join(assets, "models", "chatterbox"), { recursive: true });
  mkdirSync(path.join(assets, "samples"), { recursive: true });
  mkdirSync(archiveDirectory);
  const model = Buffer.from("pinned chatterbox model");
  const archive = Buffer.from("pinned source archive");
  writeFileSync(path.join(assets, "models", "chatterbox", "model.bin"), model);
  for (const sample of ["reference-ms.wav", "reference-en.wav", "reference-pt-BR.wav"])
    writeFileSync(path.join(assets, "samples", sample), `synthetic ${sample}`);
  writeFileSync(path.join(archiveDirectory, "source.zip"), archive);
  const environment = path.join(root, "environment.json");
  const lock = path.join(root, "chatterbox.lock.txt");
  writeFileSync(environment, JSON.stringify({ schemaVersion: 1 }));
  writeFileSync(lock, "torch==2.6.0\n");
  return { root, assets, archiveDirectory, environment, lock, model, archive };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("help and path parsing validate model acquisition URL", () => {
  assert.equal(parseArguments(["--help"]).help, true);
  assert.throws(
    () => parseArguments(["--assets-dir", "relative", "--environment-manifest", "/env.json"]),
    /absolute path/
  );
  assert.throws(
    () =>
      parseArguments([
        "--assets-dir",
        "/assets",
        "--environment-manifest",
        "/env.json",
        "--model-acquisition-base-url",
        "http://mirror.example/models"
      ]),
    /HTTPS URL/
  );
});

test("writes pinned models, source commit, environment, and synthetic reference provenance", async () => {
  const paths = fixture();
  const result = await createManifest({
    assetsDirectory: paths.assets,
    environmentManifest: paths.environment,
    lockPath: paths.lock,
    modelAcquisitionBaseUrl: "https://mirror.example/ResembleAI/chatterbox/resolve/revision-1",
    modelRevision: "revision-1",
    sourceCommit: "source-commit-1",
    sourceArchive: { name: "source.zip", url: "https://source.example/source-commit-1.zip", commit: "source-commit-1" },
    modelAssets: [
      {
        name: "model.bin",
        relativePath: "models/chatterbox/model.bin",
        bytes: paths.model.length,
        sha256: sha256(paths.model)
      }
    ],
    samplePaths: ["samples/reference-ms.wav", "samples/reference-en.wav", "samples/reference-pt-BR.wav"]
  });

  const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
  assert.equal(result.resources, 8);
  assert.equal(
    manifest.resources.find((resource) => resource.id === "chatterbox-model:model.bin").sha256,
    sha256(paths.model)
  );
  assert.equal(
    manifest.resources.find((resource) => resource.id === "chatterbox-source-archive").sha256,
    sha256(paths.archive)
  );
  const provenance = JSON.parse(readFileSync(result.provenancePath, "utf8"));
  assert.deepEqual(provenance.source, {
    repository: "https://github.com/resemble-ai/chatterbox",
    commit: "source-commit-1",
    archive: {
      name: "source.zip",
      url: "https://source.example/source-commit-1.zip",
      commit: "source-commit-1",
      bytes: paths.archive.length,
      sha256: sha256(paths.archive)
    }
  });
  assert.equal(
    provenance.modelAssets[0].pinnedUrl,
    "https://huggingface.co/ResembleAI/chatterbox/resolve/revision-1/model.bin"
  );
  assert.equal(
    provenance.modelAssets[0].downloadedFrom,
    "https://mirror.example/ResembleAI/chatterbox/resolve/revision-1/model.bin"
  );
  assert.equal(provenance.samples.generator, "macOS say with afconvert; PCM signed 16-bit, 24 kHz, mono");
  assert.equal(provenance.samples.files.length, 3);
  await assert.rejects(
    createManifest({
      assetsDirectory: paths.assets,
      environmentManifest: paths.environment,
      lockPath: paths.lock,
      modelAssets: [],
      samplePaths: [],
      sourceArchive: { name: "source.zip", url: "https://source.example/source.zip", commit: "source-commit-1" }
    }),
    /Refusing to overwrite existing file/
  );
});

test("rejects changed model bytes or unexpected model size", async () => {
  const paths = fixture();
  await assert.rejects(
    createManifest({
      assetsDirectory: paths.assets,
      environmentManifest: paths.environment,
      lockPath: paths.lock,
      modelAssets: [
        {
          name: "model.bin",
          relativePath: "models/chatterbox/model.bin",
          bytes: paths.model.length,
          sha256: "0".repeat(64)
        }
      ],
      samplePaths: [],
      sourceArchive: { name: "source.zip", url: "https://source.example/source.zip", commit: "source-commit-1" }
    }),
    /Pinned model SHA-256 mismatch/
  );
  await assert.rejects(
    createManifest({
      assetsDirectory: paths.assets,
      environmentManifest: paths.environment,
      lockPath: paths.lock,
      modelAssets: [
        {
          name: "model.bin",
          relativePath: "models/chatterbox/model.bin",
          bytes: paths.model.length + 1,
          sha256: sha256(paths.model)
        }
      ],
      samplePaths: [],
      sourceArchive: { name: "source.zip", url: "https://source.example/source.zip", commit: "source-commit-1" }
    }),
    /Pinned model size mismatch/
  );
});
