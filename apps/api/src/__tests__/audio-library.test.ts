/** 永久音频库：真实 SQLite、音频解析、事务恢复、Range 与 ZIP 往返验收。 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { ZipArchive } from "archiver";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  AudioLibraryListSchema,
  AudioLibraryImportResultSchema,
  AudioLibraryPresetSchema,
  AudioLibraryPresetLoadSchema,
  AudioLibraryEditSchema
} from "@toolbox/shared";
import { ToolboxDatabase } from "../database/toolbox-database";
import { getConfig } from "../config";
import { createTaskStore } from "../tasks/task-store";
import { ChatterboxBatchStore } from "../domains/speech/chatterbox/stores";
import { AudioLibraryStore, readCatalog } from "../domains/audio-library/store";
import { inspectAudio } from "../domains/audio-library/media";
import { registerAudioLibraryRoutes } from "../domains/audio-library/routes";
import { readArchiveZip } from "./helpers/archive-zip";

let root: string,
  database: ToolboxDatabase,
  app: FastifyInstance,
  store: AudioLibraryStore,
  batches: ChatterboxBatchStore;
const prefix = "/api/v1/tools/audio-library";
function wav(seconds = 0.1) {
  const samples = Math.round(8000 * seconds),
    buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
function upload(bytes: Buffer = wav(), fields: Record<string, string> = {}, name = "直播.wav") {
  const boundary = "audio-library-test";
  const chunks: Buffer[] = [];
  for (const [key, value] of Object.entries(fields))
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  );
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(chunks) };
}
async function add(fields: Record<string, string> = {}, bytes = wav()) {
  const response = await app.inject({ method: "POST", url: `${prefix}/uploads`, ...upload(bytes, fields) });
  expect(response.statusCode, response.body).toBe(200);
  return response.json().data.item;
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-audio-library-"));
  database = new ToolboxDatabase(path.join(root, "toolbox.db"));
  batches = new ChatterboxBatchStore(
    path.join(root, "chatterbox", "batches"),
    database,
    createTaskStore(1000, database)
  );
  await batches.initialize();
  app = Fastify();
  await app.register(multipart);
  store = await registerAudioLibraryRoutes(
    app,
    { ...getConfig(), storageRoot: root, audioLibraryMaxStorageBytes: 1024 * 1024 },
    database,
    batches
  );
  await app.ready();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
  database.close();
  await fs.rm(root, { recursive: true, force: true });
});
describe("永久音频库", () => {
  it("背景音乐分类兼容旧素材，支持改用途、重启及回收站，不改变分组和预设", async () => {
    const old = await add({ title: "原素材" }, wav(0.1));
    await store.mutate((catalog) => {
      delete catalog.items.find((entry) => entry.id === old.id)!.purpose;
    });
    const music = await add({ title: "配乐", purpose: "music" }, wav(0.2));
    expect((await store.list({ view: "all" })).items).toHaveLength(2);
    expect((await store.list({ view: "music" })).items.map((entry) => entry.id)).toEqual([music.id]);
    expect((await store.list({ view: "speech" })).items).toEqual([]);
    expect((await store.list({ view: "incomplete" })).items.map((entry) => entry.id)).toEqual([old.id]);
    const changed = await app.inject({
      method: "PATCH",
      url: `${prefix}/items/${old.id}`,
      payload: { purpose: "speech", revision: 1 }
    });
    expect(changed.statusCode).toBe(200);
    expect((await store.list({ view: "speech" })).items.map((entry) => entry.id)).toEqual([old.id]);
    const restarted = new AudioLibraryStore(root, database, 1024 * 1024);
    expect((await restarted.list({ view: "music" })).items[0]?.purpose).toBe("music");
    await store.trash([music.id]);
    expect((await store.list({ view: "music" })).items).toEqual([]);
    expect((await store.list({ view: "trash" })).items[0]?.purpose).toBe("music");
    expect((await store.snapshot()).groups).toEqual([]);
    expect((await store.snapshot()).presets).toEqual([]);
  });
  it("拒绝无效音频用途并释放上传预留", async () => {
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      ...upload(wav(), { purpose: "unknown" })
    });
    expect(response.statusCode).toBe(400);
    expect((await store.snapshot()).items).toEqual([]);
    expect(store.reservedBytes).toBe(0);
  });
  it("裁剪另存同分组 WAV，保留双语和来源范围，原文件与预设不变，重启可读取", async () => {
    const group = await store.group({ name: "直播", parentId: null });
    const item = await add({ title: "原音频", groupId: group.id, chineseText: "中文", foreignText: "Text" }, wav(1));
    await store.savePreset({ name: "原队列", itemIds: [item.id], mode: "list", gap: 1 });
    const before = await store.snapshot();
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/items/${item.id}/clips`,
      ...upload(wav(0.5), { startSeconds: "0.2", endSeconds: "0.7", revision: String(item.revision) }, "clip.wav")
    });
    expect(response.statusCode, response.body).toBe(200);
    const clip = response.json().data.item;
    expect(clip.id).not.toBe(item.id);
    expect(clip).toMatchObject({
      groupId: group.id,
      duration: 0.5,
      chineseText: "中文",
      foreignText: "Text",
      fileName: "audio.wav",
      source: { kind: "clip", originalItemId: item.id, startSeconds: 0.2, endSeconds: 0.7 }
    });
    expect(await fs.readFile(store.file(item))).toEqual(wav(1));
    expect((await store.snapshot()).presets).toEqual(before.presets);
    const restarted = new AudioLibraryStore(root, database, 1024 * 1024);
    await restarted.initialize();
    expect(await restarted.item(clip.id)).toMatchObject({ source: { kind: "clip" } });
    expect((await restarted.list({ source: "clip" })).items).toHaveLength(1);
  });
  it("裁剪拒绝非法范围、版本冲突、时长伪造和损坏文件，不更改原库并清理暂存", async () => {
    const item = await add({}, wav(1));
    const before = await store.snapshot();
    const attempt = (fields: Record<string, string>, bytes = wav(0.5)) =>
      app.inject({
        method: "POST",
        url: `${prefix}/items/${item.id}/clips`,
        ...upload(bytes, { startSeconds: "0.2", endSeconds: "0.7", revision: "1", ...fields })
      });
    expect((await attempt({ startSeconds: "0.8" })).statusCode).toBe(400);
    expect((await attempt({ endSeconds: "2" })).statusCode).toBe(400);
    expect((await attempt({ revision: "2" })).statusCode).toBe(409);
    expect((await attempt({}, wav(0.8))).statusCode).toBe(415);
    expect((await attempt({}, Buffer.from("not audio"))).statusCode).toBe(415);
    expect(await store.snapshot()).toEqual(before);
    expect(store.reservedBytes).toBe(0);
    expect(await fs.readdir(path.join(store.root, "staging"))).toEqual([]);
  });
  it("裁剪配额不足及提交失败保持原库；并发另存生成独立文件", async () => {
    const item = await add({}, wav(1)),
      before = await store.snapshot();
    const attempt = () =>
      app.inject({
        method: "POST",
        url: `${prefix}/items/${item.id}/clips`,
        ...upload(wav(0.5), { startSeconds: "0.2", endSeconds: "0.7", revision: "1" })
      });
    store.reserve("occupied", 1024 * 1024 - store.usedBytes);
    expect((await attempt()).statusCode).toBe(413);
    store.release("occupied");
    vi.spyOn(database, "upsert").mockImplementationOnce(() => {
      throw new Error("commit failed");
    });
    expect((await attempt()).statusCode).toBe(500);
    expect(await store.snapshot()).toEqual(before);
    const results = await Promise.all([attempt(), attempt()]);
    expect(results.map((x) => x.statusCode)).toEqual([200, 200]);
    expect(new Set(results.map((x) => x.json().data.item.id)).size).toBe(2);
    expect(store.reservedBytes).toBe(0);
    expect((await store.snapshot()).items).toHaveLength(3);
  });
  it("旧清单移除退役标签和标记并持久化，保留音频文案；新契约不再包含标签", async () => {
    const item = await add({ chineseText: "欢迎光临" });
    const legacy = await store.snapshot();
    const old = {
      ...legacy,
      tags: ["常用"],
      items: legacy.items.map((x) => ({ ...x, favorite: true, tags: ["常用"] }))
    };
    await fs.writeFile(path.join(store.root, "library.json"), JSON.stringify(old));
    const recovered = new AudioLibraryStore(root, database, 1024 * 1024);
    await recovered.initialize();
    const loaded = await recovered.snapshot();
    expect(loaded.items[0]).not.toHaveProperty("favorite");
    expect(loaded).not.toHaveProperty("tags");
    expect(loaded.items[0]).not.toHaveProperty("tags");
    expect(loaded.items[0]).toMatchObject({ id: item.id, chineseText: "欢迎光临" });
    expect(await recovered.view(loaded.items[0])).toMatchObject({ available: true });
    expect(JSON.parse(await fs.readFile(path.join(store.root, "library.json"), "utf8"))).toEqual(loaded);
    expect(database.list("audio-library-item")[0].payload).not.toHaveProperty("favorite");
    expect(database.list("audio-library-item")[0].payload).not.toHaveProperty("tags");
    expect(Value.Check(AudioLibraryEditSchema, { favorite: true })).toBe(false);
    expect(Value.Check(AudioLibraryEditSchema, { tags: ["常用"] })).toBe(false);
    const list = (await app.inject({ url: `${prefix}/items` })).json().data;
    expect(Value.Check(AudioLibraryListSchema, list)).toBe(true);
    expect(list).not.toHaveProperty("tags");
    expect(list.items[0]).not.toHaveProperty("tags");
    for (const method of ["GET", "POST", "DELETE"] as const)
      expect(
        (
          await app.inject({
            method,
            url: `${prefix}/tags`,
            ...(method === "GET" ? {} : { payload: { name: "常用" } })
          })
        ).statusCode
      ).toBe(404);
    expect((await app.inject({ url: `${prefix}/items?view=favorites` })).statusCode).toBe(400);
    expect(readCatalog({ ...old, unknown: true })).toBeUndefined();
    expect(readCatalog({ ...old, items: [{ ...old.items[0], favorite: "invalid" }] })).toBeUndefined();
    expect(readCatalog({ ...old, tags: 1 })).toBeUndefined();
    expect(readCatalog({ ...old, items: [{ ...old.items[0], tags: [1] }] })).toBeUndefined();
    expect(readCatalog({ ...old, items: [{ ...old.items[0], tags: ["重复", "重复"] }] })).toBeUndefined();
    expect(old.items[0].tags).toEqual(["常用"]);
  });
  it("旧事务日志回滚和旧备份清单恢复时移除标签，不丢失分组、预设与音频", async () => {
    const group = await store.group({ name: "开场", parentId: null });
    const item = await add({ groupId: group.id, chineseText: "中文", foreignText: "Text" });
    await store.edit(item.id, { note: "保留备注" });
    await store.savePreset({ name: "开场队列", itemIds: [item.id], mode: "list", gap: 1 });
    const current = await store.snapshot();
    const old = { ...current, tags: ["旧标签"], items: current.items.map((x) => ({ ...x, tags: ["旧标签"] })) };
    await fs.writeFile(path.join(store.root, "transaction.json"), JSON.stringify(old));
    await fs.writeFile(path.join(store.root, "library.json"), JSON.stringify({ ...current, items: [] }));
    const rollback = new AudioLibraryStore(root, database, 1024 * 1024);
    await rollback.initialize();
    expect(await rollback.snapshot()).toEqual(current);
    await fs.writeFile(path.join(store.root, "library.json.bak"), JSON.stringify(old));
    await fs.writeFile(path.join(store.root, "library.json"), "broken manifest");
    const fallback = new AudioLibraryStore(root, database, 1024 * 1024);
    await fallback.initialize();
    expect(await fallback.snapshot()).toEqual(current);
    expect(await fallback.view(await fallback.item(item.id))).toMatchObject({ available: true, note: "保留备注" });
  });
  it("预设队列接口保存顺序和重复项，支持重命名、更新、并发冲突和独立删除", async () => {
    const one = await add({ title: "一" }),
      two = await add({ title: "二" }, wav(0.2));
    const payload = { name: "开场队列", itemIds: [two.id, one.id, two.id], mode: "list" as const, gap: 3 };
    const response = await app.inject({ method: "POST", url: `${prefix}/presets`, payload });
    expect(response.statusCode, response.body).toBe(200);
    const preset = response.json().data;
    expect(Value.Check(AudioLibraryPresetSchema, preset)).toBe(true);
    expect(preset.itemIds).toEqual(payload.itemIds);
    const loaded = (await app.inject({ url: `${prefix}/presets/${preset.id}/load` })).json().data;
    expect(Value.Check(AudioLibraryPresetLoadSchema, loaded)).toBe(true);
    expect(loaded.items.map((x: { id: string }) => x.id)).toEqual(payload.itemIds);
    expect(loaded.unavailableCount).toBe(0);
    expect(
      (await app.inject({ method: "POST", url: `${prefix}/presets`, payload: { ...payload, name: " 开场队列 " } }))
        .statusCode
    ).toBe(409);
    const renamed = await app.inject({
      method: "PATCH",
      url: `${prefix}/presets/${preset.id}`,
      payload: { ...payload, name: "晚场队列", revision: 1 }
    });
    expect(renamed.json().data).toMatchObject({ revision: 2, name: "晚场队列" });
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `${prefix}/presets/${preset.id}`,
          payload: { ...payload, revision: 1 }
        })
      ).statusCode
    ).toBe(409);
    expect(
      (await app.inject({ method: "DELETE", url: `${prefix}/presets/${preset.id}`, payload: { revision: 1 } }))
        .statusCode
    ).toBe(409);
    const updated = await store.savePreset({ ...payload, name: "晚场队列", itemIds: [one.id], revision: 2 }, preset.id);
    expect(updated.revision).toBe(3);
    expect(
      (await app.inject({ method: "DELETE", url: `${prefix}/presets/${preset.id}`, payload: { revision: 3 } }))
        .statusCode
    ).toBe(200);
    expect(await store.presets()).toEqual([]);
    expect((await store.snapshot()).items).toHaveLength(2);
    expect(database.list("audio-library-preset")).toEqual([]);
  });
  it("预设加载跳过回收站、缺失或彻底删除的音频；无效创建不影响原库", async () => {
    const one = await add(),
      two = await add({}, wav(0.2));
    const preset = await store.savePreset({
      name: "重复队列",
      itemIds: [one.id, two.id, one.id],
      mode: "sequence",
      gap: 1
    });
    await store.trash([one.id]);
    expect(await store.loadPreset(preset.id)).toMatchObject({ unavailableCount: 2, items: [{ id: two.id }] });
    await store.purge(one.id);
    await fs.rm(store.file(two));
    expect(await store.loadPreset(preset.id)).toMatchObject({ unavailableCount: 3, items: [] });
    // 失效引用保留，允许重命名而不是误删整张预设。
    await store.savePreset({ ...preset, name: "待修复", revision: preset.revision }, preset.id);
    expect((await store.presets())[0].itemIds).toEqual(preset.itemIds);
    const request = (payload: unknown) =>
      app.inject({ method: "POST", url: `${prefix}/presets`, payload: payload as Record<string, unknown> });
    expect((await request({ name: "空", itemIds: [], mode: "list", gap: 1 })).statusCode).toBe(400);
    expect((await request({ name: "越界", itemIds: [two.id], mode: "list", gap: 301 })).statusCode).toBe(400);
    expect((await request({ name: "未知", itemIds: ["unknown"], mode: "list", gap: 1 })).statusCode).toBe(409);
  });
  it("兼容旧清单，数据库清空后重建预设，完整备份可恢复且处理音频 ID 冲突", async () => {
    const item = await add();
    const legacy = await store.snapshot();
    delete legacy.presets;
    await fs.writeFile(path.join(store.root, "library.json"), JSON.stringify(legacy));
    const upgrade = new AudioLibraryStore(root, database, 1024 * 1024);
    await upgrade.initialize();
    expect(await upgrade.presets()).toEqual([]);
    const preset = await store.savePreset({ name: "长期预设", itemIds: [item.id, item.id], mode: "single", gap: 5 });
    database.connection.exec("DELETE FROM entities WHERE kind='audio-library-preset'");
    const reopened = new AudioLibraryStore(root, database, 1024 * 1024);
    await reopened.initialize();
    expect(await reopened.presets()).toEqual([preset]);
    expect(database.list("audio-library-preset")).toHaveLength(1);
    const backup = await store.snapshot(),
      directory = await store.staging(),
      file = path.join(directory, "items", item.id, "audio.wav");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, wav(0.2));
    Object.assign(backup.items[0], await inspectAudio(file));
    await store.restore(backup, directory, "preset-restore");
    const snapshot = await store.snapshot();
    expect(snapshot.presets).toHaveLength(2);
    const added = snapshot.items.find((x) => x.id !== item.id)!;
    expect(snapshot.presets![1]).toMatchObject({ name: "长期预设（导入2）", itemIds: [added.id, added.id] });
    const exported = readArchiveZip((await app.inject({ url: `${prefix}/backup` })).rawPayload);
    expect(JSON.parse(exported.get("manifest.json")!.toString()).presets).toHaveLength(2);
    const selected = readArchiveZip((await app.inject({ url: `${prefix}/exports?ids=${item.id}` })).rawPayload);
    expect(JSON.parse(selected.get("manifest.json")!.toString()).presets).toEqual([]);
  });
  it("上传保存全部可编辑信息，备注和分组重启后保留且参与检索和备份", async () => {
    const group = await store.group({ name: "夜场开场", parentId: null });
    const metadata = {
      title: "欢迎来到直播间",
      language: "ms",
      foreignText: "Selamat datang\nTerima kasih",
      chineseText: "欢迎光临\n谢谢",
      note: "夜场轻声播放\n避免重复",
      groupId: group.id
    };
    const item = await add(metadata);
    expect(item).toMatchObject(metadata);
    const reopened = new AudioLibraryStore(root, database, 1024 * 1024);
    await reopened.initialize();
    expect(await reopened.item(item.id)).toMatchObject(metadata);
    expect((await reopened.list({ keyword: "夜场轻声播放" })).items.map((entry) => entry.id)).toEqual([item.id]);
    const backup = readArchiveZip((await app.inject({ url: `${prefix}/backup` })).rawPayload);
    expect(JSON.parse(backup.get("manifest.json")!.toString()).items[0]).toMatchObject(metadata);
    expect(backup.get(`texts/${item.id}.txt`)!.toString()).toContain(metadata.note);
  });
  it("仅音频必填，省略或留空的字段使用默认值，之后可补齐全部信息", async () => {
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      ...upload(wav(), {}, "only-audio.wav")
    });
    expect(response.statusCode, response.body).toBe(200);
    const item = response.json().data.item;
    expect(item).toMatchObject({
      title: "only-audio",
      language: "und",
      foreignText: "",
      chineseText: "",
      note: "",
      groupId: null
    });
    const blank = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      ...upload(
        wav(0.2),
        {
          title: "   ",
          language: "   ",
          foreignText: "",
          chineseText: "",
          note: "",
          groupId: "   "
        },
        "blank.wav"
      )
    });
    expect(blank.statusCode, blank.body).toBe(200);
    expect(blank.json().data.item).toMatchObject({ title: "blank", language: "und", groupId: null });
    const group = await store.group({ name: "后补分组", parentId: null });
    const metadata = {
      title: "后补标题",
      language: "en",
      foreignText: "Welcome",
      chineseText: "欢迎",
      note: "后补备注",
      groupId: group.id
    };
    const patched = await app.inject({
      method: "PATCH",
      url: `${prefix}/items/${item.id}`,
      payload: { ...metadata, revision: item.revision }
    });
    expect(patched.statusCode, patched.body).toBe(200);
    expect(patched.json().data).toMatchObject(metadata);
    expect(await fs.readFile(store.file(item))).toEqual(wav());
  });
  it("上传缺少音频、备注超限或分组无效时不入库，并清理临时文件", async () => {
    const missing = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      headers: { "content-type": "multipart/form-data; boundary=no-audio" },
      payload: '--no-audio\r\nContent-Disposition: form-data; name="title"\r\n\r\n没有音频\r\n--no-audio--\r\n'
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe("AUDIO_LIBRARY_UPLOAD_INVALID");
    const tooLong = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      ...upload(wav(), { note: "长".repeat(2001) })
    });
    expect(tooLong.statusCode).toBe(400);
    const wrongGroup = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      ...upload(wav(), { groupId: "missing" })
    });
    expect(wrongGroup.statusCode).toBe(404);
    expect((await store.snapshot()).items).toHaveLength(0);
    expect(store.reservedBytes).toBe(0);
    expect(await fs.readdir(path.join(store.root, "staging"))).toEqual([]);
  });
  it("校验实际格式、有效时长、共享响应契约和缺失文案；同文件可显式另存", async () => {
    const item = await add({ foreignText: "Selamat datang", title: "欢迎" });
    expect(item).toMatchObject({
      title: "欢迎",
      fileName: "audio.wav",
      mimeType: "audio/wav",
      duration: 0.1,
      available: true
    });
    const duplicate = await app.inject({ method: "POST", url: `${prefix}/uploads`, ...upload() });
    expect(duplicate.json().data).toMatchObject({ existing: true, item: { id: item.id } });
    const other = await add({ keepDuplicate: "true" });
    expect(other.id).not.toBe(item.id);
    const list = await app.inject({ url: `${prefix}/items?view=incomplete&keyword=Selamat` });
    expect(Value.Check(AudioLibraryListSchema, list.json().data)).toBe(true);
    expect(list.json().data.total).toBe(1);
    const fake = await app.inject({
      method: "POST",
      url: `${prefix}/uploads`,
      ...upload(Buffer.from("fake mp3"), {}, "fake.mp3")
    });
    expect(fake.statusCode).toBe(415);
    const file = path.join(root, "empty.wav");
    await fs.writeFile(file, wav(0));
    await expect(inspectAudio(file)).rejects.toThrow();
    expect(await fs.readdir(path.join(store.root, "staging"))).toEqual([]);
  });
  it("支持三级分组、循环/重名校验、移动撤销及删除分组保留回收站内容", async () => {
    const top = await store.group({ name: "开场", parentId: null }),
      child = await store.group({ name: "马来语", parentId: top.id }),
      leaf = await store.group({ name: "欢迎", parentId: child.id });
    await expect(store.group({ name: "四级", parentId: leaf.id })).rejects.toThrow("最多三级");
    await expect(store.group({ id: top.id, name: "开场", parentId: child.id })).rejects.toThrow();
    await expect(store.group({ name: " 开场 ", parentId: null })).rejects.toThrow("不可重复");
    const item = await add({ groupId: leaf.id });
    expect((await store.list({ groupId: top.id })).total).toBe(1);
    const token = await store.move([item.id], null);
    await store.undo(token);
    expect((await store.item(item.id)).groupId).toBe(leaf.id);
    const conflict = await store.move([item.id], null);
    await store.edit(item.id, { note: "修改过" });
    await expect(store.undo(conflict)).rejects.toThrow("不能撤销");
    await store.move([item.id], leaf.id);
    await store.trash([item.id]);
    const used = store.usedBytes;
    await store.removeGroup(top.id);
    expect(await store.item(item.id)).toMatchObject({ groupId: null, deletedAt: expect.any(String) });
    expect(store.usedBytes).toBe(used);
    await store.trash([item.id], true);
    expect((await store.list({})).total).toBe(1);
  });
  it("并发去重、空间预留和容量不足不会留下半成品；数据库写入失败回滚", async () => {
    const [a, b] = await Promise.all([add(), add()]);
    expect(a.id).toBe(b.id);
    expect((await store.snapshot()).items).toHaveLength(1);
    store.reserve("a", 1024 * 1024 - a.bytes);
    expect(() => store.reserve("b", 1)).toThrow("空间不足");
    store.release("a");
    const before = await store.snapshot();
    vi.spyOn(database, "upsert").mockImplementationOnce(() => {
      throw new Error("模拟 SQLite 写入失败");
    });
    const response = await app.inject({ method: "POST", url: `${prefix}/uploads`, ...upload(wav(0.2)) });
    expect(response.statusCode).toBe(500);
    expect(await store.snapshot()).toEqual(before);
    expect(await fs.readdir(path.join(store.root, "items"))).toEqual([a.id]);
    expect(store.reservedBytes).toBe(0);
    expect(await fs.readdir(path.join(store.root, "staging"))).toEqual([]);
  });
  it("共享数据库被清除后从永久清单重建；重启回滚未完成提交，缺文件保留文字", async () => {
    const group = await store.group({ name: "促销", parentId: null }),
      item = await add({ groupId: group.id, chineseText: "欢迎光临" });
    await store.edit(item.id, { note: "长期保存" });
    await store.trash([item.id]);
    const snapshot = await store.snapshot();
    database.connection.exec(
      "DELETE FROM entities WHERE kind LIKE 'audio-library-%'; DELETE FROM files WHERE entity_kind='audio-library-item'"
    );
    const recovered = new AudioLibraryStore(root, database, 1024 * 1024);
    await recovered.initialize();
    expect(await recovered.snapshot()).toEqual(snapshot);
    expect(database.list("audio-library-item")).toHaveLength(1);
    expect(database.listFiles({ entityKind: "audio-library-item" })).toHaveLength(1);
    await fs.writeFile(path.join(store.root, "transaction.json"), JSON.stringify(snapshot));
    await fs.writeFile(path.join(store.root, "library.json"), JSON.stringify({ ...snapshot, items: [] }));
    const rollback = new AudioLibraryStore(root, database, 1024 * 1024);
    await rollback.initialize();
    expect(await rollback.snapshot()).toEqual(snapshot);
    await fs.rm(store.file(item));
    expect(await rollback.view(await rollback.item(item.id))).toMatchObject({
      available: false,
      chineseText: "欢迎光临",
      note: "长期保存",
      deletedAt: expect.any(String)
    });
  });
  it("播放支持 Range、HEAD 与损坏提示，不提供单条下载；彻底删除清理文件和索引", async () => {
    const item = await add();
    const response = await app.inject({ url: `${prefix}/items/${item.id}/audio`, headers: { range: "bytes=0-9" } });
    expect(response.statusCode).toBe(206);
    expect(response.rawPayload).toEqual(wav().subarray(0, 10));
    expect(response.headers["content-range"]).toBe(`bytes 0-9/${item.bytes}`);
    expect((await app.inject({ url: `${prefix}/items/${item.id}/download` })).statusCode).toBe(404);
    expect(response.headers["content-disposition"]).toBeUndefined();
    expect(item).not.toHaveProperty("downloadUrl");
    const head = await app.inject({ method: "HEAD", url: `${prefix}/items/${item.id}/audio` });
    expect(head.statusCode).toBe(200);
    expect(head.rawPayload.length).toBe(0);
    expect(head.headers["content-length"]).toBe(String(item.bytes));
    expect(
      (await app.inject({ url: `${prefix}/items/${item.id}/audio`, headers: { range: "bytes=99999-" } })).statusCode
    ).toBe(416);
    await store.trash([item.id]);
    expect((await app.inject({ url: `${prefix}/items/${item.id}/audio` })).statusCode).toBe(404);
    await store.purge(item.id);
    expect((await store.snapshot()).items).toEqual([]);
    expect(database.listFiles({ entityKind: "audio-library-item" })).toEqual([]);
    await expect(fs.stat(store.file(item))).rejects.toMatchObject({ code: "ENOENT" });
    expect(store.usedBytes).toBe(0);
  });
  it("克隆音频与保存文案独立入库、旧版本拒绝，新版本另存，删除原批次不影响", async () => {
    const batch = await batches.create(
      "batch_demo",
      {
        name: "测试",
        language: "ms",
        device: "cpu",
        referenceFileName: "ref.wav",
        referenceDurationSeconds: 5,
        referenceRetained: false,
        authorization: "self",
        consentConfirmed: true,
        exaggeration: 0.5,
        cfgWeight: 0.5,
        temperature: 0.8,
        seed: 0,
        includeSubtitles: true,
        subtitleMode: "sentences",
        segments: [{ text: "Selamat datang", referenceTranslation: "欢迎光临", fileName: "欢迎" }]
      },
      3
    );
    const segment = batch.items[0],
      source = batches.itemPaths(batch.id, segment.id).audio;
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, wav());
    await batches.updateItem(batch.id, segment.id, { status: "completed", progress: 100 });
    const request = () =>
      app.inject({
        method: "POST",
        url: `${prefix}/imports/chatterbox`,
        payload: { batchId: batch.id, itemIds: [segment.id], attempts: { [segment.id]: 1 } }
      });
    const result = (await request()).json().data;
    expect(Value.Check(AudioLibraryImportResultSchema, result)).toBe(true);
    expect(result.results[0]).toMatchObject({
      status: "added",
      item: { groupId: null, foreignText: "Selamat datang", chineseText: "欢迎光临", source: { attempt: 1 } }
    });
    expect((await request()).json().data.results[0].status).toBe("existing");
    await batches.updateItem(batch.id, segment.id, { attempt: 2, text: "Hai", referenceTranslation: "你好" });
    expect((await request()).json().data.results[0].status).toBe("failed");
    const second = await app.inject({
      method: "POST",
      url: `${prefix}/imports/chatterbox`,
      payload: { batchId: batch.id, itemIds: [segment.id], attempts: { [segment.id]: 2 } }
    });
    expect(second.json().data.results[0].status).toBe("added");
    await batches.remove(batch.id);
    const view = await store.view(await store.item(result.results[0].item.id));
    expect(view).toMatchObject({ available: true, foreignText: "Selamat datang", chineseText: "欢迎光临" });
  });
  it("完整 ZIP 包含音频、文案、分组和回收站，恢复至空库及重复恢复均正确", async () => {
    const group = await store.group({ name: "促销", parentId: null }),
      item = await add({ groupId: group.id, chineseText: "中文", foreignText: "Text" });
    const clipped = await app.inject({
      method: "POST",
      url: `${prefix}/items/${item.id}/clips`,
      ...upload(wav(0.05), {
        startSeconds: "0",
        endSeconds: "0.05",
        revision: String((await store.item(item.id)).revision)
      })
    });
    expect(clipped.statusCode, clipped.body).toBe(200);
    const clippedId = clipped.json().data.item.id;
    await store.savePreset({ name: "完整备份中的预设", itemIds: [item.id, item.id], mode: "list", gap: 2 });
    await store.trash([item.id]);
    const backup = await app.inject({ url: `${prefix}/backup` });
    expect(backup.statusCode).toBe(200);
    const entries = readArchiveZip(backup.rawPayload);
    expect(entries.get(`items/${item.id}/audio.wav`)).toEqual(wav());
    expect(entries.get(`texts/${item.id}.txt`)?.toString()).toContain("中文");
    const manifest = JSON.parse(entries.get("manifest.json")!.toString());
    expect(manifest.items[0]).not.toHaveProperty("favorite");
    expect(manifest).not.toHaveProperty("tags");
    expect(manifest.items[0]).not.toHaveProperty("tags");
    // 用带旧标记的历史清单模拟已有备份，恢复时仅丢弃退役字段，不丢弃素材。
    manifest.items[0].favorite = true;
    manifest.tags = ["旧标签"];
    manifest.items[0].tags = ["旧标签"];
    entries.set("manifest.json", Buffer.from(JSON.stringify(manifest)));
    const legacyArchive = new ZipArchive(),
      legacyChunks: Buffer[] = [];
    legacyArchive.on("data", (chunk) => legacyChunks.push(chunk));
    const legacyDone = new Promise<void>((resolve, reject) => {
      legacyArchive.once("end", resolve);
      legacyArchive.once("error", reject);
    });
    for (const [name, bytes] of entries) legacyArchive.append(bytes, { name });
    await legacyArchive.finalize();
    await legacyDone;
    const legacyBackup = Buffer.concat(legacyChunks);
    // 用同一备份恢复到另一份独立根目录，不删除源库以模拟迁移。
    const otherRoot = path.join(root, "other"),
      otherDb = new ToolboxDatabase(":memory:"),
      otherApp = Fastify();
    await otherApp.register(multipart);
    const other = await registerAudioLibraryRoutes(
      otherApp,
      { ...getConfig(), storageRoot: otherRoot, audioLibraryMaxStorageBytes: 1024 * 1024 },
      otherDb,
      batches
    );
    try {
      const restore = () =>
        otherApp.inject({
          method: "POST",
          url: `${prefix}/backup/restore`,
          ...upload(legacyBackup, {}, "backup.zip")
        });
      const first = await restore();
      expect(first.statusCode, first.body).toBe(200);
      expect(first.json().data).toEqual({ added: 2, skipped: 0 });
      expect((await restore()).json().data).toEqual({ added: 0, skipped: 2 });
      expect(await other.item(clippedId)).toMatchObject({
        duration: 0.05,
        source: { kind: "clip", originalItemId: item.id }
      });
      expect((await other.snapshot()).items[0]).toMatchObject({
        deletedAt: expect.any(String),
        chineseText: "中文"
      });
      expect((await other.snapshot()).items[0]).not.toHaveProperty("favorite");
      expect(await other.snapshot()).not.toHaveProperty("tags");
      expect((await other.snapshot()).items[0]).not.toHaveProperty("tags");
      const reexport = await otherApp.inject({ url: `${prefix}/backup` });
      const newManifest = JSON.parse(readArchiveZip(reexport.rawPayload).get("manifest.json")!.toString());
      expect(newManifest).not.toHaveProperty("tags");
      expect(newManifest.items.every((entry: object) => !Object.hasOwn(entry, "tags"))).toBe(true);
      expect((await other.snapshot()).groups).toHaveLength(1);
      expect((await other.presets())[0]).toMatchObject({
        name: "完整备份中的预设",
        itemIds: [item.id, item.id],
        mode: "list",
        gap: 2
      });
      expect(await other.presets()).toHaveLength(1);
      expect(await other.view((await other.snapshot()).items[0])).toMatchObject({ available: true });
    } finally {
      await otherApp.close();
      otherDb.close();
    }
  });
  it("拒绝清单路径注入和摘要不符的备份，不修改原库", async () => {
    const item = await add();
    const before = await store.snapshot();
    const archive = new ZipArchive(),
      chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<void>((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
    });
    const bad = structuredClone(before);
    bad.items[0].id = "../outside";
    archive.append(JSON.stringify(bad), { name: "manifest.json" });
    archive.append(wav(), { name: `items/${item.id}/audio.wav` });
    await archive.finalize();
    await done;
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/backup/restore`,
      ...upload(Buffer.concat(chunks), {}, "backup.zip")
    });
    expect(response.statusCode).toBe(400);
    expect(await store.snapshot()).toEqual(before);
  });
  it("恢复 ID 冲突时另建素材，并复用完整分组路径；坏摘要整体回滚", async () => {
    const group = await store.group({ name: "开场", parentId: null });
    const old = await add({ groupId: group.id });
    const backup = await store.snapshot();
    const directory = await store.staging();
    const file = path.join(directory, "items", old.id, "audio.wav");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, wav(0.2));
    const actual = await inspectAudio(file);
    Object.assign(backup.items[0], actual, { title: "新音频" });
    const result = await store.restore(backup, directory, "restore");
    expect(result).toEqual({ added: 1, skipped: 0 });
    const restored = await store.snapshot();
    expect(restored.groups).toHaveLength(1);
    expect(restored.items.map((x) => x.groupId)).toEqual([group.id, group.id]);
    expect(restored.items[1].id).not.toBe(old.id);
    expect(await store.view(restored.items[1])).toMatchObject({ available: true, title: "新音频" });
    const archive = new ZipArchive(),
      chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<void>((resolve) => archive.on("end", resolve));
    archive.append(JSON.stringify(restored), { name: "manifest.json" });
    for (const item of restored.items) archive.append(wav(), { name: `items/${item.id}/${item.fileName}` });
    await archive.finalize();
    await done;
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/backup/restore`,
      ...upload(Buffer.concat(chunks), {}, "bad.zip")
    });
    expect(response.statusCode).toBe(400);
    expect(await store.snapshot()).toEqual(restored);
  });
  it("超配额上传明确拒绝、撤销过期和导出锁不会误删素材", async () => {
    const response = await app.inject({ method: "POST", url: `${prefix}/uploads`, ...upload(wav(70)) });
    expect(response.statusCode).toBe(413);
    expect((await store.snapshot()).items).toEqual([]);
    expect(store.reservedBytes).toBe(0);
    expect(await fs.readdir(path.join(store.root, "staging"))).toEqual([]);
    const item = await add(),
      token = await store.move([item.id], null);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16000);
    await expect(store.undo(token)).rejects.toThrow("过期");
    vi.restoreAllMocks();
    await store.trash([item.id]);
    const release = store.pin([item.id]);
    await expect(store.purge(item.id)).rejects.toThrow("正在导出");
    release();
    release();
    await store.purge(item.id);
    expect(store.usedBytes).toBe(0);
  });
  it("源媒体锁异常不会阻断下一次操作；读取阶段与删除互斥", async () => {
    let unlock!: () => void;
    const held = batches.withArtifact(
      "lock_demo",
      () =>
        new Promise<void>((resolve) => {
          unlock = resolve;
        })
    );
    await Promise.resolve();
    const calls: string[] = [];
    const pending = batches.withArtifact("lock_demo", async () => {
      calls.push("read");
      throw new Error("bad");
    });
    const after = batches.withArtifact("lock_demo", async () => calls.push("delete"));
    expect(calls).toEqual([]);
    await new Promise((resolve) => setImmediate(resolve));
    unlock();
    await held;
    await expect(pending).rejects.toThrow("bad");
    await after;
    expect(calls).toEqual(["read", "delete"]);
  });
});
