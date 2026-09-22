import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rebuild } from "@electron/rebuild";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const stageRoot = path.join(desktopRoot, ".stage");
const stageBackend = path.join(stageRoot, "backend");
const deployRoot = path.join(stageRoot, ".backend-deploy");
const rebuildNative = process.argv.includes("--rebuild-native");

await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });

// A hoisted deployment produces a physical, self-contained node_modules tree.
// The default isolated layout links packages through pnpm's virtual store; that
// link graph cannot be copied safely into an Electron ASAR/resources directory.
await runPnpm(["--config.node-linker=hoisted", "--filter", "backend", "deploy", deployRoot, "--prod"]);
await cp(deployRoot, stageBackend, { recursive: true, dereference: true });
await rm(deployRoot, { recursive: true, force: true });
await Promise.all([
  cp(path.join(repositoryRoot, "frontend", "dist"), path.join(stageRoot, "frontend"), { recursive: true }),
  cp(path.join(repositoryRoot, "scripts"), path.join(stageRoot, "scripts"), { recursive: true })
]);

await assertStagedRuntime();

if (rebuildNative) {
  const electronVersion = await readElectronVersion();
  await rebuild({
    buildPath: stageBackend,
    electronVersion,
    arch: "x64",
    force: true,
    mode: "sequential",
    useCache: true
  });
}

console.log(`Desktop resources staged${rebuildNative ? " and native modules rebuilt" : ""}: ${stageRoot}`);

async function assertStagedRuntime() {
  const requiredPaths = [
    path.join(stageBackend, "dist", "desktop-entry.js"),
    path.join(stageBackend, "node_modules", "better-sqlite3"),
    path.join(stageBackend, "node_modules", "sharp"),
    path.join(stageBackend, "node_modules", "detect-libc"),
    path.join(stageBackend, "node_modules", "@toolbox", "shared", "dist", "index.js"),
    path.join(stageRoot, "frontend", "index.html"),
    path.join(stageRoot, "scripts")
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
