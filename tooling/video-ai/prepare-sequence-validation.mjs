/** S00/S01 opt-in asset preparation. Never installs, signs or activates a capability. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const marker = ".toolbox-sequence-validation.json";
const manifestPath = new URL("./sequence-sources.json", import.meta.url);
const digest = (bytes, algorithm = "sha256") => crypto.createHash(algorithm).update(bytes).digest("hex");
const normalize = (bytes) => Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n").trimEnd() + "\n");

export async function prepareSequenceValidation({ root, download = downloadWithCurl, manifest }) {
  manifest ??= JSON.parse(await fs.readFile(manifestPath, "utf8"));
  root = path.resolve(root);
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported sequence source manifest");
  try {
    await fs.mkdir(root);
    await fs.writeFile(
      path.join(root, marker),
      JSON.stringify({ kind: "video-ai-sequence-validation", schemaVersion: 1 }),
      { flag: "wx" }
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const state = JSON.parse(await fs.readFile(path.join(root, marker), "utf8"));
    if (
      state.kind !== "video-ai-sequence-validation" ||
      state.schemaVersion !== 1 ||
      (await fs.lstat(root)).isSymbolicLink()
    )
      throw new Error("Refusing to reuse an unowned validation directory");
  }
  const canonicalRoot = await fs.realpath(root);
  const verified = [];
  for (const [engine, entry] of Object.entries(manifest.engines)) {
    if (
      !["sttn", "propainter"].includes(engine) ||
      !/^[a-f0-9]{40}$/.test(entry.revision) ||
      !/^[\w-]+\/[\w-]+$/.test(entry.repository)
    )
      throw new Error("Unpinned engine source");
    for (const [kind, items] of [
      ["upstream", entry.files],
      ["weights", entry.weights]
    ]) {
      for (const item of items) {
        const relative = item.path ?? item.name;
        if (
          typeof relative !== "string" ||
          relative.includes("\\") ||
          relative.includes(":") ||
          relative.startsWith("/") ||
          relative.split("/").some((part) => !part || part === ".." || part === ".") ||
          !/^[a-f0-9]{64}$/.test(item.sha256)
        )
          throw new Error("Unsafe validation asset path or digest");
        const destination = path.join(root, kind, engine, ...relative.split("/"));
        await ensureOwnedParent(root, path.relative(root, path.dirname(destination)));
        const parent = await fs.realpath(path.dirname(destination));
        const fromRoot = path.relative(canonicalRoot, parent);
        if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot))
          throw new Error("Asset parent escapes validation root");
        try {
          const stat = await fs.lstat(destination);
          if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Validation asset is not a regular file");
          const existing = await fs.readFile(destination);
          if (digest(existing) !== item.sha256 || (item.bytes !== undefined && existing.length !== item.bytes))
            throw new Error("Existing validation asset is corrupt; it was left untouched");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          const url =
            kind === "upstream"
              ? `https://raw.githubusercontent.com/${entry.repository}/${entry.revision}/${relative}`
              : item.url;
          const parsed = new URL(url);
          if (parsed.protocol !== "https:" || parsed.username || parsed.password)
            throw new Error("Assets must use HTTPS");
          const temporary = path.join(parent, `.sequence-${crypto.randomUUID()}.download`);
          try {
            await download(url, temporary);
            const bytes = await fs.readFile(temporary);
            if (kind === "upstream") {
              const blob = Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]);
              if (digest(blob, "sha1") !== item.gitBlobSha1) throw new Error("Upstream Git blob digest mismatch");
            }
            const contents = kind === "upstream" ? normalize(bytes) : bytes;
            if (digest(contents) !== item.sha256 || (item.bytes !== undefined && contents.length !== item.bytes))
              throw new Error("Validation asset digest/size mismatch");
            await fs.writeFile(destination, contents, { flag: "wx" });
          } finally {
            await fs.rm(temporary, { force: true });
          }
        }
        verified.push(path.relative(root, destination));
      }
    }
  }
  return verified;
}

async function ensureOwnedParent(root, relative) {
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      await fs.mkdir(current);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const stat = await fs.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Asset parent is a link or not a directory");
  }
}

async function downloadWithCurl(url, destination) {
  // Native curl honors HTTPS_PROXY; no browser cookies or insecure TLS options.
  await exec(
    process.platform === "win32" ? "curl.exe" : "curl",
    [
      "--fail",
      "--location",
      "--retry",
      "2",
      "--connect-timeout",
      "15",
      "--max-time",
      "300",
      "--silent",
      "--show-error",
      "--proto",
      "=https",
      "--proto-redir",
      "=https",
      "--output",
      destination,
      url
    ],
    { windowsHide: true, timeout: 920_000 }
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--root")
      throw new Error("Usage: node tooling/video-ai/prepare-sequence-validation.mjs --root <isolated-directory>");
    const files = await prepareSequenceValidation({ root: process.argv[3] });
    console.log(`Verified ${files.length} sequence validation files; no capability was modified`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
