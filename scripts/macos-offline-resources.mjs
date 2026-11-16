/** macOS source-launch resource inventory and explicit, digest-checked preparation. */
import { createHash } from "node:crypto";
import { createWriteStream, createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export function parseMacCatalogSource(source) {
  const startMarker = "export const packagedComponentCatalog = ";
  const endMarker = " satisfies ComponentCatalog;";
  const start = source.indexOf(startMarker);
  const end = source.lastIndexOf(endMarker);
  if (start < 0 || end <= start) throw new Error("Mac signed component catalog is not a generated JSON object");
  const raw = source.slice(start + startMarker.length, end).trim();
  const catalog = JSON.parse(raw);
  if (!Array.isArray(catalog.manifests)) throw new Error("Mac signed component catalog has no manifests");
  return catalog;
}

export function macArchiveInventory(catalog) {
  const result = [];
  const names = new Set();
  for (const manifest of catalog.manifests) {
    if (manifest.platform !== "darwin-arm64") throw new Error(`Non-Mac component in Mac catalog: ${manifest.id}`);
    for (const archive of [manifest.archive, ...(manifest.additionalArchives ?? [])]) {
      const url = new URL(archive.url);
      const filename = decodeURIComponent(path.posix.basename(url.pathname));
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        path.basename(filename) !== filename ||
        !filename.endsWith(".tar.gz") ||
        !Number.isSafeInteger(archive.bytes) ||
        archive.bytes < 1 ||
        typeof archive.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(archive.sha256)
      )
        throw new Error(`Invalid signed Mac archive metadata: ${manifest.id}`);
      if (names.has(filename)) throw new Error(`Duplicate Mac archive filename: ${filename}`);
      names.add(filename);
      result.push({
        componentId: manifest.id,
        version: manifest.version,
        filename,
        url: url.toString(),
        bytes: archive.bytes,
        sha256: archive.sha256.toLowerCase()
      });
    }
  }
  return result;
}

export async function sha256File(filename) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filename)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function findArchive(root, archive) {
  const candidates = [
    path.join(root, archive.filename),
    path.join(root, archive.componentId, archive.version, archive.filename)
  ];
  for (const filename of candidates) {
    const stat = await fs.lstat(filename).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!stat) continue;
    if (!stat.isFile() || stat.isSymbolicLink()) return { filename, error: "not a regular file" };
    const digest = await sha256File(filename);
    if (digest.bytes !== archive.bytes) return { filename, error: `size ${digest.bytes}, expected ${archive.bytes}` };
    if (digest.sha256 !== archive.sha256) return { filename, error: "SHA-256 mismatch" };
    return { filename };
  }
  return undefined;
}

export async function inspectMacOfflineResources(catalog, root) {
  const archives = macArchiveInventory(catalog);
  const missing = [];
  const invalid = [];
  for (const archive of archives) {
    const result = await findArchive(root, archive);
    if (!result) missing.push(archive);
    else if (result.error) invalid.push({ ...archive, detail: result.error });
  }
  return { archives, missing, invalid, totalBytes: archives.reduce((sum, archive) => sum + archive.bytes, 0) };
}

export async function prepareMacOfflineResources(catalog, root, { fetchImpl = fetch, report = () => undefined } = {}) {
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const archives = macArchiveInventory(catalog);
  const completed = [];
  for (const archive of archives) {
    const existing = await findArchive(root, archive);
    if (existing && !existing.error) {
      report(`复用已校验归档：${archive.filename}`);
      completed.push(archive.filename);
      continue;
    }
    const partial = path.join(root, `.${archive.filename}.${process.pid}.partial`);
    await fs.rm(partial, { force: true });
    report(`下载 ${archive.filename}（${archive.bytes} 字节）`);
    try {
      const response = await fetchArchive(archive.url, fetchImpl);
      const hash = createHash("sha256");
      let bytes = 0;
      const meter = new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > archive.bytes) {
            callback(new Error(`下载超过签名目录声明的 ${archive.bytes} 字节上限`));
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        }
      });
      await pipeline(response.body, meter, createWriteStream(partial, { flags: "wx", mode: 0o600 }));
      const digest = hash.digest("hex");
      if (bytes !== archive.bytes || digest !== archive.sha256)
        throw new Error(`下载校验失败：实际 ${bytes} 字节/${digest}，预期 ${archive.bytes} 字节/${archive.sha256}`);
      await fs.rename(partial, path.join(root, archive.filename));
      completed.push(archive.filename);
    } catch (error) {
      await fs.rm(partial, { force: true });
      throw new Error(`${archive.filename} 未准备完成：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return completed;
}

async function fetchArchive(initialUrl, fetchImpl) {
  let current = new URL(initialUrl);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetchImpl(current.toString(), { redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      if (redirects === 5) throw new Error("HTTPS 重定向次数超过限制");
      const location = response.headers.get("location");
      if (!location) throw new Error("HTTPS 重定向缺少 Location");
      const next = new URL(location, current);
      if (next.protocol !== "https:" || next.username || next.password || next.hash)
        throw new Error("拒绝跳转到非 HTTPS 或包含凭据的资源地址");
      current = next;
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`HTTPS ${response.status}`);
    return response;
  }
  throw new Error("HTTPS 重定向次数超过限制");
}
