/** Discover only Node engineering tests. Model/installer smoke commands are never test candidates. */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export function discoverScriptTests(root) {
  const files = [];
  function visit(relative) {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const filename = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile() && entry.name.endsWith(".test.mjs")) files.push(filename);
    }
  }
  for (const directory of ["scripts", "tooling", "apps/desktop/scripts"]) visit(directory);
  return files.sort();
}

export function runScriptTests(root, args = [], spawn = spawnSync) {
  const files = discoverScriptTests(root);
  if (!files.length) throw new Error("No engineering tests discovered");
  if (args.length === 1 && args[0] === "--list") {
    console.log(files.join("\n"));
    return 0;
  }
  const result = spawn(process.execPath, ["--test", ...args, ...files], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
