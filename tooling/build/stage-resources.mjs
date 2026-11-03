// Preserve desktop resource anchors at the public entry.
const publicEntryUrl = new URL("../../apps/desktop/scripts/stage-resources.mjs", import.meta.url).href;

import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { copyRuntimeScripts } from "./runtime-scripts.mjs";

export async function run({
  rebuild,
  desktopRoot = fileURLToPath(new URL("..", publicEntryUrl)),
  repositoryRoot = fileURLToPath(new URL("../../..", publicEntryUrl)),
  args = process.argv.slice(2),
  deploy,
  log = console.log
}) {
  const stageRoot = path.join(desktopRoot, ".stage");
  const stageBackend = path.join(stageRoot, "backend");
  const deployRoot = path.join(stageRoot, ".backend-deploy");
  const rebuildNative = args.includes("--rebuild-native");

  await step("Clearing previous staging resources", async () => {
    await rm(stageRoot, { recursive: true, force: true });
    await mkdir(stageRoot, { recursive: true });
  });

  // A hoisted deployment produces a physical, self-contained node_modules tree.
  // The default isolated layout links packages through pnpm's virtual store; that
  // link graph cannot be copied safely into an Electron ASAR/resources directory.
  await step("Deploying production backend dependencies", () =>
    (deploy ?? runPnpm)(["--config.node-linker=hoisted", "--filter", "backend", "deploy", deployRoot, "--prod"])
  );
  await prepareBackend();
  await step("Copying frontend and runtime scripts", () =>
    Promise.all([
      cp(path.join(repositoryRoot, "apps", "web", "dist"), path.join(stageRoot, "frontend"), { recursive: true }),
      copyRuntimeScripts(repositoryRoot, stageRoot)
    ])
  );

  await step("Checking staged runtime resources", assertStagedRuntime);

  if (rebuildNative) {
    if (!(
      (process.platform === "win32" && process.arch === "x64") ||
      (process.platform === "darwin" && process.arch === "arm64")
    )) {
      throw new Error(
        `Unsupported desktop build host: ${process.platform}-${process.arch}; use Windows x64 or Apple Silicon macOS`
      );
    }
    const electronVersion = await readElectronVersion();
    await step(`Rebuilding native modules for Electron ${electronVersion}`, () =>
      rebuild({
        buildPath: stageBackend,
        electronVersion,
        arch: process.arch,
        force: true,
        mode: "sequential",
        useCache: true
      })
    );
  }

  log(`Desktop resources staged${rebuildNative ? " and native modules rebuilt" : ""}: ${stageRoot}`);

  async function prepareBackend() {
    let files = 0;
    let links = 0;
    let copiedEntries = 0;
    let copying = false;
    await step(
      "Preparing self-contained backend",
      async () => {
        await inspect(deployRoot);
        if (links === 0) {
          // Both paths share a parent/filesystem. Moving this physical tree keeps
          // exactly the same files without copying thousands of small files again.
          await rename(deployRoot, stageBackend);
          log(`[desktop:stage] Backend: ${files} files moved into place; no duplicate file copy required.`);
          return;
        }
        // Hoisted deployments can still contain links (e.g. macOS bin links).
        // Retain the existing dereference semantics for those trees.
        copying = true;
        log(`[desktop:stage] Backend contains ${links} links; copying with links resolved.`);
        await cp(deployRoot, stageBackend, {
          recursive: true,
          dereference: true,
          filter: () => {
            copiedEntries++;
            return true;
          }
        });
        await rm(deployRoot, { recursive: true, force: true });
      },
      () => (copying ? `; ${copiedEntries} entries visited` : `; ${files} files checked`)
    );

    async function inspect(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) links++;
        else if (entry.isDirectory()) await inspect(path.join(directory, entry.name));
        else if (entry.isFile()) files++;
        else throw new Error(`Unsupported backend deployment entry: ${path.join(directory, entry.name)}`);
      }
    }
  }

  async function step(label, action, detail = () => "") {
    const started = performance.now();
    const elapsed = () => `${((performance.now() - started) / 1000).toFixed(1)}s`;
    log(`[desktop:stage] ${label}...`);
    const timer = setInterval(() => log(`[desktop:stage] ${label}: still running (${elapsed()}${detail()}).`), 5000);
    timer.unref();
    try {
      await action();
      log(`[desktop:stage] ${label}: completed (${elapsed()}).`);
    } catch (error) {
      log(`[desktop:stage] ${label}: failed (${elapsed()}).`);
      throw error;
    } finally {
      clearInterval(timer);
    }
  }

  async function assertStagedRuntime() {
    const requiredPaths = [
      path.join(stageBackend, "dist", "desktop-entry.js"),
      path.join(stageBackend, "dist", "data-backup-entry.js"),
      path.join(stageBackend, "node_modules", "better-sqlite3"),
      path.join(stageBackend, "node_modules", "sharp"),
      path.join(stageBackend, "node_modules", "detect-libc"),
      path.join(stageBackend, "node_modules", "@toolbox", "shared", "dist", "index.js"),
      path.join(stageRoot, "frontend", "index.html"),
      path.join(stageRoot, "scripts"),
      path.join(stageRoot, "tooling", "source", "clear-generated.mjs"),
      path.join(stageRoot, "tooling", "source", "cleanup-engine.mjs")
    ];
    for (const requiredPath of requiredPaths) {
      await access(requiredPath);
    }
  }

  async function readElectronVersion() {
    const raw = await readFile(path.join(desktopRoot, "node_modules", "electron", "package.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(typeof parsed.version, "string", "Electron version is required for native rebuilds");
    return parsed.version;
  }

  function runPnpm(args) {
    const pnpmEntrypoint = process.env.npm_execpath;
    if (!pnpmEntrypoint) throw new Error("npm_execpath is required to run pnpm deploy");
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [pnpmEntrypoint, ...args], {
        cwd: repositoryRoot,
        stdio: "inherit",
        windowsHide: true
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`pnpm ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
      });
    });
  }
}
