import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { loopbackOrigin, parseSmokeArguments } from "./smoke-installed-desktop.mjs";

test("installed desktop smoke command requires explicit bounded arguments", () => {
  assert.deepEqual(parseSmokeArguments(["--exe", "app.exe", "--report", "result.json", "--timeout-seconds", "45"]), {
    executable: path.resolve("app.exe"),
    report: path.resolve("result.json"),
    timeoutSeconds: 45
  });
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
