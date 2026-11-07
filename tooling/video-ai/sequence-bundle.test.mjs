import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isolateImports, stageSequenceBundle } from "./sequence-bundle.mjs";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-sequence-bundle-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-sequence-bundle-"));
    await fs.rm(root, { recursive: true, force: true });
  });
  const cacheRoot = path.join(root, "cache");
  await fs.mkdir(cacheRoot);
  const files = [];
  for (const [relative, contents] of [
    ["LICENSE", "license\n"],
    ["model/net.py", "from core.spectral_norm import spectral_norm\n"]
  ]) {
    const output = path.join(cacheRoot, "upstream", "sttn", relative);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, contents);
    files.push({ path: relative, sha256: hash(contents), gitBlobSha1: "a".repeat(40) });
  }
  const weight = path.join(cacheRoot, "weights", "sttn", "sttn.pth");
  await fs.mkdir(path.dirname(weight), { recursive: true });
  await fs.writeFile(weight, "weights");
  return {
    root,
    cacheRoot,
    destination: path.join(root, "sttn"),
    engine: "sttn",
    manifest: {
      schemaVersion: 1,
      engines: {
        sttn: {
          repository: "researchmm/STTN",
          revision: "a".repeat(40),
          license: "MIT",
          files,
          weights: [{ name: "sttn.pth", bytes: 7, sha256: hash("weights"), url: "https://example.test/weights" }]
        }
      }
    }
  };
}

test("isolates each upstream import relative to its own package, preserving external imports", () => {
  assert.equal(
    isolateImports("from core.spectral_norm import spectral_norm\nimport torch\n", "model/sttn.py"),
    "from ..core.spectral_norm import spectral_norm\nimport torch\n"
  );
  assert.equal(
    isolateImports(
      "from RAFT import RAFT\nfrom model.modules.flow_loss_utils import flow_warp\n",
      "model/modules/flow_comp_raft.py"
    ),
    "from ...RAFT import RAFT\nfrom .flow_loss_utils import flow_warp\n"
  );
  assert.equal(
    isolateImports("from .misc import constant_init\n", "model/propainter.py"),
    "from .misc import constant_init\n"
  );
});

test("stages only the pinned closure, retains full licenses and records every output digest", async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.cacheRoot, "upstream/sttn/train.py"), "training data must not enter bundle");
  const bundle = await stageSequenceBundle(f);
  assert.equal(bundle.namespace, "toolbox_video_ai_vendor.sttn");
  assert.equal(bundle.adapterReady, false);
  assert.ok(bundle.files.some((entry) => entry.path === "vendor/__init__.py"));
  assert.ok(!bundle.files.some((entry) => entry.path.includes("train.py")));
  assert.equal(await fs.readFile(path.join(f.destination, "LICENSE"), "utf8"), "license\n");
  for (const entry of bundle.files) {
    const bytes = await fs.readFile(path.join(f.destination, entry.path));
    assert.equal(hash(bytes), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
  }
  await assert.rejects(stageSequenceBundle(f), { code: "EEXIST" });
});

test("explicit adapter enablement changes only a newly staged bundle and rejects non-boolean flags", async (t) => {
  const f = await fixture(t);
  await assert.rejects(stageSequenceBundle({ ...f, adapterReady: "true" }), /explicit boolean/);
  await assert.rejects(fs.access(f.destination), { code: "ENOENT" });
  const descriptor = await stageSequenceBundle({ ...f, adapterReady: true });
  assert.equal(descriptor.adapterReady, true);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(f.destination, "sequence-bundle.json"), "utf8")).adapterReady,
    true
  );
  assert.equal(await fs.readFile(path.join(f.cacheRoot, "weights/sttn/sttn.pth"), "utf8"), "weights");
  await assert.rejects(stageSequenceBundle({ ...f, adapterReady: false }), /EEXIST/);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(f.destination, "sequence-bundle.json"), "utf8")).adapterReady,
    true
  );
});

test("source tampering, missing licenses, duplicate paths and junctions fail before destination creation", async (t) => {
  for (const mutate of [
    async (f) => {
      await fs.writeFile(path.join(f.cacheRoot, "upstream/sttn/model/net.py"), "changed");
    },
    async (f) => {
      f.manifest.engines.sttn.files.shift();
    },
    async (f) => {
      f.manifest.engines.sttn.files.push(f.manifest.engines.sttn.files[1]);
    },
    async (f) => {
      const current = path.join(f.cacheRoot, "upstream/sttn/model");
      const outside = path.join(f.root, "outside");
      await fs.mkdir(outside);
      await fs.writeFile(path.join(outside, "net.py"), "preserve");
      await fs.rm(current, { recursive: true });
      await fs.symlink(outside, current, process.platform === "win32" ? "junction" : "dir");
    }
  ]) {
    const f = await fixture(t);
    await mutate(f);
    await assert.rejects(stageSequenceBundle(f));
    await assert.rejects(fs.access(f.destination), { code: "ENOENT" });
  }
});
