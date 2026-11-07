import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareSequenceValidation } from "./prepare-sequence-validation.mjs";

const sha = (text, algorithm = "sha256") => crypto.createHash(algorithm).update(text).digest("hex");
async function fixture(t) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-sequence-assets-"));
  t.after(async () => {
    assert.equal(path.dirname(parent), path.resolve(os.tmpdir()));
    assert.ok(path.basename(parent).startsWith("toolbox-sequence-assets-"));
    await fs.rm(parent, { recursive: true, force: true });
  });
  const root = path.join(parent, "中文 validation");
  const raw = "source\r\n";
  const manifest = {
    schemaVersion: 1,
    engines: {
      sttn: {
        repository: "researchmm/STTN",
        revision: "a".repeat(40),
        files: [
          {
            path: "model/sttn.py",
            gitBlobSha1: sha(`blob ${Buffer.byteLength(raw)}\0${raw}`, "sha1"),
            sha256: sha("source\n")
          }
        ],
        weights: [{ name: "sttn.pth", url: "https://example.test/sttn.pth", sha256: sha("weight"), bytes: 6 }]
      }
    }
  };
  let calls = 0;
  const download = async (url, file) => {
    calls++;
    await fs.writeFile(file, url.includes("raw.githubusercontent") ? raw : "weight");
  };
  return { root, parent, manifest, download, calls: () => calls };
}

test("pins Git content before normalization, verifies models and reuses valid resources without downloads", async (t) => {
  const f = await fixture(t);
  assert.equal((await prepareSequenceValidation(f)).length, 2);
  assert.equal(f.calls(), 2);
  await prepareSequenceValidation({ ...f, download: () => assert.fail("must reuse verified resources") });
  assert.equal(await fs.readFile(path.join(f.root, "upstream/sttn/model/sttn.py"), "utf8"), "source\n");
});
test("source and weight digest failures cannot leave a trusted asset", async (t) => {
  for (const kind of ["files", "weights"]) {
    const f = await fixture(t);
    f.manifest.engines.sttn[kind][0].sha256 = "0".repeat(64);
    await assert.rejects(prepareSequenceValidation(f), /digest/);
    const folder = kind === "files" ? "upstream/sttn/model" : "weights/sttn";
    assert.deepEqual(await fs.readdir(path.join(f.root, folder)), []);
  }
});
test("corrupt existing resources and unrelated directories are preserved, never overwritten", async (t) => {
  const f = await fixture(t);
  await fs.mkdir(f.root);
  await fs.writeFile(path.join(f.root, "preserve.bin"), "user");
  await assert.rejects(prepareSequenceValidation(f));
  assert.equal(await fs.readFile(path.join(f.root, "preserve.bin"), "utf8"), "user");
  const other = { ...f, root: path.join(f.parent, "owned") };
  await prepareSequenceValidation(other);
  const weight = path.join(other.root, "weights/sttn/sttn.pth");
  await fs.writeFile(weight, "corrupt");
  await assert.rejects(prepareSequenceValidation(other), /corrupt/);
  assert.equal(await fs.readFile(weight, "utf8"), "corrupt");
});
test("rejects unsafe paths, unpinned versions and insecure URLs", async (t) => {
  for (const mutate of [
    (m) => {
      m.engines.sttn.files[0].path = "../../escape.py";
    },
    (m) => {
      m.engines.sttn.revision = "main";
    },
    (m) => {
      m.engines.sttn.weights[0].url = "http://example.test/weights";
    }
  ]) {
    const f = await fixture(t);
    mutate(f.manifest);
    await assert.rejects(prepareSequenceValidation(f), /Unsafe|Unpinned|HTTPS/);
  }
});

test("rejects a junction before creating directories or files beyond it", async (t) => {
  const f = await fixture(t);
  await prepareSequenceValidation(f);
  await fs.rm(path.join(f.root, "upstream"), { recursive: true });
  const outside = path.join(f.parent, "outside");
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(f.root, "upstream"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(prepareSequenceValidation(f), /link/);
  assert.deepEqual(await fs.readdir(outside), []);
});
