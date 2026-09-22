import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputDirectory = readDirectory(process.argv.slice(2));
  await verifyReleaseArtifacts(outputDirectory);
  console.log(`Verified Squirrel release artifacts: ${outputDirectory}`);
}

export async function verifyReleaseArtifacts(directory) {
  const root = path.resolve(directory);
  await access(path.join(root, "EcommerceToolboxSetup.exe"));
  const releases = (await readFile(path.join(root, "RELEASES"), "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert.ok(releases.length > 0, "RELEASES must contain at least one full package");
  for (const line of releases) {
    const [sha1, name, sizeText, ...rest] = line.split(/\s+/);
    assert.equal(rest.length, 0, `Invalid RELEASES entry: ${line}`);
    assert.match(sha1, /^[A-Fa-f0-9]{40}$/, `Invalid package SHA-1: ${line}`);
    assert.match(name, /^EcommerceToolbox-\d+\.\d+\.\d+-full\.nupkg$/, `Unexpected package name: ${line}`);
    assert.ok(Number.isSafeInteger(Number(sizeText)) && Number(sizeText) > 0, `Invalid package size: ${line}`);
    const packagePath = safeChildPath(root, name);
    const packageStat = await stat(packagePath);
    assert.equal(packageStat.size, Number(sizeText), `Package size mismatch: ${name}`);
    assert.equal((await sha1File(packagePath)).toUpperCase(), sha1.toUpperCase(), `Package digest mismatch: ${name}`);
  }
}

function readDirectory(args) {
  const index = args.indexOf("--directory");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) throw new Error("Usage: node verify-release-artifacts.mjs --directory <squirrel-output>");
  return value;
}

function safeChildPath(root, name) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, name);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Unsafe RELEASES package path");
  return resolved;
}

async function sha1File(filePath) {
  const digest = createHash("sha1");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return digest.digest("hex");
}
