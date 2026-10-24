import type {
  AudioLibraryCatalog,
  AudioLibraryItem,
  AudioLibraryItemView,
  AudioLibraryPresetInput
} from "@toolbox/shared";
import { nanoid } from "nanoid";
import { reject } from "./errors";

type ItemView = (item: AudioLibraryItem) => Promise<AudioLibraryItemView>;

// The store supplies its serialized draft or snapshot and retains persistence ownership.
export async function saveAudioLibraryPreset(
  c: AudioLibraryCatalog,
  input: AudioLibraryPresetInput,
  id: string | undefined,
  viewItem: ItemView
) {
  c.presets ??= [];
  const existing = id ? c.presets.find((x) => x.id === id) : undefined;
  if (id && !existing) reject("AUDIO_LIBRARY_PRESET_NOT_FOUND", "预设队列不存在", 404);
  if (existing && input.revision !== existing.revision)
    reject("AUDIO_LIBRARY_CONFLICT", "预设已被修改，请刷新后重试", 409);
  if (!existing && c.presets.length >= 200) reject("AUDIO_LIBRARY_PRESET_LIMIT", "最多保存 200 个预设队列");
  if (!existing || JSON.stringify(input.itemIds) !== JSON.stringify(existing.itemIds)) {
    for (const itemId of new Set(input.itemIds)) {
      const item = c.items.find((x) => x.id === itemId && !x.deletedAt);
      if (!item || !(await viewItem(item)).available)
        reject("AUDIO_LIBRARY_PRESET_ITEM_UNAVAILABLE", "队列中有已删除或不可用的音频，请整理后再保存", 409);
    }
  }
  const now = new Date().toISOString();
  const preset = {
    id: id ?? nanoid(),
    name: input.name.trim(),
    itemIds: [...input.itemIds],
    mode: input.mode,
    gap: input.gap,
    revision: (existing?.revision ?? 0) + 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  if (existing) c.presets[c.presets.indexOf(existing)] = preset;
  else c.presets.push(preset);
  return structuredClone(preset);
}

export function deleteAudioLibraryPreset(c: AudioLibraryCatalog, id: string, revision: number) {
  const preset = c.presets?.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_PRESET_NOT_FOUND", "预设队列不存在", 404);
  if (preset.revision !== revision) reject("AUDIO_LIBRARY_CONFLICT", "预设已被修改，请刷新后重试", 409);
  c.presets = c.presets!.filter((x) => x.id !== id);
}

export async function loadAudioLibraryPreset(c: AudioLibraryCatalog, id: string, viewItem: ItemView) {
  const preset = c.presets?.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_PRESET_NOT_FOUND", "预设队列不存在", 404);
  const available = new Map<string, AudioLibraryItemView>();
  for (const itemId of new Set(preset.itemIds)) {
    const item = c.items.find((x) => x.id === itemId && !x.deletedAt);
    if (item) {
      const view = await viewItem(item);
      if (view.available) available.set(itemId, view);
    }
  }
  const items = preset.itemIds.flatMap((itemId) => available.get(itemId) ?? []);
  return { preset, items, unavailableCount: preset.itemIds.length - items.length };
}
