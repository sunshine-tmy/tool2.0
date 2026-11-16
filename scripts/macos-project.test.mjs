import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertElectronRuntimeInstalled,
  assertMacProjectRuntime,
  ensureNestedPnpmCommand,
  hasElectronProcessInGroup,
  normalizeProcessStartTime,
  parseProcessSnapshot,
  resolvePackageManager,
  sessionCommandSha256
} from "./macos-project.mjs";

test(
  "actual command launchers run from a ZIP-extracted project without .git or the project as cwd",
  { skip: process.platform !== "darwin" },
  async () => {
    const scratch = await mkdtemp(path.join(os.tmpdir(), "toolbox-macos-launcher-zip-"));
    let ownedProjectRoot;
    let ownedGroupId;
    const occupiedServer = net.createServer();
    try {
      const sourceRoot = path.join(scratch, "源码 中文 项目");
      const extractRoot = path.join(scratch, "解压 工作区");
      const callerRoot = path.join(scratch, "其他 工作目录");
      const shimDirectory = path.join(sourceRoot, "本地 pnpm shim");
      const sourceScripts = path.join(sourceRoot, "scripts");
      const shimPath = path.join(shimDirectory, "pnpm");
      const zipPath = path.join(scratch, "源码.zip");
      const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
      await Promise.all([
        mkdir(sourceScripts, { recursive: true }),
        mkdir(callerRoot),
        mkdir(shimDirectory, { recursive: true })
      ]);
      await Promise.all(
        ["start.command", "stop.command"].map((name) =>
          copyFile(path.join(fixtureRoot, "..", name), path.join(sourceRoot, name)).then(() =>
            chmod(path.join(sourceRoot, name), 0o755)
          )
        )
      );
      await Promise.all([
        copyFile(path.join(fixtureRoot, "macos-project.mjs"), path.join(sourceScripts, "macos-project.mjs")),
        copyFile(
          path.join(fixtureRoot, "macos-offline-resources.mjs"),
          path.join(sourceScripts, "macos-offline-resources.mjs")
        ),
        copyFile(path.join(fixtureRoot, "..", "package.json"), path.join(sourceRoot, "package.json"))
      ]);
      const electron = path.join(
        sourceRoot,
        "apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
      );
      const tsx = path.join(sourceRoot, "apps/api/node_modules/tsx/dist/cli.mjs");
      await Promise.all([
        mkdir(path.dirname(electron), { recursive: true }),
        mkdir(path.dirname(tsx), { recursive: true })
      ]);
      await Promise.all([
        mkdir(path.join(sourceRoot, "node_modules")),
        writeFile(
          electron,
          "#!/usr/bin/env node\nimport fs from 'node:fs';\nimport net from 'node:net';\nconst server = net.createServer();\nserver.once('error', (error) => { if (error.code !== 'EADDRINUSE') process.exit(1); fs.writeFileSync(process.env.TOOLBOX_M09_PORT_RESULT, error.code); });\nserver.listen(Number(process.env.TOOLBOX_M09_TEST_PORT), '127.0.0.1');\nsetInterval(() => {}, 1000);\n",
          "utf8"
        ),
        writeFile(tsx, "process.exitCode = 0;\n", "utf8"),
        writeFile(
          shimPath,
          '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 11.7.0; exit 0; fi\nif [ "$1" = "--filter" ] && [ "$2" = "desktop" ] && [ "$3" = "start" ]; then\n  "$TOOLBOX_M09_FAKE_ELECTRON" &\n  worker=$!\n  wait "$worker"\nfi\nexit 0\n',
          "utf8"
        )
      ]);
      await chmod(shimPath, 0o755);
      await chmod(electron, 0o755);

      execFileSync("/usr/bin/zip", ["-r", "-q", zipPath, path.basename(sourceRoot)], { cwd: scratch });
      await mkdir(extractRoot);
      execFileSync("/usr/bin/unzip", ["-q", zipPath, "-d", extractRoot]);

      const extractedRoot = path.join(extractRoot, path.basename(sourceRoot));
      const canonicalExtractedRoot = await realpath(extractedRoot);
      ownedProjectRoot = canonicalExtractedRoot;
      await assert.rejects(stat(path.join(extractedRoot, ".git")), { code: "ENOENT" });
      await new Promise((resolve, reject) => {
        occupiedServer.once("error", reject);
        occupiedServer.listen(0, "127.0.0.1", resolve);
      });
      const occupiedAddress = occupiedServer.address();
      assert.ok(occupiedAddress && typeof occupiedAddress !== "string");
      const portCollisionResult = path.join(scratch, "port-collision.txt");
      const environment = {
        ...process.env,
        PATH: `${path.join(canonicalExtractedRoot, "本地 pnpm shim")}:${process.env.PATH ?? "/usr/bin:/bin"}`,
        TOOLBOX_M09_TEST_PORT: String(occupiedAddress.port),
        TOOLBOX_M09_PORT_RESULT: portCollisionResult,
        TOOLBOX_M09_FAKE_ELECTRON: path.join(
          canonicalExtractedRoot,
          "apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
        )
      };

      for (const name of ["start.command", "stop.command"]) {
        const launcher = path.join(canonicalExtractedRoot, name);
        const permissions = (await stat(launcher)).mode & 0o777;
        assert.equal(permissions & 0o111, 0o111, `${name} lost its executable bit in the ZIP round trip`);
      }

      const start = spawnSync(path.join(canonicalExtractedRoot, "start.command"), [], {
        cwd: callerRoot,
        encoding: "utf8",
        env: environment,
        timeout: 30_000
      });
      assert.ifError(start.error);
      assert.equal(start.status, 0, start.stderr);
      const sessionPath = path.join(canonicalExtractedRoot, ".runtime/macos-source-launcher/session.json");
      const session = JSON.parse(await readFile(sessionPath, "utf8"));
      assert.equal(session.projectRoot, canonicalExtractedRoot);
      ownedGroupId = session.groupId;
      assert.equal(session.groupId, session.pid);
      let portCollision;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        portCollision = await readFile(portCollisionResult, "utf8").catch(() => undefined);
        if (portCollision) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(portCollision, "EADDRINUSE");

      const stop = spawnSync(path.join(canonicalExtractedRoot, "stop.command"), [], {
        cwd: callerRoot,
        encoding: "utf8",
        env: environment,
        timeout: 30_000
      });
      assert.ifError(stop.error);
      assert.equal(stop.status, 0, stop.stderr);
      await assert.rejects(readFile(sessionPath, "utf8"), { code: "ENOENT" });
      assert.throws(() => process.kill(-session.groupId, 0), { code: "ESRCH" });
      assert.equal(occupiedServer.listening, true, "Stopping the project closed the unrelated occupied port");
      ownedGroupId = undefined;
    } finally {
      if (ownedProjectRoot && ownedGroupId) {
        const session = await readFile(
          path.join(ownedProjectRoot, ".runtime/macos-source-launcher/session.json"),
          "utf8"
        )
          .then((text) => JSON.parse(text))
          .catch(() => undefined);
        if (session?.projectRoot === ownedProjectRoot && session.groupId === ownedGroupId) {
          try {
            process.kill(-ownedGroupId, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        }
      }
      if (occupiedServer.listening)
        await new Promise((resolve, reject) => occupiedServer.close((error) => (error ? reject(error) : resolve())));
      assert.equal(path.dirname(await realpath(scratch)), await realpath(os.tmpdir()));
      assert.match(path.basename(scratch), /^toolbox-macos-launcher-zip-/);
      await rm(scratch, { recursive: true, force: true });
    }
  }
);

test("Mac project launcher requires native Apple Silicon and Node 24", () => {
  assert.doesNotThrow(() => assertMacProjectRuntime({ platform: "darwin", arch: "arm64", nodeVersion: "24.8.0" }));
  assert.throws(
    () => assertMacProjectRuntime({ platform: "darwin", arch: "x64", nodeVersion: "24.8.0" }),
    /Apple Silicon macOS/
  );
  assert.throws(
    () => assertMacProjectRuntime({ platform: "darwin", arch: "arm64", nodeVersion: "22.0.0" }),
    /需要 Node.js 24/
  );
});

test("launcher requires an explicitly installed Electron runtime before doing bootstrap work", async () => {
  const paths = [];
  const installed = await assertElectronRuntimeInstalled({
    root: "/project",
    access: async (file) => paths.push(file)
  });
  assert.equal(installed, paths[0]);
  assert.match(installed, /apps[\\/]desktop[\\/]node_modules[\\/]electron[\\/]dist[\\/]Electron\.app/);

  await assert.rejects(
    () =>
      assertElectronRuntimeInstalled({
        root: "/project",
        access: async () => {
          const error = new Error("missing");
          error.code = "ENOENT";
          throw error;
        }
      }),
    /隐式联网.*node apps\/desktop\/node_modules\/electron\/install\.js/
  );
});

test("process session identity rejects malformed and unrelated process snapshots", () => {
  const command = "/opt/homebrew/bin/node /opt/homebrew/bin/pnpm.cjs --filter desktop start";
  assert.deepEqual(
    parseProcessSnapshot({
      processId: "421",
      groupId: "421",
      startedAt: "Thu Nov 12 10:00:00 2026",
      command
    }),
    { pid: 421, groupId: 421, startedAt: "Thu Nov 12 10:00:00 2026", command }
  );
  assert.equal(parseProcessSnapshot({ processId: "nope", groupId: "421", startedAt: "a", command: "b" }), undefined);
  assert.equal(parseProcessSnapshot({ processId: "421", groupId: "", startedAt: "a", command: "b" }), undefined);
  assert.equal(sessionCommandSha256(command), sessionCommandSha256(command));
  assert.notEqual(sessionCommandSha256(command), sessionCommandSha256("pnpm --filter backend start"));
  assert.match(sessionCommandSha256(command), /^[a-f0-9]{64}$/);
});

test("process start identity is stable across English and Chinese ps locales", () => {
  const english = normalizeProcessStartTime("Mon Nov 16 01:35:55 2026");
  const chinese = normalizeProcessStartTime("一 11/16 01:35:55 2026");
  assert.equal(english, chinese);
  assert.notEqual(english, normalizeProcessStartTime("一 11/16 01:35:56 2026"));
  assert.equal(normalizeProcessStartTime("一 11/16 01:35:55 2025"), undefined);
});

test("launcher recognizes only an Electron executable inside its own process group", () => {
  const processList = [
    " 421 /Users/test/apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .",
    " 422 /Users/test/apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron --type=renderer",
    " 421 node /Users/test/apps/desktop/node_modules/electron/install.js"
  ].join("\n");
  assert.equal(hasElectronProcessInGroup(processList, 421), true);
  assert.equal(hasElectronProcessInGroup(processList, 423), false);
  assert.equal(hasElectronProcessInGroup("421 node pnpm --filter desktop start", 421), false);
});

test("launcher selects the repository-pinned pnpm without allowing Corepack network downloads", async () => {
  const calls = [];
  const selected = await resolvePackageManager({}, undefined, (command, args, options) => {
    calls.push({ command, args, env: options.env });
    return { status: 0, stdout: command === "pnpm" ? "11.25.0\n" : "11.7.0\n" };
  });
  assert.deepEqual({ command: selected.command, prefix: selected.prefix }, { command: "corepack", prefix: ["pnpm"] });
  assert.equal(selected.env.COREPACK_ENABLE_NETWORK, "0");
  assert.deepEqual(
    calls.map((call) => call.args),
    [["--version"], ["pnpm", "--version"]]
  );
});

test("Corepack fallback exposes a recursive pnpm shim for package scripts", async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "toolbox-corepack-pnpm-shim-"));
  const shimDirectory = path.join(scratch, "launcher-state");
  const fakeCorepackDirectory = path.join(scratch, "corepack-bin");
  const argsFile = path.join(scratch, "corepack-args.txt");
  try {
    await mkdir(fakeCorepackDirectory);
    const corepack = path.join(fakeCorepackDirectory, "corepack");
    await writeFile(
      corepack,
      '#!/bin/sh\nprintf "%s\\n" "$@" > "$TOOLBOX_TEST_COREPACK_ARGS"\nprintf "11.7.0\\n"\n',
      "utf8"
    );
    await chmod(corepack, 0o700);

    const selected = {
      command: "corepack",
      prefix: ["pnpm"],
      env: { PATH: fakeCorepackDirectory, TOOLBOX_TEST_COREPACK_ARGS: argsFile, COREPACK_ENABLE_NETWORK: "0" }
    };
    const configured = await ensureNestedPnpmCommand(selected, { directory: shimDirectory });
    assert.equal(configured.command, "corepack");
    assert.equal(configured.env.COREPACK_ENABLE_NETWORK, "0");
    assert.equal(configured.env.PATH.split(path.delimiter)[0], path.join(shimDirectory, "bin"));

    const result = spawnSync("pnpm", ["--version"], { env: configured.env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "11.7.0");
    assert.equal(await readFile(argsFile, "utf8"), "pnpm\n--version\n");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
