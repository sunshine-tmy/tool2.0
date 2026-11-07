/** Installed capabilities are exported as signed-file snapshots, never as a re-signed release archive. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ZipArchive } from "archiver";
import * as yauzl from "yauzl";
import type { ComponentPackageManifest, ComponentManifestFile } from "./types";
import { canonicalManifest } from "./manifest-signature";
import { sha256Text } from "./package-hash";
import { safeChildPath } from "./package-paths";
import { ComponentManagerError } from "./component-error";

export const COMPONENT_BUNDLE_SUFFIX = ".toolbox-capabilities.zip";
type BundlePackage = { manifest: ComponentPackageManifest; root: string; cacheRoot?: string };
export function bundleMetadata(target: string, manifests: ComponentPackageManifest[]) {
  return JSON.stringify({
    format: "toolbox-capabilities",
    version: 1,
    target,
    components: manifests.map((m) => ({
      id: m.id,
      version: m.version,
      platform: m.platform,
      manifestSha256: sha256Text(canonicalManifest(m))
    }))
  });
}
export function bundleByteLimit(target: string, manifests: ComponentPackageManifest[]) {
  return (
    Buffer.byteLength(bundleMetadata(target, manifests)) +
    1024 * 1024 +
    manifests.reduce(
      (sum, m) =>
        sum + m.files.reduce((n, f) => n + f.bytes + 1024 + 2 * Buffer.byteLength(`packages/${m.id}/${f.path}`), 0),
      0
    )
  );
}
function invalid(message = "离线能力备份包不完整、已被修改或与当前受信任目录不匹配") {
  return new ComponentManagerError("COMPONENT_IMPORT_INVALID", message);
}
export async function signedPath(root: string, relative: string) {
  let candidate = root;
  for (const part of ["", ...relative.split("/")]) {
    candidate = path.join(candidate, part);
    if ((await fsp.lstat(candidate)).isSymbolicLink()) throw invalid("能力文件包含链接，拒绝导出");
  }
  return safeChildPath(root, relative);
}
function verifier(expected: { bytes: number; sha256: string }, signal?: AbortSignal) {
  let size = 0;
  const hash = crypto.createHash("sha256");
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (signal?.aborted || size > expected.bytes) return callback(invalid());
      hash.update(chunk);
      callback(null, chunk);
    },
    flush(callback) {
      callback(size === expected.bytes && hash.digest("hex") === expected.sha256 ? undefined : invalid());
    }
  });
}
export function packComponentBundle(
  target: string,
  packages: BundlePackage[],
  signal: AbortSignal,
  release: () => void
) {
  const zip = new ZipArchive({ zlib: { level: 0 }, forceZip64: true });
  let source: Readable | undefined;
  const stop = () => {
    source?.destroy();
    zip.abort();
    zip.destroy(new Error("能力包导出已中断"));
  };
  signal.addEventListener("abort", stop, { once: true });
  zip.once("close", () => {
    signal.removeEventListener("abort", stop);
    source?.destroy();
    release();
  });
  zip.once("warning", (error) => zip.destroy(error));
  // A listener is attached before the asynchronous producer starts; Fastify/pipeline also observe errors.
  zip.on("error", () => {
    source?.destroy();
    release();
  });
  void (async () => {
    signal.throwIfAborted();
    zip.append(
      bundleMetadata(
        target,
        packages.map((p) => p.manifest)
      ),
      { name: "bundle.json" }
    );
    for (const { manifest, root, cacheRoot } of packages)
      for (const file of manifest.files) {
        signal.throwIfAborted();
        if (zip.destroyed) throw invalid("导出已停止");
        let candidate = await signedPath(root, file.path);
        if (cacheRoot && file.path.endsWith(".pyc")) {
          const original = safeChildPath(cacheRoot, file.path);
          if (
            await fsp.lstat(original).then(
              () => true,
              () => false
            )
          )
            candidate = await signedPath(cacheRoot, file.path);
        }
        const stat = await fsp.lstat(candidate);
        if (!stat.isFile() || stat.size !== file.bytes) throw invalid("能力文件大小已变化，请先重装后导出");
        signal.throwIfAborted();
        if (zip.destroyed) throw invalid("导出已停止");
        source = fs.createReadStream(candidate);
        const checked = source.pipe(verifier(file, signal));
        source.on("error", (error) => checked.destroy(error));
        checked.on("error", (error) => zip.destroy(error));
        zip.append(checked, { name: `packages/${manifest.id}/${file.path}`, mode: file.executable ? 0o755 : 0o644 });
        await new Promise<void>((resolve, reject) => {
          const closed = () => {
            source?.destroy();
            checked.destroy();
            reject(invalid("导出已停止"));
          };
          const done = () => {
            zip.removeListener("close", closed);
            resolve();
          };
          const failed = (error: Error) => {
            zip.removeListener("close", closed);
            reject(error);
          };
          checked.once("end", done);
          checked.once("error", failed);
          zip.once("close", closed);
        }).finally(() => {
          source = undefined;
        });
      }
    await zip.finalize();
  })().catch((error) => zip.destroy(error instanceof Error ? error : invalid()));
  return zip;
}

/** ZIP is never trusted for names, sizes or executable permissions. The embedded signed catalog owns all three. */
export async function extractComponentBundle(
  file: string,
  destination: string,
  target: string,
  manifests: ComponentPackageManifest[]
) {
  const metadata = bundleMetadata(target, manifests);
  const expected = new Map<string, ComponentManifestFile>(
    manifests.flatMap((m) => m.files.map((f) => [`packages/${m.id}/${f.path}`, f] as const))
  );
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(
      file,
      { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true },
      (error, value) => (error || !value ? reject(invalid()) : resolve(value))
    )
  );
  const entries: yauzl.Entry[] = [],
    seen = new Set<string>();
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on("error", reject);
      zip.once("end", resolve);
      zip.on("entry", (entry: yauzl.Entry) => {
        const signed = expected.get(entry.fileName);
        const type = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (
          seen.has(entry.fileName) ||
          entry.generalPurposeBitFlag & 1 ||
          (type && type !== 0o100000) ||
          (entry.fileName !== "bundle.json" && !signed) ||
          entry.uncompressedSize !== (signed?.bytes ?? Buffer.byteLength(metadata)) ||
          entries.length >= expected.size + 1
        ) {
          reject(invalid());
          return;
        }
        seen.add(entry.fileName);
        entries.push(entry);
        zip.readEntry();
      });
      zip.readEntry();
    });
    if (entries.length !== expected.size + 1 || !seen.has("bundle.json")) throw invalid();
    const open = (entry: yauzl.Entry) =>
      new Promise<Readable>((resolve, reject) =>
        zip.openReadStream(entry, (error, stream) => (error || !stream ? reject(invalid()) : resolve(stream)))
      );
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of await open(entries.find((e) => e.fileName === "bundle.json")!)) {
      size += chunk.length;
      if (size > Buffer.byteLength(metadata)) throw invalid();
      chunks.push(Buffer.from(chunk));
    }
    if (Buffer.concat(chunks).toString("utf8") !== metadata) throw invalid();
    for (const entry of entries) {
      const signed = expected.get(entry.fileName);
      if (!signed) continue;
      const output = safeChildPath(destination, entry.fileName);
      await fsp.mkdir(path.dirname(output), { recursive: true });
      await pipeline(
        await open(entry),
        verifier(signed),
        fs.createWriteStream(output, { flags: "wx", mode: signed.executable ? 0o755 : 0o644 })
      );
      if (signed.executable) await fsp.chmod(output, 0o755);
    }
  } catch (error) {
    throw error instanceof ComponentManagerError ? error : invalid();
  } finally {
    zip.close();
  }
}
