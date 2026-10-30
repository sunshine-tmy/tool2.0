/** 全应用共享的关键帧方案；只存比例坐标，不持有任何归档文件或素材引用。 */
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveWatermarkPresetSchema,
  ArchiveWatermarkPresetInputSchema,
  type ArchiveWatermarkPreset,
  type ArchiveWatermarkPresetInput
} from "@toolbox/shared";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import { VideoEditError } from "./renderer";
const kind = "archive-watermark-preset";
export class ArchiveWatermarkPresets {
  constructor(private database: ToolboxDatabase) {}
  list(): ArchiveWatermarkPreset[] {
    return this.database.list(kind).map((entity) => {
      const preset = entity.payload;
      if (
        !Value.Check(ArchiveWatermarkPresetSchema, preset) ||
        preset.id !== entity.id ||
        preset.points.some((point, index) => index > 0 && point.progress <= preset.points[index - 1].progress)
      )
        throw new VideoEditError("ARCHIVE_WATERMARK_PRESET_CORRUPT", "水印轨迹预设记录损坏，请检查诊断信息", 500);
      return structuredClone(preset);
    });
  }
  save(input: ArchiveWatermarkPresetInput) {
    if (
      !Value.Check(ArchiveWatermarkPresetInputSchema, input) ||
      !input.name.trim() ||
      input.points.some((point, index) => index > 0 && point.progress <= input.points[index - 1].progress)
    )
      throw new VideoEditError("ARCHIVE_WATERMARK_PRESET_INVALID", "请输入预设名称，并提供 2～20 个时间递增的关键帧");
    return this.database.transaction(() => {
      const presets = this.list();
      if (presets.length >= 200)
        throw new VideoEditError("ARCHIVE_WATERMARK_PRESET_LIMIT", "最多保存 200 个水印轨迹预设，请先整理旧预设", 409);
      const name = input.name.trim();
      if (presets.some((preset) => preset.name.toLowerCase() === name.toLowerCase()))
        throw new VideoEditError("ARCHIVE_WATERMARK_PRESET_DUPLICATE", "已有同名轨迹预设，请使用其他名称", 409);
      const now = new Date().toISOString();
      const preset: ArchiveWatermarkPreset = {
        id: nanoid(12),
        name,
        points: structuredClone(input.points),
        revision: 1,
        createdAt: now,
        updatedAt: now
      };
      this.database.upsert({ id: preset.id, kind, status: "ready", payload: preset, createdAt: now, updatedAt: now });
      return structuredClone(preset);
    });
  }
  remove(id: string, revision: number) {
    return this.database.transaction(() => {
      const preset = this.database.get(kind, id)?.payload;
      if (!preset) throw new VideoEditError("ARCHIVE_WATERMARK_PRESET_NOT_FOUND", "轨迹预设不存在，请刷新列表", 404);
      if (!Value.Check(ArchiveWatermarkPresetSchema, preset) || preset.revision !== revision)
        throw new VideoEditError("ARCHIVE_WATERMARK_PRESET_CONFLICT", "轨迹预设已变化，请刷新后重试", 409);
      this.database.remove(kind, id);
      return { id };
    });
  }
}
