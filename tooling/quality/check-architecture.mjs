// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/check-architecture.mjs", import.meta.url).href;

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkArchitecture } from "./architecture.mjs";
import { isTestSource } from "./source-policy.mjs";

const root = fileURLToPath(new URL("../", publicEntryUrl));
const sources = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8"
})
  .split("\0")
  .filter(
    (file) =>
      /^(?:backend|frontend|apps\/(?:api|web|desktop)|packages\/(?:shared|runtime-core))\//.test(file) &&
      /\.(?:ts|tsx|vue)$/.test(file) &&
      existsSync(path.join(root, file)) &&
      !isTestSource(file) &&
      !file.endsWith(".d.ts")
  );
const violations = checkArchitecture(
  new Map(sources.map((file) => [file, readFileSync(path.join(root, file), "utf8")]))
);
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Architecture boundaries passed (${sources.length} production/config sources; no cross-application debts).`
  );
