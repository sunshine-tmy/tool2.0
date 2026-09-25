import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import test from "node:test";
import path from "node:path";
import {
  loopbackOrigin,
  MANAGED_PERSISTENT_DIRECTORIES,
  parseSmokeArguments,
  verifyPersistentWriteLocations
} from "./smoke-installed-desktop.mjs";

test("installed desktop smoke command requires explicit bounded arguments", () => {
  assert.deepEqual(parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--timeout-seconds", "45"]), {
    executable: path.resolve("app.exe"),
    report: path.resolve("result.json"),
    timeoutSeconds: 45,
    componentTimeoutSeconds: 900
  });
});

test("installed desktop smoke can select an explicit first-run migration scenario", () => {
  assert.deepEqual(
    parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--startup-migration", "migrate"]),
    {
      executable: path.resolve("app.exe"),
      report: path.resolve("result.json"),
      timeoutSeconds: 90,
      componentTimeoutSeconds: 900,
      startupMigration: "migrate"
    }
  );
  assert.throws(
    () => parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--startup-migration", "fresh"]),
    /only supports the explicit value 'migrate'/
  );
});

test("installed desktop smoke can exercise only the fixed signed Edge-TTS component lifecycle", () => {
  assert.deepEqual(
    parseSmokeArguments([
      "--exe",
      "app.exe",
      "--report",
      "result.json",
      "--component-id",
      "edge-tts",
      "--component-timeout-seconds",
      "1200"
    ]),
    {
      executable: path.resolve("app.exe"),
      report: path.resolve("result.json"),
      timeoutSeconds: 90,
      componentTimeoutSeconds: 1200,
      componentId: "edge-tts"
    }
  );
  assert.throws(
    () => parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--component-id", "arbitrary"]),
    /fixed acceptance capability 'edge-tts'/
  );
  assert.throws(
    () => parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--component-timeout-seconds", "1200"]),
    /requires --component-id/
  );
});

test("installed desktop smoke command rejects unsafe or incomplete arguments", () => {
  assert.throws(() => parseSmokeArguments(["--exe", "app.exe"]), /Usage/);
  assert.throws(
    () => parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--timeout-seconds", "5"]),
    /15 to 180/
  );
  assert.throws(
    () => parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--unknown", "x"]),
    /Unexpected option/
  );
});

test("installed desktop smoke accepts only a loopback backend page", () => {
  assert.equal(loopbackOrigin("http://127.0.0.1:43123/settings"), "http://127.0.0.1:43123");
  assert.throws(() => loopbackOrigin("https://example.com"), /loopback/);
  assert.throws(() => loopbackOrigin("http://localhost:43123"), /loopback/);
});

test("installed desktop smoke verifies persistent directories and SQLite are inside the selected data root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "desktop-persistent-paths-"));
  const executable = path.join(root, "EcommerceToolbox.exe");
  const dataRoot = path.join(root, "data");
  try {
    for (const relativeDirectory of MANAGED_PERSISTENT_DIRECTORIES) {
      await mkdir(path.join(dataRoot, relativeDirectory), { recursive: true });
    }
    await writeFile(path.join(dataRoot, "data", "toolbox.db"), "test database");
    await writeFile(
      path.join(dataRoot, "config", "desktop-settings.json"),
      JSON.stringify({ automaticUpdateChecks: false })
    );
    assert.deepEqual(await verifyPersistentWriteLocations(executable), [
      ...MANAGED_PERSISTENT_DIRECTORIES,
      "data/toolbox.db",
      "config/desktop-settings.json"
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
