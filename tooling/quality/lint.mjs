/** Lint the same Git-owned files as formatting; retain all ESLint rules and exclusions. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBatches, listProjectFiles } from "./check-format.mjs";

const publicEntryUrl = new URL("../../scripts/lint.mjs", import.meta.url).href;
const workspaceRoot = fileURLToPath(new URL("../", publicEntryUrl));
const eslintCli = fileURLToPath(new URL("../node_modules/eslint/bin/eslint.js", publicEntryUrl));

export function runLint({
  repositoryRoot = workspaceRoot,
  args = [],
  listFiles = listProjectFiles,
  spawn = spawnSync
} = {}) {
  const files = listFiles({ repositoryRoot }).filter((file) => /\.(?:[cm]?[jt]sx?|vue)$/i.test(file));
  for (const batch of createBatches(files)) {
    const result = spawn(process.execPath, [eslintCli, "--max-warnings", "0", ...args, ...batch], {
      cwd: repositoryRoot,
      stdio: "inherit",
      windowsHide: true
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && publicEntryUrl === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = runLint({ args: process.argv.slice(2) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
