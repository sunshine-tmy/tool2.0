import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ArchiveWatermarkPresetInput } from "@toolbox/shared";
import { ToolboxDatabase } from "../database/toolbox-database";
import { ArchiveWatermarkPresets } from "../domains/content-archive/video-edit/watermark-presets";
let root: string, database: ToolboxDatabase, presets: ArchiveWatermarkPresets;
const input = (): ArchiveWatermarkPresetInput => ({
  name: "品牌 Z 型",
  points: [
    { progress: 0, x: 0, y: 0 },
    { progress: 0.5, x: 1, y: 0 },
    { progress: 1, x: 0, y: 1 }
  ]
});
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-watermark-presets-"));
  database = new ToolboxDatabase(path.join(root, "presets.db"));
  presets = new ArchiveWatermarkPresets(database);
});
afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-watermark-presets-"))
    throw new Error("测试清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
describe("水印轨迹预设持久化", () => {
  it("数据库重新打开后保留所有路点，读取和保存均提供独立快照", () => {
    const body = input(),
      saved = presets.save(body);
    body.points[0].x = 1;
    expect(presets.list()[0].points[0].x).toBe(0);
    database.close();
    database = new ToolboxDatabase(path.join(root, "presets.db"));
    presets = new ArchiveWatermarkPresets(database);
    expect(presets.list()).toEqual([saved]);
    const listed = presets.list();
    listed[0].points[1].x = 0;
    expect(presets.list()[0].points[1].x).toBe(1);
  });
  it("拒绝空名、重复名、越界点、重复时间和额外字段，不产生半条记录", () => {
    for (const bad of [
      { ...input(), name: "  " },
      {
        ...input(),
        points: [
          { progress: 0, x: 0, y: 0 },
          { progress: 0, x: 1, y: 1 }
        ]
      },
      {
        ...input(),
        points: [
          { progress: 0, x: 0, y: 0 },
          { progress: 1.1, x: 1, y: 1 }
        ]
      },
      { ...input(), fileName: "C:/secret" }
    ])
      expect(() => presets.save(bad)).toThrow();
    expect(presets.list()).toEqual([]);
    presets.save({ ...input(), name: "  Sample  " });
    expect(() => presets.save({ ...input(), name: "sample" })).toThrow("同名");
  });
  it("写入或删除失败不会报告成功，错误版本不会删除已有方案", () => {
    const saved = presets.save(input());
    expect(() => presets.remove(saved.id, 2)).toThrow("已变化");
    vi.spyOn(database, "upsert").mockImplementationOnce(() => {
      throw new Error("disk write failed");
    });
    expect(() => presets.save({ ...input(), name: "新方案" })).toThrow("disk write failed");
    expect(presets.list()).toEqual([saved]);
    vi.spyOn(database, "remove").mockImplementationOnce(() => {
      throw new Error("delete failed");
    });
    expect(() => presets.remove(saved.id, 1)).toThrow("delete failed");
    expect(presets.list()).toEqual([saved]);
    presets.remove(saved.id, 1);
    expect(presets.list()).toEqual([]);
    expect(() => presets.remove(saved.id, 1)).toThrow("不存在");
  });
});
