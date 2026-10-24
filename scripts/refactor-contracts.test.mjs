/** Refactor-only guardrails. This snapshot contains public metadata, never local data or secrets. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import os from "node:os";
import { smokeSharedContract } from "../tooling/testing/shared-contract-consumer.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "docs/refactoring/contracts.json"), "utf8"));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("shared contract fixtures reject unsafe names before accessing any package", async () => {
  for (const name of ["", "../escape", "audio/library", "UpperCase"]) {
    await assert.rejects(smokeSharedContract(root, { name, declarations: "", runtime: "" }), {
      code: "ERR_ASSERTION"
    });
  }
});

test("shared contract fixture setup failure removes only its unique temporary directory", async () => {
  const name = `failure-${crypto.randomBytes(6).toString("hex").replace(/[0-9]/g, "a")}`;
  const prefix = `toolbox-${name}-contract-`;
  const matching = () => fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith(prefix));
  assert.deepEqual(matching(), []);
  const absentRepository = path.join(os.tmpdir(), `absent-contract-repo-${crypto.randomUUID()}`);
  await assert.rejects(smokeSharedContract(absentRepository, { name, declarations: "", runtime: "" }), {
    code: "ENOENT"
  });
  assert.deepEqual(matching(), []);
});

test("refactoring preserves public commands, package names and the pinned package manager", () => {
  const manifest = readJson("package.json");
  assert.equal(manifest.packageManager, snapshot.packageManager);
  for (const command of snapshot.commands) assert.ok(manifest.scripts[command], `Missing command: ${command}`);
  for (const workspace of snapshot.workspaces) {
    const locations = workspace.locations.filter((location) =>
      fs.existsSync(path.join(root, location, "package.json"))
    );
    assert.equal(locations.length, 1, `Expected one source workspace for ${workspace.name}: ${locations}`);
    assert.equal(readJson(`${locations[0]}/package.json`).name, workspace.name);
  }
});

test("refactoring never changes worker sources, dependency locks or signed capability metadata", () => {
  assert.equal(snapshot.schemaVersion, 1);
  assert.match(snapshot.baseCommit, /^[a-f0-9]{40}$/);
  assert.ok(snapshot.protectedFiles.length > 20);
  for (const entry of snapshot.protectedFiles) {
    // Source relocation is permitted; serialized catalogs and package contents are not rewritten.
    const candidates = [entry.file];
    if (entry.file.startsWith("backend/")) {
      candidates.push(entry.file.replace(/^backend\//, "apps/api/"));
      candidates.push(entry.file.replace(/^backend\/src\/modules\/components\//, "apps/api/src/system/capabilities/"));
    }
    const existing = [...new Set(candidates)].filter((file) => fs.existsSync(path.join(root, file)));
    assert.equal(existing.length, 1, `Expected one protected file: ${entry.file}`);
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, existing[0])))
      .digest("hex");
    assert.equal(digest, entry.sha256, `Protected bytes changed: ${entry.file}`);
  }
});
