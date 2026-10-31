import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import { createDevelopmentRuntimeLayout } from "../runtime/runtime-layout";
import { createApp } from "../app";
import { ToolboxDatabase } from "../database/toolbox-database";
import {
  snapshot,
  previewImport,
  restoreImport,
  currentModules,
  type BackupContext
} from "../system/data-backup/service";
import { packBundle, readBundle, hashText, safeRelative, enoughSpace } from "../system/data-backup/package-io";
import type { BackupManifest, ModuleData } from "../system/data-backup/types";
import { writeDurable, recoverRestores, inspectPackage } from "../system/data-backup/service";
import { planRestore } from "../system/data-backup/merge";
import { validateModuleData } from "../system/data-backup/validation";
import {
  defaultArchiveAudioSettings,
  defaultArchiveWatermarkSettings,
  type ContentArchiveItem,
  type AudioLibraryItem
} from "@toolbox/shared";
import { AudioLibraryStore } from "../domains/audio-library/store";
import { ContentArchiveStore } from "../domains/content-archive/core/store";
import { createLanFileStore, createLanNoteStore } from "../domains/lan-transfer/repositories";
import type { BackupModuleId } from "@toolbox/shared/system";
const now = "2026-10-01T00:00:00.000Z",
  expires = "2030-01-01T00:00:00.000Z";
async function putFile(context: BackupContext, relative: string, content: string) {
  const target = path.join(context.config.storageRoot, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
  return target;
}
function putEntity(db: ToolboxDatabase, kind: string, payload: Record<string, unknown>, id = String(payload.id)) {
  db.upsert({
    id,
    kind,
    payload,
    status: typeof payload.status === "string" ? payload.status : undefined,
    createdAt: now,
    updatedAt: now
  });
}
async function archive(context: BackupContext, id = "archive_first", contentId = "12345678", body = "video") {
  const file = (fileName: string, content: string, mimeType = "video/mp4") => ({
    fileName,
    mimeType,
    size: Buffer.byteLength(content),
    checksum: hashText(content)
  });
  const media = {
    id: "media_first",
    kind: "video" as const,
    index: 0,
    ...file("video.mp4", body),
    previewUrl: `/api/v1/tools/media-archive/items/${id}/media/media_first`,
    downloadUrl: `/api/v1/tools/media-archive/items/${id}/media/media_first?download=1`,
    audioEdit: {
      revision: 2,
      original: file("original.mp4", "original"),
      music: { ...file("music.mp3", "music", "audio/mpeg"), title: "独立配乐", libraryItemId: "foreignmusic" },
      watermark: {
        file: file("logo.png", "watermark", "image/png"),
        width: 1,
        height: 1,
        settings: defaultArchiveWatermarkSettings()
      },
      settings: defaultArchiveAudioSettings(),
      updatedAt: now
    }
  };
  const item: ContentArchiveItem = {
    id,
    platform: "tiktok",
    contentId,
    sourceUrl: `https://www.tiktok.com/@demo/video/${contentId}`,
    canonicalUrl: `https://www.tiktok.com/@demo/video/${contentId}`,
    type: "video",
    title: "原文 #主题",
    topics: [{ id: "topic", source: "主题" }],
    media: [media],
    status: "ready",
    warnings: [],
    fetchedAt: now,
    updatedAt: now,
    totalBytes: body.length + 7 + 5 + 9,
    coverMediaId: media.id
  };
  for (const [name, value] of Object.entries({
    "video.mp4": body,
    "original.mp4": "original",
    "music.mp3": "music",
    "logo.png": "watermark"
  }))
    await putFile(context, `xhs-archive/items/${id}/${name}`, value);
  await putFile(context, `xhs-archive/items/${id}/manifest.json`, JSON.stringify(item));
  const db = new ToolboxDatabase(context.config.databasePath);
  putEntity(db, "xhs-archive", item);
  putEntity(db, "archive-group", { id: "group_first1", name: "作品组", createdAt: now, updatedAt: now });
  db.upsert({
    id,
    kind: "archive-group-member",
    payload: { groupId: "group_first1" },
    status: "group_first1",
    createdAt: now,
    updatedAt: now
  });
  putEntity(db, "archive-publication", { archiveId: id, publishedElsewhere: true, markedAt: now }, id);
  putEntity(db, "archive-watermark-preset", {
    id: "preset_first",
    name: "轨迹",
    points: [
      { progress: 0, x: 0, y: 0 },
      { progress: 1, x: 1, y: 1 }
    ],
    revision: 1,
    createdAt: now,
    updatedAt: now
  });
  db.close();
  return item;
}
async function music(context: BackupContext, id = "music_first1", body = "music", title = "音乐") {
  const db = new ToolboxDatabase(context.config.databasePath);
  const store = new AudioLibraryStore(context.config.storageRoot, db, context.config.audioLibraryMaxStorageBytes);
  await store.initialize();
  const item: AudioLibraryItem = {
    id,
    title,
    groupId: null,
    revision: 1,
    language: "und",
    foreignText: "",
    chineseText: "",
    note: "素材备注",
    fileName: "audio.wav",
    mimeType: "audio/wav",
    bytes: body.length,
    duration: 1,
    sha256: hashText(body),
    source: { kind: "upload", originalName: "a.wav" },
    createdAt: now,
    updatedAt: now
  };
  await putFile(context, `audio-library/items/${id}/audio.wav`, body);
  await store.mutate((c) => {
    c.items.push(item);
    c.presets = [
      ...(c.presets ?? []),
      {
        id: "queue_first1",
        name: "队列",
        itemIds: [id],
        mode: "list",
        gap: 1,
        revision: 1,
        createdAt: now,
        updatedAt: now
      }
    ];
  });
  db.close();
}
async function backupFile(f: Awaited<ReturnType<typeof fixture>>, modules: BackupModuleId[]) {
  const directory = path.join(f.root, crypto.randomUUID()),
    bundle = await snapshot(f.context, { modules }, directory),
    file = path.join(f.root, `${crypto.randomUUID()}.zip`);
  await packBundle(bundle, file, f.context.signal, f.context.progress);
  return file;
}
async function restoreFile(
  target: Awaited<ReturnType<typeof fixture>>,
  file: string,
  modules: BackupModuleId[],
  mode: "merge" | "replace" = "merge"
) {
  const id = crypto.randomUUID();
  const preview = await previewImport(target.context, file, modules, mode, id);
  await restoreImport(target.context, id, crypto.randomUUID());
  return preview;
}

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    if (
      !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(root).startsWith("toolbox-backup-")
    )
      throw new Error("unsafe test cleanup");
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-backup-"));
  roots.push(root);
  const storage = path.join(root, "中文 数据");
  await fs.mkdir(storage);
  const config = getConfig({
    layout: createDevelopmentRuntimeLayout({
      storageRoot: storage,
      runtimeRoot: path.join(root, "runtime"),
      modelsRoot: path.join(root, "models"),
      configRoot: path.join(root, "config")
    }),
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      DEPLOYMENT_MODE: "local",
      STORAGE_ROOT: storage,
      DATABASE_PATH: path.join(storage, "toolbox.db")
    }
  });
  const db = new ToolboxDatabase(config.databasePath);
  db.close();
  const context: BackupContext = {
    config,
    controlRoot: path.join(root, "backups"),
    appVersion: "1.2.3",
    signal: new AbortController().signal,
    progress: vi.fn()
  };
  await fs.mkdir(context.controlRoot);
  return { root, context };
}
async function compress(context: BackupContext, id: string, content = "old") {
  const now = "2026-01-02T00:00:00.000Z";
  await fs.mkdir(context.config.outputDir, { recursive: true });
  await fs.writeFile(path.join(context.config.outputDir, `${id}.png`), content);
  const db = new ToolboxDatabase(context.config.databasePath);
  const payload = {
    id,
    toolId: "image-compress",
    status: "completed",
    progress: 100,
    outputPath: `${id}.png`,
    createdAt: now,
    updatedAt: now
  };
  db.upsert({ id, kind: "task", payload, status: "completed", createdAt: now, updatedAt: now });
  db.close();
}
it("snapshots without migrating or recovering interrupted tasks and roundtrips a ZIP64 package", async () => {
  const { root, context } = await fixture();
  await compress(context, "task_first");
  const db = new ToolboxDatabase(context.config.databasePath);
  db.upsert({
    id: "another",
    kind: "task",
    status: "running",
    payload: { id: "another", toolId: "other", status: "running" },
    createdAt: "old",
    updatedAt: "old"
  });
  db.close();
  const bundle = await snapshot(context, { modules: ["image-compress"] }, path.join(root, "snapshot"));
  expect(bundle.modules[0].files[0].sha256).toBe(hashText("old"));
  const readonly = new ToolboxDatabase(context.config.databasePath, { maintenance: true, readonly: true });
  expect(readonly.get("task", "another")?.status).toBe("running");
  readonly.close();
  await packBundle(bundle, path.join(root, "backup.zip"), context.signal, context.progress);
  const restored = await readBundle(
    path.join(root, "backup.zip"),
    path.join(root, "extracted"),
    context.signal,
    context.progress
  );
  expect(restored.modules).toEqual(bundle.modules);
  expect(await fs.readFile(path.join(restored.directory, "objects", hashText("old")), "utf8")).toBe("old");
});
it("replaces only the selected module, makes a restore point and preserves unselected records", async () => {
  const source = await fixture(),
    target = await fixture();
  await compress(source.context, "source_task", "new");
  await compress(target.context, "target_task", "existing");
  const db = new ToolboxDatabase(target.context.config.databasePath);
  const untouched = {
    id: "lan_record",
    kind: "lan-file",
    payload: { id: "lan_record", storedName: "file.dat", size: 4 },
    createdAt: "old",
    updatedAt: "old"
  };
  db.upsert(untouched);
  db.close();
  const bundle = await snapshot(source.context, { modules: ["image-compress"] }, path.join(source.root, "snapshot"));
  const file = path.join(source.root, "backup.zip");
  await packBundle(bundle, file, source.context.signal, source.context.progress);
  const id = crypto.randomUUID();
  const preview = await previewImport(target.context, file, ["image-compress"], "replace", id);
  expect(preview.modules[0].existing).toBe(1);
  const result = await restoreImport(target.context, id, crypto.randomUUID());
  expect(
    await fs.stat(path.join(target.context.controlRoot, "restore-points", result.restorePointId, "manifest.json"))
  ).toBeTruthy();
  const after = new ToolboxDatabase(target.context.config.databasePath, { maintenance: true });
  expect(after.get("task", "target_task")).toBeUndefined();
  expect(after.get("task", "source_task")).toBeTruthy();
  expect(after.get("lan-file", "lan_record")).toEqual(untouched);
  after.close();
  expect(await fs.readFile(path.join(target.context.config.outputDir, "source_task.png"), "utf8")).toBe("new");
  await expect(fs.stat(path.join(target.context.config.outputDir, "target_task.png"))).rejects.toMatchObject({
    code: "ENOENT"
  });
});
it("merges ID conflicts, rewrites download names and skips the same backup on re-import", async () => {
  const source = await fixture(),
    target = await fixture();
  await compress(source.context, "same_task", "incoming");
  await compress(target.context, "same_task", "target");
  const bundle = await snapshot(source.context, { modules: ["image-compress"] }, path.join(source.root, "snapshot"));
  const file = path.join(source.root, "backup.zip");
  await packBundle(bundle, file, source.context.signal, source.context.progress);
  const plan = crypto.randomUUID();
  expect((await previewImport(target.context, file, ["image-compress"], "merge", plan)).modules[0].conflicts).toBe(1);
  await restoreImport(target.context, plan, crypto.randomUUID());
  const db = new ToolboxDatabase(target.context.config.databasePath, { maintenance: true });
  expect(db.list("task")).toHaveLength(2);
  db.close();
  expect(await fs.readFile(path.join(target.context.config.outputDir, "same_task.png"), "utf8")).toBe("target");
  const next = crypto.randomUUID();
  expect((await previewImport(target.context, file, ["image-compress"], "merge", next)).modules[0].added).toBe(0);
  await restoreImport(target.context, next, crypto.randomUUID());
  const final = new ToolboxDatabase(target.context.config.databasePath, { maintenance: true });
  expect(final.list("task")).toHaveLength(2);
  final.close();
});
it("rejects stale preflight and leaves current data intact", async () => {
  const f = await fixture();
  await compress(f.context, "first_task");
  const bundle = await snapshot(f.context, { modules: ["image-compress"] }, path.join(f.root, "snapshot"));
  const file = path.join(f.root, "backup.zip");
  await packBundle(bundle, file, f.context.signal, f.context.progress);
  const id = crypto.randomUUID();
  await previewImport(f.context, file, ["image-compress"], "replace", id);
  await compress(f.context, "later_task");
  await expect(restoreImport(f.context, id, crypto.randomUUID())).rejects.toThrow("预检后变化");
  expect((await currentModules(f.context, ["image-compress"]))[0].records).toHaveLength(2);
});
it.each(["../file", "/root", "C:/file", "a\\b", "a/../b", "a//b", "a/CON.txt", "a:stream", "a/trailing."])(
  "rejects unsafe path %s",
  (input) => expect(() => safeRelative(input)).toThrow()
);
it("does not trust a file descriptor claiming another module's directory", async () => {
  const f = await fixture();
  await compress(f.context, "first_task");
  const bundle = await snapshot(f.context, { modules: ["image-compress"] }, path.join(f.root, "snapshot"));
  bundle.modules[0].files[0].path = "audio-library/library.json";
  const db = new ToolboxDatabase(f.context.config.databasePath, { maintenance: true });
  try {
    expect(() => planRestore(bundle, [], "replace", f.context.config, db)).toThrow("所有权");
  } finally {
    db.close();
  }
});

it("restores archive originals, edited video, independent music/watermark, groups, publication marks and presets without the audio library", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context);
  const file = await backupFile(source, ["content-archive"]);
  await restoreFile(target, file, ["content-archive"], "replace");
  const db = new ToolboxDatabase(target.context.config.databasePath),
    store = new ContentArchiveStore(target.context.config, db);
  const item = await store.get("archive_first");
  expect(item?.media[0].audioEdit?.original.fileName).toBe("original.mp4");
  expect(item?.media[0].audioEdit?.music?.libraryItemId).toBeUndefined();
  expect(store.publications.get("archive_first").publishedElsewhere).toBe(true);
  expect(store.groups.memberships().get("archive_first")).toBe("group_first1");
  expect(db.list("archive-watermark-preset")).toHaveLength(1);
  for (const [name, value] of Object.entries({
    "video.mp4": "video",
    "original.mp4": "original",
    "music.mp3": "music",
    "logo.png": "watermark"
  }))
    expect(await fs.readFile(path.join(target.context.config.xhsArchiveItemsDir, "archive_first", name), "utf8")).toBe(
      value
    );
  db.close();
});
it("keeps the target's complete edit and publication/group state when the same platform work has another local ID", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context);
  await archive(target.context, "target_first", "12345678", "target-video");
  const db = new ToolboxDatabase(target.context.config.databasePath);
  db.remove("archive-publication", "target_first");
  db.remove("archive-group-member", "target_first");
  db.close();
  const file = await backupFile(source, ["content-archive"]);
  await restoreFile(target, file, ["content-archive"]);
  const after = new ToolboxDatabase(target.context.config.databasePath);
  expect(after.list("xhs-archive")).toHaveLength(1);
  expect(after.list("archive-publication")).toHaveLength(0);
  expect(after.list("archive-group-member")).toHaveLength(0);
  after.close();
  expect(
    await fs.readFile(path.join(target.context.config.xhsArchiveItemsDir, "target_first", "video.mp4"), "utf8")
  ).toBe("target-video");
});
it("replaces an archive with an explicitly empty module and does not resurrect old manifests on startup", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(target.context);
  const file = await backupFile(source, ["content-archive"]);
  await restoreFile(target, file, ["content-archive"], "replace");
  const db = new ToolboxDatabase(target.context.config.databasePath);
  const store = new ContentArchiveStore(target.context.config, db);
  expect((await store.list()).total).toBe(0);
  db.close();
});
it("merges audio ID and preset-name conflicts, rewrites queue references and reimports without duplicates", async () => {
  const source = await fixture(),
    target = await fixture();
  await music(source.context, "music_first1", "incoming", "导入音乐");
  await music(target.context, "music_first1", "target", "现有音乐");
  const file = await backupFile(source, ["audio-library"]);
  await restoreFile(target, file, ["audio-library"]);
  const inspect = async () => {
    const db = new ToolboxDatabase(target.context.config.databasePath);
    const store = new AudioLibraryStore(target.context.config.storageRoot, db, 10 ** 9);
    await store.initialize();
    const result = await store.snapshot();
    db.close();
    return result;
  };
  const first = await inspect();
  expect(first.items).toHaveLength(2);
  expect(first.presets).toHaveLength(2);
  const incoming = first.items.find((item) => item.title === "导入音乐")!;
  expect(incoming.id).not.toBe("music_first1");
  expect(first.presets?.find((preset) => preset.name !== "队列")?.itemIds).toEqual([incoming.id]);
  expect(
    await fs.readFile(
      path.join(target.context.config.storageRoot, "audio-library", "items", incoming.id, "audio.wav"),
      "utf8"
    )
  ).toBe("incoming");
  await restoreFile(target, file, ["audio-library"]);
  const second = await inspect();
  expect(second.items).toHaveLength(2);
  expect(second.presets).toHaveLength(2);
});
it("moves AI independent snapshots to the new data root and retains successful history indefinitely", async () => {
  const source = await fixture(),
    target = await fixture();
  const id = "image_first1";
  const input = await putFile(source.context, `image-ai/inputs/${id}/source.png`, "input"),
    output = await putFile(source.context, `image-ai/outputs/${id}/result.png`, "output");
  const db = new ToolboxDatabase(source.context.config.databasePath);
  putEntity(db, "image-ai-task", {
    id,
    operation: "background_remove",
    status: "completed",
    progress: 100,
    queuePosition: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    warnings: [],
    inputs: [{ path: input, originalName: "a.png", mimetype: "image/png", size: 5, width: 1, height: 1 }],
    assets: { foreground: input },
    results: [
      {
        id: "result_first",
        originalName: "a.png",
        outputName: "result.png",
        downloadUrl: `/api/v1/tools/image-ai/tasks/${id}/results/result_first`,
        width: 1,
        height: 1,
        provider: "birefnet-general",
        model: "test",
        warnings: [],
        outputPath: output
      }
    ]
  });
  db.close();
  const file = await backupFile(source, ["image-ai"]);
  await restoreFile(target, file, ["image-ai"], "replace");
  const after = new ToolboxDatabase(target.context.config.databasePath);
  const task = after.get("image-ai-task", id)!.payload as {
    inputs: Array<{ path: string }>;
    results: Array<{ outputPath: string }>;
    expiresAt: null;
  };
  after.close();
  expect(task.inputs[0].path).toBe(path.join(target.context.config.imageAiInputsDir, id, "source.png"));
  expect(task.expiresAt).toBeNull();
  expect(await fs.readFile(task.results[0].outputPath, "utf8")).toBe("output");
  expect(JSON.stringify(task)).not.toContain(source.context.config.storageRoot.replaceAll("\\", "\\\\"));
});
it("restores LAN files and note images with original expiry, excluding in-progress upload sessions", async () => {
  const source = await fixture(),
    target = await fixture();
  await putFile(source.context, "lan-transfer/files/file.dat", "file");
  await putFile(source.context, "lan-transfer/notes/images/image.png", "img");
  const db = new ToolboxDatabase(source.context.config.databasePath);
  putEntity(db, "lan-file", {
    id: "lan_first123",
    originalName: "文件",
    storedName: "file.dat",
    mimeType: "application/octet-stream",
    extension: "dat",
    category: "other",
    size: 4,
    previewable: false,
    downloadCount: 3,
    createdAt: now,
    expiresAt: expires
  });
  putEntity(db, "lan-note", {
    id: "note_first12",
    content: "便笺",
    images: [
      {
        id: "note_image12",
        originalName: "图片",
        storedName: "image.png",
        mimeType: "image/png",
        extension: "png",
        size: 3
      }
    ],
    createdAt: now,
    expiresAt: expires
  });
  putEntity(db, "upload-session", { id: "incomplete12", token: "secret-token" });
  db.close();
  const file = await backupFile(source, ["lan-transfer"]);
  await restoreFile(target, file, ["lan-transfer"], "replace");
  const after = new ToolboxDatabase(target.context.config.databasePath);
  const files = createLanFileStore(target.context.config, after),
    notes = createLanNoteStore(target.context.config, after);
  expect((await files.get("lan_first123"))?.expiresAt).toBe(expires);
  expect((await notes.get("note_first12"))?.images[0].storedName).toBe("image.png");
  expect(after.list("upload-session")).toHaveLength(0);
  after.close();
});
it("restores Edge-TTS and permanent reference voices without installing or invoking Python", async () => {
  const source = await fixture(),
    target = await fixture();
  await putFile(source.context, "edge-tts/tasks/edge_first12/audio.mp3", "voice");
  await putFile(source.context, "chatterbox/voices/voice_first1/reference.wav", "reference");
  const db = new ToolboxDatabase(source.context.config.databasePath);
  putEntity(db, "edge-tts-task", {
    id: "edge_first12",
    status: "completed",
    progress: 100,
    text: "hello",
    language: "en-US",
    voice: "en-US-JennyNeural",
    rate: 0,
    volume: 0,
    pitch: 0,
    includeSubtitles: false,
    characterCount: 5,
    createdAt: now,
    updatedAt: now,
    expiresAt: expires
  });
  putEntity(db, "chatterbox-voice", {
    id: "voice_first1",
    name: "永久参考",
    language: "en",
    originalFileName: "ref.wav",
    durationSeconds: 10,
    audioBytes: 9,
    authorization: "self",
    consentConfirmed: true,
    createdAt: now,
    updatedAt: now
  });
  db.close();
  const file = await backupFile(source, ["speech"]);
  await restoreFile(target, file, ["speech"], "replace");
  const after = new ToolboxDatabase(target.context.config.databasePath);
  expect(after.get("chatterbox-voice", "voice_first1")?.payload).toMatchObject({
    consentConfirmed: true,
    authorization: "self"
  });
  expect(after.get("edge-tts-task", "edge_first12")?.payload).toMatchObject({ expiresAt: expires });
  after.close();
  expect(
    await fs.readFile(path.join(target.context.config.chatterboxDir, "voices", "voice_first1", "reference.wav"), "utf8")
  ).toBe("reference");
});

it("rolls back all selected files and DB records when a transaction fails", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context);
  await compress(source.context, "source_task", "new");
  await compress(target.context, "target_task", "old");
  const file = await backupFile(source, ["image-compress", "content-archive"]),
    id = crypto.randomUUID();
  await previewImport(target.context, file, ["image-compress", "content-archive"], "replace", id);
  const original = ToolboxDatabase.prototype.upsert;
  let injected = false;
  vi.spyOn(ToolboxDatabase.prototype, "upsert").mockImplementation(function (this: ToolboxDatabase, entity) {
    if (entity.kind === "xhs-archive" && !injected) {
      injected = true;
      throw new Error("synthetic commit failure");
    }
    return original.call(this, entity);
  });
  await expect(restoreImport(target.context, id, crypto.randomUUID())).rejects.toThrow("synthetic commit failure");
  const db = new ToolboxDatabase(target.context.config.databasePath, { maintenance: true });
  expect(db.get("task", "target_task")).toBeTruthy();
  expect(db.list("xhs-archive")).toHaveLength(0);
  db.close();
  expect(await fs.readFile(path.join(target.context.config.outputDir, "target_task.png"), "utf8")).toBe("old");
  await expect(fs.stat(path.join(target.context.config.outputDir, "source_task.png"))).rejects.toMatchObject({
    code: "ENOENT"
  });
});
it.each(["prepared", "switching", "committed"] as const)(
  "recovers a %s crash journal before startup",
  async (state) => {
    const f = await fixture(),
      id = crypto.randomUUID(),
      stage = path.join(f.context.config.storageRoot, `.module-restore-${id}`);
    await fs.mkdir(stage);
    await putFile(f.context, "outputs/old.png", state === "prepared" ? "old" : "new");
    if (state !== "prepared") await fs.writeFile(path.join(stage, "old-0"), "old");
    await writeDurable(path.join(f.context.controlRoot, "journals", `${id}.json`), {
      id,
      state,
      modules: ["image-compress"],
      changes: [{ path: "outputs/old.png", existed: true, hash: hashText("new") }]
    });
    if (state === "committed") {
      const db = new ToolboxDatabase(f.context.config.databasePath);
      putEntity(db, "data-backup-commit", {}, id);
      db.close();
    }
    await recoverRestores(f.context);
    expect(await fs.readFile(path.join(f.context.config.outputDir, "old.png"), "utf8")).toBe(
      state === "committed" ? "new" : "old"
    );
    await expect(fs.stat(path.join(f.context.controlRoot, "journals", `${id}.json`))).rejects.toMatchObject({
      code: "ENOENT"
    });
  }
);
it("preserves a committed journal and recovery files when the new file fails verification", async () => {
  const f = await fixture(),
    id = crypto.randomUUID(),
    stage = path.join(f.context.config.storageRoot, `.module-restore-${id}`);
  await fs.mkdir(stage);
  await fs.writeFile(path.join(stage, "old-0"), "old");
  await putFile(f.context, "outputs/old.png", "unexpected");
  const db = new ToolboxDatabase(f.context.config.databasePath);
  putEntity(db, "data-backup-commit", {}, id);
  db.close();
  await writeDurable(path.join(f.context.controlRoot, "journals", `${id}.json`), {
    id,
    state: "committed",
    modules: ["image-compress"],
    changes: [{ path: "outputs/old.png", existed: true, hash: hashText("new") }]
  });
  await expect(recoverRestores(f.context)).rejects.toThrow("已保留");
  expect(await fs.readFile(path.join(stage, "old-0"), "utf8")).toBe("old");
});
it("rejects corrupted content and missing declared assets before mutating the target", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context);
  const bundle = await snapshot(source.context, { modules: ["content-archive"] }, path.join(source.root, "snapshot"));
  await fs.writeFile(path.join(bundle.directory, "objects", bundle.modules[0].files[0].sha256), "corrupted");
  const file = path.join(source.root, "corrupted.zip");
  await packBundle(bundle, file, source.context.signal, source.context.progress);
  await expect(
    previewImport(target.context, file, ["content-archive"], "replace", crypto.randomUUID())
  ).rejects.toThrow(/大小|摘要/);
  const db = new ToolboxDatabase(target.context.config.databasePath);
  expect(db.list("xhs-archive")).toHaveLength(0);
  db.close();
});
it("honors cancellation before mutation and keeps other modules when importing only part of a multi-module package", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context);
  await compress(source.context, "source_task");
  const file = await backupFile(source, ["image-compress", "content-archive"]);
  const canceled = { ...target.context, signal: AbortSignal.abort(new Error("cancel requested")) };
  await expect(inspectPackage(canceled, file, path.join(target.root, "canceled"))).rejects.toThrow("cancel requested");
  await restoreFile(target, file, ["content-archive"], "replace");
  const db = new ToolboxDatabase(target.context.config.databasePath);
  expect(db.list("xhs-archive")).toHaveLength(1);
  expect(db.list("task")).toHaveLength(0);
  db.close();
});

it("rejects unsafe media types and malformed profile histories before they can break restored startup", async () => {
  const f = await fixture();
  await archive(f.context);
  const [module] = await currentModules(f.context, ["content-archive"]);
  (module.records.find((row) => row.kind === "xhs-archive")!.payload as ContentArchiveItem).media[0].mimeType =
    "text/html";
  expect(() => validateModuleData(module)).toThrow("媒体类型");
  const profile = {
    version: 1,
    meta: {
      id: "profile_first",
      username: "demo",
      url: "https://www.tiktok.com/@demo",
      phase: "completed",
      complete: true,
      discoveredCount: 1,
      message: "完成",
      createdAt: now,
      updatedAt: now,
      archivedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      pendingCount: 0,
      batchCount: 0
    },
    works: [{ id: "12345678", url: "https://www.tiktok.com/@demo/video/12345678" }],
    batchIds: [],
    nextIndex: 0
  };
  const row = { id: "profile_first", kind: "tiktok-profile-job", payload: profile, createdAt: now, updatedAt: now };
  const clean = { ...module, records: [row], files: [] };
  expect(() => validateModuleData(clean)).not.toThrow();
  profile.meta.discoveredCount = 2;
  expect(() => validateModuleData(clean)).toThrow("主页历史格式");
  profile.meta.discoveredCount = 1;
  profile.works[0].url = "https://www.tiktok.com/@other/video/12345678";
  expect(() => validateModuleData(clean)).toThrow("主页历史格式");
});
it("restores an automatic restore point using the same checked replace pipeline and saves the state being rolled back", async () => {
  const source = await fixture(),
    target = await fixture();
  await compress(source.context, "new_output12", "new");
  await compress(target.context, "old_output12", "old");
  await archive(target.context);
  await restoreFile(target, await backupFile(source, ["image-compress"]), ["image-compress"], "replace");
  const points = path.join(target.context.controlRoot, "restore-points");
  const [point] = await fs.readdir(points),
    directory = path.join(points, point);
  const manifest: BackupManifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8"));
  const meta: Omit<ModuleData, "files"> = JSON.parse(
    await fs.readFile(path.join(directory, "modules/image-compress/records.json"), "utf8")
  );
  const files: ModuleData["files"] = JSON.parse(
    await fs.readFile(path.join(directory, "modules/image-compress/files.json"), "utf8")
  );
  const zip = path.join(target.root, "rollback.zip");
  await packBundle(
    { manifest, directory, modules: [{ ...meta, files }] },
    zip,
    target.context.signal,
    target.context.progress
  );
  await restoreFile(target, zip, ["image-compress"], "replace");
  expect(await fs.readdir(points)).toHaveLength(2);
  const db = new ToolboxDatabase(target.context.config.databasePath);
  try {
    expect(db.get("task", "old_output12")).toBeDefined();
    expect(db.get("task", "new_output12")).toBeUndefined();
    expect(db.get("xhs-archive", "archive_first")).toBeDefined();
  } finally {
    db.close();
  }
  expect(await fs.readFile(path.join(target.context.config.storageRoot, "outputs/old_output12.png"), "utf8")).toBe(
    "old"
  );
});
it("rejects insufficient space before changing any data", async () => {
  const f = await fixture();
  const stat = await fs.statfs(f.root);
  vi.spyOn(fs, "statfs").mockResolvedValue({ ...stat, bavail: 0 });
  await expect(enoughSpace(f.root, 1)).rejects.toThrow("尚未修改业务数据");
});
it("reuses identical named watermark presets and renames conflicting recipes without duplicating them on repeat import", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context);
  await archive(target.context, "another_work", "98765432");
  const db = new ToolboxDatabase(target.context.config.databasePath);
  const row = db.get("archive-watermark-preset", "preset_first")!;
  db.upsert({
    ...row,
    payload: {
      ...(row.payload as object),
      points: [
        { progress: 0, x: 1, y: 1 },
        { progress: 1, x: 0, y: 0 }
      ]
    }
  });
  db.close();
  const file = await backupFile(source, ["content-archive"]);
  await restoreFile(target, file, ["content-archive"]);
  await restoreFile(target, file, ["content-archive"]);
  const after = new ToolboxDatabase(target.context.config.databasePath);
  try {
    expect(
      after
        .list("archive-watermark-preset")
        .map((row) => (row.payload as { name: string }).name)
        .sort()
    ).toEqual(["轨迹", "轨迹（导入 1）"]);
  } finally {
    after.close();
  }
});
it("deduplicates indexed compression outputs whose progress records were trimmed, even after an ID conflict", async () => {
  const source = await fixture(),
    target = await fixture();
  await compress(source.context, "old_output1", "incoming");
  await compress(target.context, "old_output1", "existing");
  for (const f of [source, target]) {
    const db = new ToolboxDatabase(f.context.config.databasePath);
    const data = await fs.readFile(path.join(f.context.config.storageRoot, "outputs/old_output1.png"));
    db.upsertFile({
      id: "indexed_old_output",
      entityKind: "image-compress",
      entityId: "old_output1",
      relativePath: "outputs/old_output1.png",
      byteSize: data.length,
      sha256: hashText(data.toString()),
      mediaType: "image/png",
      createdAt: now,
      owner: "local"
    });
    db.remove("task", "old_output1");
    db.close();
  }
  const file = await backupFile(source, ["image-compress"]);
  await restoreFile(target, file, ["image-compress"]);
  await restoreFile(target, file, ["image-compress"]);
  const db = new ToolboxDatabase(target.context.config.databasePath);
  try {
    expect(db.listFiles().filter((f) => f.entityKind === "image-compress")).toHaveLength(2);
  } finally {
    db.close();
  }
});
it("remaps colliding archive and nested media IDs while keeping covers, downloads and group/publication links consistent", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context, "archive_first", "11111111", "incoming");
  await archive(target.context, "archive_first", "22222222", "existing");
  const file = await backupFile(source, ["content-archive"]);
  await restoreFile(target, file, ["content-archive"]);
  const db = new ToolboxDatabase(target.context.config.databasePath);
  const all = db.list("xhs-archive").map((row) => row.payload as ContentArchiveItem);
  const imported = all.find((item) => item.contentId === "11111111")!;
  expect(imported.id).not.toBe("archive_first");
  expect(imported.media[0].id).not.toBe("media_first");
  expect(imported.coverMediaId).toBe(imported.media[0].id);
  expect(imported.media[0].downloadUrl).toBe(
    `/api/v1/tools/media-archive/items/${imported.id}/media/${imported.media[0].id}?download=1`
  );
  expect(db.get("archive-publication", imported.id)?.payload).toMatchObject({ archiveId: imported.id });
  expect(db.get("archive-group-member", imported.id)?.status).toBe("group_first1");
  db.close();
});
it("can open a restored multi-module package through the real application without models or signed capability changes", async () => {
  const source = await fixture(),
    target = await fixture();
  await archive(source.context);
  await music(source.context);
  await compress(source.context, "source_task");
  const modules: BackupModuleId[] = [
    "image-compress",
    "image-ai",
    "speech",
    "audio-library",
    "content-archive",
    "lan-transfer"
  ];
  const file = await backupFile(source, modules);
  await restoreFile(target, file, modules, "replace");
  const app = await createApp({ config: target.context.config });
  try {
    const list = await app.inject({ method: "GET", url: "/api/v1/tools/media-archive/items" });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.total).toBe(1);
    const media = await app.inject({
      method: "GET",
      url: "/api/v1/tools/media-archive/items/archive_first/media/media_first",
      headers: { range: "bytes=0-2" }
    });
    expect(media.statusCode).toBe(206);
    expect(media.body).toBe("vid");
    expect((await app.inject({ method: "GET", url: "/api/v1/files/source_task.png" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/tools/audio-library/items" })).statusCode).toBe(200);
  } finally {
    await app.close();
  }
});
it("preserves unselected shared task IDs even when a domain's old projection was absent in the source", async () => {
  const source = await fixture(),
    target = await fixture(),
    id = "edge_first12";
  await compress(target.context, id, "keep");
  await putFile(source.context, `edge-tts/tasks/${id}/audio.mp3`, "voice");
  const db = new ToolboxDatabase(source.context.config.databasePath);
  putEntity(db, "edge-tts-task", {
    id,
    status: "completed",
    progress: 100,
    text: "hello",
    language: "en-US",
    voice: "en-US-JennyNeural",
    rate: 0,
    volume: 0,
    pitch: 0,
    includeSubtitles: false,
    characterCount: 5,
    createdAt: now,
    updatedAt: now,
    expiresAt: expires
  });
  db.close();
  const file = await backupFile(source, ["speech"]);
  await restoreFile(target, file, ["speech"], "replace");
  const after = new ToolboxDatabase(target.context.config.databasePath);
  expect(after.get("task", id)?.payload).toMatchObject({ toolId: "image-compress" });
  const imported = after.list("edge-tts-task")[0];
  expect(imported.id).not.toBe(id);
  after.close();
  expect(await fs.readFile(path.join(target.context.config.edgeTtsTasksDir, imported.id, "audio.mp3"), "utf8")).toBe(
    "voice"
  );
});
it("retains independent Chatterbox batch references, item order and GPU parameters while remapping a colliding batch", async () => {
  const source = await fixture(),
    target = await fixture();
  const seed = async (context: BackupContext, body: string) => {
    await putFile(context, "chatterbox/batches/batch_first1/reference.wav", "reference");
    await putFile(context, "chatterbox/batches/batch_first1/items/item_first12/audio.mp3", body);
    const item = {
      id: "item_first12",
      order: 1,
      text: body,
      status: "completed",
      progress: 100,
      attempt: 1,
      characterCount: body.length,
      audioBytes: body.length,
      createdAt: now,
      updatedAt: now
    };
    const batch = {
      id: "batch_first1",
      engine: "chatterbox-multilingual-v3",
      status: "completed",
      progress: 100,
      language: "en",
      device: "cuda",
      referenceFileName: "ref.wav",
      referenceDurationSeconds: 10,
      referenceRetained: true,
      referenceAvailable: true,
      authorization: "authorized",
      consentConfirmed: true,
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      seed: 1,
      includeSubtitles: false,
      subtitleMode: "segments",
      items: [item],
      totalCharacters: body.length,
      completedItems: 1,
      failedItems: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: expires
    };
    const db = new ToolboxDatabase(context.config.databasePath);
    putEntity(db, "chatterbox-batch", batch);
    putEntity(db, "chatterbox-item", { ...item, batchId: batch.id });
    db.close();
  };
  await seed(source.context, "incoming");
  await seed(target.context, "existing");
  const file = await backupFile(source, ["speech"]);
  await restoreFile(target, file, ["speech"]);
  const db = new ToolboxDatabase(target.context.config.databasePath);
  const imported = db.list("chatterbox-batch").find((row) => row.id !== "batch_first1")!;
  expect(imported.payload).toMatchObject({
    device: "cuda",
    authorization: "authorized",
    items: [{ order: 1, text: "incoming" }]
  });
  const item = db.list("chatterbox-item").find((row) => (row.payload as { batchId: string }).batchId === imported.id)!;
  expect(item.id).not.toBe("item_first12");
  db.close();
  expect(
    await fs.readFile(
      path.join(target.context.config.chatterboxDir, "batches", imported.id, "items", item.id, "audio.mp3"),
      "utf8"
    )
  ).toBe("incoming");
});
it("keeps online speech batches, translated subtitles and task references readable after colliding IDs are merged", async () => {
  const source = await fixture(),
    target = await fixture();
  const seed = async (context: BackupContext, body: string) => {
    const input = {
      text: body,
      language: "en-US",
      voice: "en-US-JennyNeural",
      rate: 0,
      volume: 0,
      pitch: 0,
      includeSubtitles: true
    };
    await putFile(context, "edge-tts/tasks/online_task1/audio.mp3", body);
    await putFile(context, "edge-tts/tasks/online_task1/subtitle.srt", "1\n00:00:00,000 --> 00:00:01,000\nhello");
    for (const name of ["combined.mp3", "subtitle.srt", "subtitle.zh-CN.srt", "subtitle.bilingual.srt"])
      await putFile(context, `edge-tts/batches/online_batch/${name}`, body);
    const db = new ToolboxDatabase(context.config.databasePath);
    putEntity(db, "edge-tts-task", {
      ...input,
      id: "online_task1",
      status: "completed",
      progress: 100,
      characterCount: body.length,
      createdAt: now,
      updatedAt: now,
      expiresAt: expires
    });
    const { text: _text, ...settings } = input;
    putEntity(db, "edge-tts-batch", {
      ...settings,
      id: "online_batch",
      subtitleMode: "segments",
      items: [{ id: "entry_first1", taskId: "online_task1", attempt: 1, referenceTranslation: "中文翻译", input }],
      createdAt: now,
      updatedAt: now,
      expiresAt: expires
    });
    db.close();
  };
  await seed(source.context, "incoming");
  await seed(target.context, "existing");
  await restoreFile(target, await backupFile(source, ["speech"]), ["speech"]);
  const db = new ToolboxDatabase(target.context.config.databasePath);
  const batch = db.list("edge-tts-batch").find((row) => row.id !== "online_batch")!;
  db.close();
  expect(batch).toBeDefined();
  expect(
    await fs.readFile(
      path.join(target.context.config.storageRoot, "edge-tts/batches", batch.id, "subtitle.bilingual.srt"),
      "utf8"
    )
  ).toBe("incoming");
  const app = await createApp({ config: target.context.config });
  try {
    const response = await app.inject({ method: "GET", url: `/api/v1/tools/edge-tts/batches/${batch.id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.items[0]).toMatchObject({ text: "incoming", referenceTranslation: "中文翻译" });
  } finally {
    await app.close();
  }
});
