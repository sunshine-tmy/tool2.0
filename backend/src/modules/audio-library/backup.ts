/** ZIP 备份仅含永久资产及相对路径；恢复先完整校验，再通过存储层一次提交。 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { ZipArchive } from "archiver";
import * as yauzl from "yauzl";
import type { FastifyReply } from "fastify";
import type { AudioLibraryCatalog } from "@toolbox/shared";
import { AudioLibraryStore, AudioLibraryError, reject, readCatalog } from "./store";
import { hashAudio, inspectAudio } from "./media";

export async function exportAudioLibrary(store: AudioLibraryStore, reply: FastifyReply, ids?: string[]) {
  const catalog = await store.snapshot();
  if (ids) {
    catalog.presets = [];
    catalog.items = catalog.items.filter((x) => ids.includes(x.id) && !x.deletedAt);
    if (catalog.items.length !== new Set(ids).size)
      reject("AUDIO_LIBRARY_EXPORT_INVALID", "部分素材不存在或已在回收站", 409);
  }
  catalog.pendingDeletes = [];
  const release = store.pin(catalog.items.map((x) => x.id));
  try {
    for (const item of catalog.items) {
      if ((await hashAudio(store.file(item)).catch(() => "")) !== item.sha256)
        reject("AUDIO_LIBRARY_MEDIA_UNAVAILABLE", `音频“${item.title}”缺失或损坏，请修复后再备份`, 409);
    }
    const archive = new ZipArchive({ zlib: { level: 1 } });
    archive.once("error", () => archive.destroy());
    reply.raw.once("close", () => {
      release();
      archive.abort();
    });
    archive.once("end", release);
    reply
      .header("content-type", "application/zip")
      .header(
        "content-disposition",
        `attachment; filename="audio-library-${ids ? "selected" : "backup"}-${Date.now()}.zip"`
      );
    archive.append(JSON.stringify(catalog, null, 2), { name: "manifest.json" });
    for (const item of catalog.items) {
      archive.file(store.file(item), { name: `items/${item.id}/${item.fileName}` });
      archive.append(
        [
          `标题：${item.title}`,
          `语言：${item.language}`,
          "外语文案：",
          item.foreignText,
          "",
          "中文译文：",
          item.chineseText,
          "",
          "备注：",
          item.note
        ].join("\n"),
        { name: `texts/${item.id}.txt` }
      );
    }
    void archive.finalize().catch((error) => archive.destroy(error));
    return reply.send(archive);
  } catch (error) {
    release();
    throw error;
  }
}
async function openZip(file: string) {
  return new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(
      file,
      { lazyEntries: true, autoClose: false, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => (error ? reject(error) : resolve(zip))
    )
  );
}
function stream(zip: yauzl.ZipFile, entry: yauzl.Entry) {
  return new Promise<fs.ReadStream>((resolve, reject) =>
    zip.openReadStream(entry, (error, value) => (error ? reject(error) : resolve(value as fs.ReadStream)))
  );
}
export async function readBackup(file: string, directory: string, store: AudioLibraryStore, token: string) {
  const zip = await openZip(file).catch(() => reject("AUDIO_LIBRARY_BACKUP_INVALID", "无法读取 ZIP 备份", 415));
  try {
    const entries = await new Promise<yauzl.Entry[]>((resolve, reject) => {
      const result: yauzl.Entry[] = [];
      zip.on("error", reject);
      zip.on("entry", (entry: yauzl.Entry) => {
        result.push(entry);
        if (result.length > 50000) {
          reject(new Error("备份文件过多"));
          return;
        }
        zip.readEntry();
      });
      zip.once("end", () => resolve(result));
      zip.readEntry();
    });
    const manifest = entries.find((x) => x.fileName === "manifest.json");
    if (
      !manifest ||
      entries.filter((x) => x.fileName === "manifest.json").length !== 1 ||
      manifest.uncompressedSize > 64 * 1024 * 1024
    )
      reject("AUDIO_LIBRARY_BACKUP_INVALID", "备份缺少有效素材清单");
    const buffers: Buffer[] = [];
    let manifestBytes = 0;
    for await (const chunk of await stream(zip, manifest)) {
      manifestBytes += chunk.length;
      if (manifestBytes > 64 * 1024 * 1024) reject("AUDIO_LIBRARY_BACKUP_INVALID", "清单过大");
      buffers.push(Buffer.from(chunk));
    }
    const catalog = readCatalog(JSON.parse(Buffer.concat(buffers).toString("utf8")));
    if (!catalog) reject("AUDIO_LIBRARY_BACKUP_INVALID", "备份清单格式不受支持");
    const allowed = new Map(catalog.items.map((item) => [`items/${item.id}/${item.fileName}`, item]));
    const seen = new Set<string>();
    const current = await store.snapshot();
    for (const entry of entries) {
      if (entry.fileName === "manifest.json" || /^texts\/[A-Za-z0-9_-]+\.txt$/.test(entry.fileName)) continue;
      const item = allowed.get(entry.fileName);
      if (
        !item ||
        seen.has(entry.fileName) ||
        entry.uncompressedSize !== item.bytes ||
        ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000
      )
        reject("AUDIO_LIBRARY_BACKUP_INVALID", "备份含不安全路径、重复文件或无效大小");
      seen.add(entry.fileName);
      if (current.items.some((x) => x.id === item.id && x.sha256 === item.sha256)) {
        const hash = createHash("sha256");
        for await (const chunk of await stream(zip, entry)) hash.update(chunk);
        if (hash.digest("hex") !== item.sha256) reject("AUDIO_LIBRARY_BACKUP_INVALID", "备份音频摘要不匹配");
        continue;
      }
      store.reserve(token, item.bytes);
      const target = path.join(directory, "items", item.id, item.fileName);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await pipeline(await stream(zip, entry), fs.createWriteStream(target, { flags: "wx" }));
      const actual = await inspectAudio(target);
      if (actual.sha256 !== item.sha256 || actual.fileName !== item.fileName || actual.bytes !== item.bytes)
        reject("AUDIO_LIBRARY_BACKUP_INVALID", "备份音频摘要或格式不匹配");
      item.duration = actual.duration;
      item.mimeType = actual.mimeType;
    }
    if (seen.size !== catalog.items.length) reject("AUDIO_LIBRARY_BACKUP_INVALID", "备份音频不完整");
    return catalog as AudioLibraryCatalog;
  } catch (error) {
    if (error instanceof AudioLibraryError) throw error;
    reject("AUDIO_LIBRARY_BACKUP_INVALID", "备份已损坏或包含不安全的文件路径");
  } finally {
    zip.close();
  }
}
