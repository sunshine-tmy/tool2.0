/** Inspect the implementation behind a checked-in thin entry, without importing or executing it. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function readEntrySource(entry) {
  const filename = entry instanceof URL ? fileURLToPath(entry) : entry;
  const source = await readFile(filename, "utf8");
  const relative =
    source.match(/from ["']([^"']*tooling\/[^"']+)["']/)?.[1] ??
    source.match(/Join-Path \$PSScriptRoot "([^"\n]*tooling\\[^"\n]+)"/)?.[1];
  return relative ? readFile(path.resolve(path.dirname(filename), relative.replaceAll("\\", "/")), "utf8") : source;
}
