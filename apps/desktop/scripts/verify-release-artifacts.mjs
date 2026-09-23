import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = readOptions(process.argv.slice(2));
  await verifyReleaseArtifacts(options.directory, options.expectedVersion);
  console.log(`Verified NSIS release artifacts: ${options.directory}`);
}

export async function verifyReleaseArtifacts(directory, expectedVersion) {
  const root = path.resolve(directory);
  const setupName = "EcommerceToolboxSetup.exe";
  await access(path.join(root, setupName));
  await access(path.join(root, `${setupName}.blockmap`));
  const latest = await readFile(path.join(root, "latest.yml"), "utf8");
  const version = latest.match(/^version:\s*(\d+\.\d+\.\d+)\s*$/m)?.[1];
  const url = latest.match(/^\s*(?:-\s*)?url:\s*(\S+)\s*$/m)?.[1];
  const sha512 = latest.match(/^\s*sha512:\s*(\S+)\s*$/m)?.[1];
  assert.ok(version, "latest.yml must declare a stable version");
  if (expectedVersion) assert.equal(version, expectedVersion, "latest.yml version must match the release tag");
  assert.equal(url, setupName, "latest.yml must point to the signed NSIS setup executable");
  assert.ok(sha512, "latest.yml must contain the setup SHA-512");
  assert.equal(await sha512File(path.join(root, setupName)), sha512, "Setup SHA-512 mismatch");
}

function readOptions(args) {
  const index = args.indexOf("--directory");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) throw new Error("Usage: node verify-release-artifacts.mjs --directory <nsis-output>");
  const expectedVersionIndex = args.indexOf("--expected-version");
  const expectedVersion = expectedVersionIndex >= 0 ? args[expectedVersionIndex + 1] : undefined;
  if (expectedVersion && !/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
    throw new Error("--expected-version must be a stable major.minor.patch version");
  }
  return { directory: value, expectedVersion };
}

async function sha512File(filePath) {
  const digest = createHash("sha512");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return digest.digest("base64");
}
