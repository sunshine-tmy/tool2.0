/** Versioned data only ZIP64 packages. No SQL, code, symlinks or source-machine paths. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ZipArchive } from "archiver";
import * as yauzl from "yauzl";
import { Value } from "@sinclair/typebox/value";
import { Type } from "@sinclair/typebox";
import { backupModules } from "@toolbox/shared/system";
import type { BackupBundle, BackupManifest, BackupProgress, ModuleData } from "./types";

const digest = Type.String({ pattern: "^[a-f0-9]{64}$" });
const integer = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const moduleId = Type.Union(backupModules.map(({ id }) => Type.Literal(id)));
const entity = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 256 }),
    kind: Type.String(),
    status: Type.Optional(Type.String()),
    payload: Type.Unknown(),
    createdAt: Type.String(),
    updatedAt: Type.String()
  },
  { additionalProperties: false }
);
const file = Type.Object(
  {
    path: Type.String({ maxLength: 4096 }),
    sha256: digest,
    bytes: integer,
    entityKind: Type.String(),
    entityId: Type.String(),
    mediaType: Type.Optional(Type.String()),
    createdAt: Type.String()
  },
  { additionalProperties: false }
);
const manifestSchema = Type.Object(
  {
    format: Type.Literal("toolbox-module-backup"),
    version: Type.Literal(1),
    id: Type.String({ pattern: "^[a-f0-9-]{36}$" }),
    createdAt: Type.String(),
    appVersion: Type.String(),
    modules: Type.Array(
      Type.Object(
        {
          id: moduleId,
          version: Type.Literal(1),
          records: integer,
          files: integer,
          bytes: integer,
          expired: integer,
          recordsHash: digest,
          filesHash: digest
        },
        { additionalProperties: false }
      ),
      { minItems: 1, maxItems: 6 }
    )
  },
  { additionalProperties: false }
);
const recordsSchema = Type.Object(
  {
    version: Type.Literal(1),
    id: moduleId,
    records: Type.Array(entity, { maxItems: 200000 }),
    catalog: Type.Optional(Type.Unknown()),
    preferences: Type.Optional(Type.Record(Type.String(), Type.String({ maxLength: 500000 }), { maxProperties: 20 }))
  },
  { additionalProperties: false }
);
export const hashText = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");

export function safeRelative(value: string) {
  if (
    !value ||
    value.length > 4096 ||
    value.includes("\\") ||
    value.includes(":") ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32) ||
    value
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part)
      )
  )
    throw new Error("备份含不安全文件路径");
  return value;
}
export async function ownedPath(root: string, relative: string, allowMissing = false) {
  safeRelative(relative);
  let current = path.resolve(root);
  for (const part of ["", ...relative.split("/")]) {
    current = path.join(current, part);
    const stat = await fsp.lstat(current).catch((error) => {
      if (allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error("备份不允许链接文件或目录");
  }
  return current;
}
export async function enoughSpace(root: string, bytes: number) {
  const disk = await fsp.statfs(root);
  if (!Number.isSafeInteger(bytes) || bytes < 0 || disk.bavail * disk.bsize < bytes + 32 * 1024 ** 2)
    throw new Error("磁盘空间不足，尚未修改业务数据");
}
export async function copyHashed(
  source: string,
  target: string | undefined,
  signal?: AbortSignal,
  progress?: (bytes: number) => void
) {
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      progress?.(chunk.length);
      callback(null, target ? chunk : undefined);
    }
  });
  if (target) await fsp.mkdir(path.dirname(target), { recursive: true });
  await pipeline(
    fs.createReadStream(source),
    meter,
    ...(target ? [fs.createWriteStream(target, { flags: "wx" })] : []),
    { signal }
  );
  if (target) {
    const handle = await fsp.open(target, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  return { sha256: hash.digest("hex"), bytes };
}
export async function writeBundleMetadata(
  directory: string,
  modules: ModuleData[],
  appVersion: string
): Promise<BackupManifest> {
  const manifest: BackupManifest = {
    format: "toolbox-module-backup",
    version: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    appVersion,
    modules: []
  };
  for (const module of modules) {
    const { files, ...records } = module;
    const recordsText = JSON.stringify(records),
      filesText = JSON.stringify(files);
    const moduleDir = path.join(directory, "modules", module.id);
    await fsp.mkdir(moduleDir, { recursive: true });
    await fsp.writeFile(path.join(moduleDir, "records.json"), recordsText);
    await fsp.writeFile(path.join(moduleDir, "files.json"), filesText);
    manifest.modules.push({
      id: module.id,
      version: 1,
      records: module.records.length,
      files: files.length,
      bytes: files.reduce((n, f) => n + f.bytes, 0),
      expired: module.records.filter((record) => {
        const expiresAt = (record.payload as { expiresAt?: unknown } | null)?.expiresAt;
        return typeof expiresAt === "string" && Date.parse(expiresAt) < Date.now();
      }).length,
      recordsHash: hashText(recordsText),
      filesHash: hashText(filesText)
    });
  }
  await fsp.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  return manifest;
}
export async function packBundle(
  bundle: BackupBundle,
  destination: string,
  signal: AbortSignal,
  progress: BackupProgress
) {
  const objects = new Map(bundle.modules.flatMap((m) => m.files.map((f) => [f.sha256, f] as const)));
  await enoughSpace(
    path.dirname(destination),
    [...objects.values()].reduce((n, f) => n + f.bytes, 0)
  );
  const partial = `${destination}.${crypto.randomUUID()}.partial`;
  const zip = new ZipArchive({ forceZip64: true, zlib: { level: 1 } });
  const output = fs.createWriteStream(partial, { flags: "wx" });
  const completion = pipeline(zip, output, { signal });
  const onAbort = () => zip.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  zip.on("progress", (info) =>
    progress(
      "打包备份",
      info.entries.processed,
      objects.size + bundle.modules.length * 2 + 1,
      zip.pointer(),
      bundle.manifest.modules.reduce((n, m) => n + m.bytes, 0)
    )
  );
  try {
    zip.file(path.join(bundle.directory, "manifest.json"), { name: "manifest.json" });
    for (const module of bundle.modules)
      for (const name of ["records.json", "files.json"])
        zip.file(path.join(bundle.directory, "modules", module.id, name), { name: `modules/${module.id}/${name}` });
    for (const hash of objects.keys()) {
      const entry = { name: `objects/${hash}`, store: true };
      zip.file(path.join(bundle.directory, "objects", hash), entry);
    }
    await Promise.all([zip.finalize(), completion]);
    signal.throwIfAborted();
    // Native save dialog approves replacement of an existing backup, never business files.
    await fsp.rename(partial, destination);
  } catch (error) {
    zip.abort();
    output.destroy();
    await completion.catch(() => undefined);
    await fsp.rm(partial, { force: true });
    throw error;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
async function openZip(filename: string) {
  return new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(
      filename,
      { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true },
      (error, zip) => (error ? reject(error) : resolve(zip))
    )
  );
}
async function entryStream(zip: yauzl.ZipFile, entry: yauzl.Entry) {
  return new Promise<fs.ReadStream>((resolve, reject) =>
    zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream as fs.ReadStream)))
  );
}
export async function readBundle(
  filename: string,
  directory: string,
  signal: AbortSignal,
  progress: BackupProgress
): Promise<BackupBundle> {
  const zip = await openZip(filename);
  // Keep a permanent error handler while metadata and streams are consumed.
  let zipError: Error | undefined;
  zip.on("error", (error) => {
    zipError = error;
  });
  const onAbort = () => zip.close();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    signal.throwIfAborted();
    const entries = await new Promise<Map<string, yauzl.Entry>>((resolve, reject) => {
      const result = new Map<string, yauzl.Entry>();
      const folded = new Set<string>();
      zip.once("error", reject);
      zip.once("close", () => {
        if (signal.aborted) reject(signal.reason);
      });
      zip.on("entry", (entry: yauzl.Entry) => {
        try {
          safeRelative(entry.fileName);
          if (
            folded.has(entry.fileName.toLowerCase()) ||
            result.size >= 200000 ||
            ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000 ||
            entry.generalPurposeBitFlag & 1 ||
            !Number.isSafeInteger(entry.uncompressedSize) ||
            entry.uncompressedSize < 0
          )
            throw new Error("备份含重复、加密、链接或超限条目");
          folded.add(entry.fileName.toLowerCase());
          result.set(entry.fileName, entry);
          zip.readEntry();
        } catch (error) {
          reject(error);
        }
      });
      zip.once("end", () => resolve(result));
      zip.readEntry();
    });
    let metadataBytes = 0;
    const read = async (name: string) => {
      signal.throwIfAborted();
      const entry = entries.get(name);
      if (!entry || metadataBytes + entry.uncompressedSize > 128 * 1024 ** 2) throw new Error("备份元数据缺失或超限");
      metadataBytes += entry.uncompressedSize;
      const chunks: Buffer[] = [];
      let size = 0;
      const stream = await entryStream(zip, entry);
      const abort = () => stream.destroy(new Error("已取消"));
      signal.addEventListener("abort", abort, { once: true });
      try {
        for await (const chunk of stream) {
          size += chunk.length;
          if (size > 128 * 1024 ** 2) throw new Error("备份元数据超限");
          chunks.push(Buffer.from(chunk));
        }
      } finally {
        signal.removeEventListener("abort", abort);
      }
      return Buffer.concat(chunks).toString("utf8");
    };
    const manifest: unknown = JSON.parse(await read("manifest.json"));
    if (
      !Value.Check(manifestSchema, manifest) ||
      new Set(manifest.modules.map((m) => m.id)).size !== manifest.modules.length
    )
      throw new Error("不是受支持的模块备份，或备份版本不兼容");
    const modules: ModuleData[] = [];
    const allowed = new Set(["manifest.json"]);
    const objects = new Map<string, number>();
    for (const meta of manifest.modules) {
      const names = [`modules/${meta.id}/records.json`, `modules/${meta.id}/files.json`];
      const recordsText = await read(names[0]),
        filesText = await read(names[1]);
      if (hashText(recordsText) !== meta.recordsHash || hashText(filesText) !== meta.filesHash)
        throw new Error("备份清单摘要不匹配");
      const records: unknown = JSON.parse(recordsText),
        files: unknown = JSON.parse(filesText);
      if (
        !Value.Check(recordsSchema, records) ||
        records.id !== meta.id ||
        !Value.Check(Type.Array(file, { maxItems: 200000 }), files) ||
        records.records.length !== meta.records ||
        files.length !== meta.files ||
        files.reduce((n, f) => n + f.bytes, 0) !== meta.bytes
      )
        throw new Error("备份模块数据不符合约定");
      const paths = new Set<string>();
      for (const file of files) {
        safeRelative(file.path);
        if (paths.has(file.path.toLowerCase())) throw new Error("模块内文件路径重复");
        paths.add(file.path.toLowerCase());
        if (objects.has(file.sha256) && objects.get(file.sha256) !== file.bytes) throw new Error("备份对象大小冲突");
        objects.set(file.sha256, file.bytes);
      }
      modules.push({ ...records, files } as ModuleData);
      names.forEach((name) => allowed.add(name));
    }
    for (const [hash, size] of objects) {
      const name = `objects/${hash}`;
      const entry = entries.get(name);
      if (!entry || entry.uncompressedSize !== size) throw new Error("备份缺少媒体或大小不匹配");
      allowed.add(name);
    }
    if ([...entries.keys()].some((name) => !allowed.has(name))) throw new Error("备份含未登记内容");
    await fsp.mkdir(directory, { recursive: true });
    const total = [...objects.values()].reduce((n, s) => n + s, 0);
    await enoughSpace(directory, total);
    let count = 0,
      bytes = 0;
    await fsp.mkdir(path.join(directory, "objects"), { recursive: true });
    for (const [hash, size] of objects) {
      signal.throwIfAborted();
      const input = await entryStream(zip, entries.get(`objects/${hash}`)!);
      const target = path.join(directory, "objects", hash),
        hasher = crypto.createHash("sha256");
      let actual = 0;
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          actual += chunk.length;
          bytes += chunk.length;
          if (actual > size) return callback(new Error("备份媒体超出声明大小"));
          hasher.update(chunk);
          progress("校验备份", count, objects.size, bytes, total);
          callback(null, chunk);
        }
      });
      await pipeline(input, meter, fs.createWriteStream(target, { flags: "wx" }), { signal });
      if (actual !== size || hasher.digest("hex") !== hash) throw new Error("备份媒体摘要不匹配");
      count++;
      progress("校验备份", count, objects.size, bytes, total);
    }
    if (zipError) throw zipError;
    return { manifest: manifest as BackupManifest, modules, directory };
  } finally {
    signal.removeEventListener("abort", onAbort);
    zip.close();
  }
}
