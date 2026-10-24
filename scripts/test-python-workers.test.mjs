import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { isolatedEnvironment, runWorkerSuite, workerSuites } from "../tooling/testing/python-workers.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const python = path.join(repoRoot, "fixture-python.exe");
test("environment never inherits user paths, secrets or online model settings", () => {
  const root = path.join(repoRoot, "fixture");
  const environment = isolatedEnvironment(root, {
    PATH: "tools",
    IMAGE_AI_STORAGE_ROOT: "user-data",
    HF_HOME: "user-models",
    HF_HUB_OFFLINE: "0",
    API_TOKEN: "secret",
    PYTHONPATH: "user-python"
  });
  assert.equal(environment.API_TOKEN, undefined);
  assert.equal(environment.PYTHONPATH, undefined);
  assert.equal(environment.PATH, "tools");
  assert.equal(environment.HF_HUB_OFFLINE, "1");
  assert.equal(environment.IMAGE_AI_STORAGE_ROOT, path.join(root, "storage", "image_ai_storage_root"));
  assert.equal(environment.HF_HOME, path.join(root, "models", "hf_home"));
});

for (const suite of Object.keys(workerSuites))
  test(`${suite} copies only frozen source/tests and removes only its own temp directory`, () => {
    let allocated;
    let calls = 0;
    runWorkerSuite({
      repoRoot,
      python,
      suite,
      vendor: suite === "chatterbox" ? path.join(repoRoot, "scripts") : undefined,
      spawn: (_python, args, options) => {
        if (++calls === 1) return { status: 0, stdout: "3.12\n" };
        allocated = options.cwd;
        assert.notEqual(allocated, repoRoot);
        assert.equal(existsSync(path.join(allocated, ".env")), false);
        assert.deepEqual(readdirSync(path.join(allocated, "scripts")).sort(), [...workerSuites[suite]].sort());
        for (const file of workerSuites[suite])
          assert.deepEqual(
            readFileSync(path.join(allocated, "scripts", file)),
            readFileSync(path.join(repoRoot, "scripts", file))
          );
        assert.match(args[3], /socket.socket.connect = guarded_connect/);
        assert.match(args[3], /socket.socketpair = internal_socketpair/);
        assert.match(args[3], /return native_socketpair\(\*args, \*\*kwargs\)/);
        assert.match(args[3], /socketpair_context.active = previous/);
        assert.match(args[3], /External connections must remain blocked/);
        assert.equal(options.env.PYTHONDONTWRITEBYTECODE, "1");
        if (suite === "chatterbox") assert.ok(args[3].includes(JSON.stringify(path.join(repoRoot, "scripts"))));
        return { status: 0 };
      }
    });
    assert.equal(calls, 2);
    assert.equal(existsSync(allocated), false);
    assert.equal(existsSync(repoRoot), true);
  });

test("failure is not skipped and temporary copies are removed", () => {
  let allocated;
  assert.throws(
    () =>
      runWorkerSuite({
        repoRoot,
        python,
        suite: "image",
        spawn: (_python, _args, options) => {
          if (!options.cwd) return { status: 0, stdout: "3.12\n" };
          allocated = options.cwd;
          return { status: 1 };
        }
      }),
    /contracts failed/
  );
  assert.equal(existsSync(allocated), false);
});

test("rejects wrong version, unrecognized suite and relative interpreter without installing anything", () => {
  assert.throws(
    () => runWorkerSuite({ repoRoot, python, suite: "image", spawn: () => ({ status: 0, stdout: "3.11\n" }) }),
    /Python 3.12/
  );
  assert.throws(() => runWorkerSuite({ repoRoot, python, suite: "unknown" }), /--suite/);
  assert.throws(() => runWorkerSuite({ repoRoot, python: "python", suite: "image" }), /absolute path/);
  assert.throws(() => runWorkerSuite({ repoRoot, python, suite: "image", vendor: repoRoot }), /--vendor/);
  assert.throws(() => runWorkerSuite({ repoRoot, python, suite: "chatterbox", vendor: "relative" }), /--vendor/);
});
