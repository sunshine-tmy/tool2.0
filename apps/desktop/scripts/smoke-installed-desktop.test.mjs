import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import test from "node:test";
import path from "node:path";
import {
  evaluateInTarget,
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

test("installed desktop smoke waits for a page execution context after navigation", async () => {
  const originalWebSocket = globalThis.WebSocket;
  let evaluationCount = 0;
  class FakeWebSocket extends EventTarget {
    constructor() {
      super();
      queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }

    send(serialized) {
      const command = JSON.parse(serialized);
      if (command.method === "Runtime.evaluate") evaluationCount += 1;
      const response =
        command.method === "Runtime.evaluate" && evaluationCount === 1
          ? { id: command.id, error: { message: "Cannot find default execution context" } }
          : { id: command.id, result: { result: { value: true } } };
      queueMicrotask(() => {
        const event = new Event("message");
        Object.defineProperty(event, "data", { value: JSON.stringify(response) });
        this.dispatchEvent(event);
      });
    }

    close() {}
  }

  globalThis.WebSocket = FakeWebSocket;
  try {
    assert.equal(await evaluateInTarget({ webSocketDebuggerUrl: "ws://127.0.0.1/devtools/page/test" }, "true"), true);
    assert.equal(evaluationCount, 2);
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
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
