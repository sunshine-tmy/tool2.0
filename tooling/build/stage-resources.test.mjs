import assert from "node:assert/strict";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { run } from "./stage-resources.mjs";

async function fixture(t) {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "toolbox-stage-resources-"));
  t.after(async () => {
    assert.equal(path.dirname(scratch), path.resolve(os.tmpdir()));
    assert.ok(path.basename(scratch).startsWith("toolbox-stage-resources-"));
    await rm(scratch, { recursive: true, force: true });
  });
  const repositoryRoot = path.join(scratch, "中文 空格");
  const desktopRoot = path.join(repositoryRoot, "apps", "desktop");
  const stageRoot = path.join(desktopRoot, ".stage");
  const backend = path.join(stageRoot, "backend");
  const deployment = path.join(stageRoot, ".backend-deploy");
  const messages = [];
  const calls = [];
  const runtime = JSON.parse(await readFile(new URL("./runtime-scripts.json", import.meta.url), "utf8"));
  const backendFiles = [
    "dist/desktop-entry.js",
    "dist/data-backup-entry.js",
    "node_modules/better-sqlite3/index.js",
    "node_modules/sharp/index.js",
    "node_modules/detect-libc/index.js",
    "node_modules/@toolbox/shared/dist/index.js",
    "node_modules/@toolbox/runtime-core/dist/index.js"
  ];
  async function put(relative, content = `fixture: ${relative}`) {
    const file = path.join(repositoryRoot, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  for (const relative of Object.values(runtime.groups).flat()) await put(relative);
  await put("apps/web/dist/index.html");
  await put("apps/desktop/node_modules/electron/package.json", JSON.stringify({ version: "44.4.3" }));
  const deploy = async (args) => {
    calls.push(args);
    for (const relative of backendFiles) await put(`apps/desktop/.stage/.backend-deploy/${relative}`);
  };
  return {
    scratch,
    stageRoot,
    backend,
    deployment,
    messages,
    calls,
    put,
    deploy,
    backendFiles,
    options: {
      repositoryRoot,
      desktopRoot,
      deploy,
      args: [],
      log: (message) => messages.push(message),
      rebuild: async () => assert.fail("ordinary staging must not rebuild native modules")
    }
  };
}

test("physical deployment is moved without duplicating files; resource paths and binary contents stay intact", async (t) => {
  const f = await fixture(t);
  await f.put("apps/desktop/.stage/stale.txt");
  const binary = Buffer.from([0, 255, 13, 10, 128, 42]);
  let sourceInode;
  await run({
    ...f.options,
    deploy: async (args) => {
      await assert.rejects(access(path.join(f.stageRoot, "stale.txt")), { code: "ENOENT" });
      await f.deploy(args);
      await f.put("apps/desktop/.stage/.backend-deploy/node_modules/sharp/native.node", binary);
      sourceInode = (await lstat(path.join(f.deployment, "dist/desktop-entry.js"))).ino;
    }
  });
  assert.deepEqual(f.calls, [
    ["--config.node-linker=hoisted", "--filter", "backend", "deploy", f.deployment, "--prod"]
  ]);
  assert.equal((await lstat(path.join(f.backend, "dist/desktop-entry.js"))).ino, sourceInode);
  assert.deepEqual(await readFile(path.join(f.backend, "node_modules/sharp/native.node")), binary);
  for (const relative of f.backendFiles) {
    assert.equal(
      await readFile(path.join(f.backend, relative), "utf8"),
      `fixture: apps/desktop/.stage/.backend-deploy/${relative}`
    );
  }
  assert.deepEqual((await readdir(f.stageRoot)).sort(), ["backend", "frontend", "scripts", "tooling"]);
  assert.equal(
    await readFile(path.join(f.stageRoot, "frontend/index.html"), "utf8"),
    "fixture: apps/web/dist/index.html"
  );
  assert.equal(
    await readFile(path.join(f.stageRoot, "tooling/source/cleanup-engine.mjs"), "utf8"),
    "fixture: tooling/source/cleanup-engine.mjs"
  );
  assert.equal(
    await readFile(path.join(f.stageRoot, "scripts/video-ai-worker-launcher.py"), "utf8"),
    "fixture: scripts/video-ai-worker-launcher.py"
  );
  assert.ok(f.messages.some((message) => message.includes("8 files moved into place")));
  assert.ok(f.messages.some((message) => message.includes("Checking staged runtime resources: completed")));
  assert.equal(f.messages.at(-1), `Desktop resources staged: ${f.stageRoot}`);
});

test("deployment links are still dereferenced into independent files instead of being moved", async (t) => {
  const f = await fixture(t);
  const source = path.join(f.scratch, "external dependency");
  await mkdir(source);
  await writeFile(path.join(source, "entry.js"), "external package");
  await run({
    ...f.options,
    deploy: async (args) => {
      await f.deploy(args);
      await symlink(
        source,
        path.join(f.deployment, "node_modules", "linked-package"),
        process.platform === "win32" ? "junction" : "dir"
      );
    }
  });
  const destination = path.join(f.backend, "node_modules/linked-package");
  assert.equal((await lstat(destination)).isSymbolicLink(), false);
  assert.equal(await readFile(path.join(destination, "entry.js"), "utf8"), "external package");
  await writeFile(path.join(source, "entry.js"), "changed source");
  assert.equal(await readFile(path.join(destination, "entry.js"), "utf8"), "external package");
  await assert.rejects(access(f.deployment), { code: "ENOENT" });
  assert.ok(f.messages.some((message) => message.includes("contains 1 links")));
  assert.ok(!f.messages.some((message) => message.includes("files moved into place")));
});

test("failed link resolution retains the deployment, reports the failed stage and never rebuilds", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    run({
      ...f.options,
      deploy: async (args) => {
        await f.deploy(args);
        await symlink(
          path.join(f.scratch, "missing target"),
          path.join(f.deployment, "broken-link"),
          process.platform === "win32" ? "junction" : "dir"
        );
      }
    }),
    { code: "ENOENT" }
  );
  await access(path.join(f.deployment, "dist/desktop-entry.js"));
  assert.ok(f.messages.some((message) => message.includes("Preparing self-contained backend: failed")));
  assert.ok(!f.messages.some((message) => message.startsWith("Desktop resources staged")));
});

test("slow or failed stages emit heartbeats, preserve the original error, and always clear timers", async (t) => {
  const f = await fixture(t);
  const timers = new Set();
  t.mock.method(globalThis, "setInterval", (callback, interval) => {
    assert.equal(interval, 5000);
    const timer = { callback, unref() {} };
    timers.add(timer);
    return timer;
  });
  t.mock.method(globalThis, "clearInterval", (timer) => timers.delete(timer));
  const failure = new Error("deploy failed");
  await assert.rejects(
    run({
      ...f.options,
      deploy: async () => {
        assert.equal(timers.size, 1);
        for (const timer of timers) timer.callback();
        throw failure;
      }
    }),
    (error) => error === failure
  );
  assert.equal(timers.size, 0);
  assert.ok(f.messages.some((message) => message.includes("Deploying production backend dependencies: still running")));
  assert.ok(f.messages.some((message) => message.includes("Deploying production backend dependencies: failed")));
  assert.ok(!f.messages.some((message) => message.startsWith("Desktop resources staged")));
});

test("missing required runtime stops at validation before native rebuild", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    run({
      ...f.options,
      args: ["--rebuild-native"],
      deploy: async (args) => {
        await f.deploy(args);
        await rm(path.join(f.deployment, "dist/data-backup-entry.js"));
      }
    }),
    { code: "ENOENT" }
  );
  assert.ok(f.messages.some((message) => message.includes("Checking staged runtime resources: failed")));
  assert.ok(!f.messages.some((message) => message.startsWith("Desktop resources staged")));
});

test("public entry uses the real deploy runner and reports missing pnpm context before spawning", async (t) => {
  const f = await fixture(t);
  const previous = process.env.npm_execpath;
  t.after(() => {
    if (previous === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previous;
  });
  delete process.env.npm_execpath;
  await assert.rejects(run({ ...f.options, deploy: undefined }), /npm_execpath is required to run pnpm deploy/);
  assert.ok(f.messages.some((message) => message.includes("Deploying production backend dependencies: failed")));
  assert.ok(!f.messages.some((message) => message.startsWith("Desktop resources staged")));
});

test("native rebuild keeps the existing Electron version, flags, final path and failure propagation", async (t) => {
  const f = await fixture(t);
  const calls = [];
  const options = {
    ...f.options,
    args: ["--rebuild-native"],
    rebuild: async (input) => {
      await access(path.join(f.stageRoot, "frontend/index.html"));
      calls.push(input);
    }
  };
  const supported =
    (process.platform === "win32" && process.arch === "x64") ||
    (process.platform === "darwin" && process.arch === "arm64");
  if (!supported) {
    await assert.rejects(run(options), /Unsupported desktop build host/);
    assert.equal(calls.length, 0);
    return;
  }
  await run(options);
  assert.deepEqual(calls, [
    {
      buildPath: f.backend,
      electronVersion: "44.4.3",
      arch: process.arch,
      force: true,
      mode: "sequential",
      useCache: true
    }
  ]);
  assert.equal(f.messages.at(-1), `Desktop resources staged and native modules rebuilt: ${f.stageRoot}`);
  const failure = new Error("native rebuild failed");
  f.messages.length = 0;
  await assert.rejects(
    run({
      ...options,
      rebuild: async () => {
        throw failure;
      }
    }),
    (error) => error === failure
  );
  assert.ok(f.messages.some((message) => message.includes("Rebuilding native modules for Electron 44.4.3: failed")));
  assert.ok(!f.messages.some((message) => message.startsWith("Desktop resources staged")));
});
