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

function tempRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "macos-image-manifest-"));
  roots.add(root);
  return root;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("help bypasses required paths and rejects unknown or relative options", () => {
  assert.equal(parseArguments(["--help"]).help, true);
  assert.deepEqual(
    parseArguments([
      "--assets-dir",
      "/assets",
      "--environment-manifest",
      "/env.json",
      "--acquisition-source",
      "big-lama.pt=https://mirror.example/big-lama.pt"
    ]).acquisitionSources,
    { "big-lama.pt": "https://mirror.example/big-lama.pt" }
  );
  assert.throws(
    () => parseArguments(["--assets-dir", "relative", "--environment-manifest", "/env.json"]),
    /absolute path/
  );
  assert.throws(
    () =>
      parseArguments(["--assets-dir", "/assets", "--environment-manifest", "/env.json", "--acquisition-source", "bad"]),
    /<model-name=https-url>/
  );
  assert.throws(
    () => parseArguments(["--assets-dir", "/assets", "--environment-manifest", "/env.json", "--unknown", "/value"]),
    /unknown option/i
  );
});

test("writes a hashed manifest and provenance without overwriting existing output", async () => {
  const root = tempRoot();
  const assets = path.join(root, "assets");
  const archives = path.join(assets, ".incoming");
  const environment = path.join(root, "environment.json");
  const lock = path.join(root, "image-ai.lock.txt");
  mkdirSync(path.join(assets, "models"), { recursive: true });
  mkdirSync(path.join(assets, "samples"), { recursive: true });
  mkdirSync(archives);
  const modelBytes = Buffer.from("pinned model bytes");
  const sampleBytes = Buffer.from("synthetic input bytes");
  const archiveBytes = Buffer.from("official paddle archive bytes");
  writeFileSync(path.join(assets, "models", "model.bin"), modelBytes);
  writeFileSync(path.join(assets, "samples", "input.bin"), sampleBytes);
  writeFileSync(path.join(archives, "paddle.tar"), archiveBytes);
  writeFileSync(environment, JSON.stringify({ schemaVersion: 1 }));
  writeFileSync(lock, "torch==2.6.0\n");

  const result = await createManifest({
    assetsDirectory: assets,
    environmentManifest: environment,
    lockPath: lock,
    archiveDirectory: archives,
    modelAssets: [
      {
        name: "model.bin",
        url: "https://example.com/model.bin",
        sha256: sha256(modelBytes),
        relativePath: "models/model.bin"
      }
    ],
    acquisitionSources: { "model.bin": "https://mirror.example/model.bin" },
    samplePaths: ["samples/input.bin"],
    paddleArchives: [{ name: "paddle.tar", model: "PP-OCRv5-test", url: "https://example.com/paddle.tar" }]
  });

  const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
  assert.equal(result.resources, 5);
  assert.equal(
    manifest.resources.find((resource) => resource.id === "image-model:model.bin").sha256,
    sha256(modelBytes)
  );
  assert.equal(manifest.resources.find((resource) => resource.id === "sample:input.bin").sha256, sha256(sampleBytes));
  const provenance = JSON.parse(readFileSync(result.provenancePath, "utf8"));
  assert.deepEqual(provenance.modelAssets[0], {
    name: "model.bin",
    pinnedUrl: "https://example.com/model.bin",
    downloadedFrom: "https://mirror.example/model.bin",
    sha256: sha256(modelBytes),
    relativePath: "models/model.bin"
  });
  assert.deepEqual(provenance.paddleOcrArchives[0], {
    name: "paddle.tar",
    model: "PP-OCRv5-test",
    url: "https://example.com/paddle.tar",
    bytes: archiveBytes.length,
    sha256: sha256(archiveBytes)
  });

  await assert.rejects(
    createManifest({
      assetsDirectory: assets,
      environmentManifest: environment,
      lockPath: lock,
      archiveDirectory: archives,
      modelAssets: [],
      samplePaths: [],
      paddleArchives: []
    }),
    /Refusing to overwrite existing file/
  );
});

test("rejects a model whose content does not match its fixed digest", async () => {
  const root = tempRoot();
  const assets = path.join(root, "assets");
  const archives = path.join(assets, ".incoming");
  const environment = path.join(root, "environment.json");
  const lock = path.join(root, "image-ai.lock.txt");
  mkdirSync(path.join(assets, "models"), { recursive: true });
  mkdirSync(archives);
  writeFileSync(path.join(assets, "models", "model.bin"), "changed model bytes");
  writeFileSync(environment, "{}");
  writeFileSync(lock, "lock\n");

  await assert.rejects(
    createManifest({
      assetsDirectory: assets,
      environmentManifest: environment,
      lockPath: lock,
      archiveDirectory: archives,
      modelAssets: [
        {
          name: "model.bin",
          url: "https://example.com/model.bin",
          sha256: "0".repeat(64),
          relativePath: "models/model.bin"
        }
      ],
      samplePaths: [],
      paddleArchives: []
    }),
    /Pinned model SHA-256 mismatch/
  );
});
