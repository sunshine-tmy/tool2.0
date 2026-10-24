import { Value } from "@sinclair/typebox/value";
import { AudioLibraryCatalogSchema, type AudioLibraryCatalog } from "@toolbox/shared";
import { reject } from "./errors";

export const normalizeAudioLibraryText = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
const validCatalog = (value: unknown): value is AudioLibraryCatalog => Value.Check(AudioLibraryCatalogSchema, value);
/** 仅读取旧清单/备份时移除退役字段，其他未知字段仍交由严格 Schema 拒绝。 */
export function readCatalog(value: unknown): AudioLibraryCatalog | undefined {
  if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) return undefined;
  const candidate = structuredClone(value) as { items: unknown[]; tags?: unknown };
  const legacyTags = (tags: unknown): tags is string[] =>
    Array.isArray(tags) && tags.every((tag) => typeof tag === "string" && tag.length >= 1 && tag.length <= 30);
  if (Object.hasOwn(candidate, "tags")) {
    if (!legacyTags(candidate.tags)) return undefined;
    delete candidate.tags;
  }
  for (const item of candidate.items) {
    if (item && typeof item === "object" && Object.hasOwn(item, "tags")) {
      const legacy = item as { tags?: unknown };
      if (!legacyTags(legacy.tags) || legacy.tags.length > 20 || new Set(legacy.tags).size !== legacy.tags.length)
        return undefined;
      delete legacy.tags;
    }
    if (item && typeof item === "object" && Object.hasOwn(item, "favorite")) {
      if (typeof (item as { favorite: unknown }).favorite !== "boolean") return undefined;
      delete (item as { favorite?: boolean }).favorite;
    }
  }
  return validCatalog(candidate) ? candidate : undefined;
}

export function validateAudioLibraryCatalog(c: AudioLibraryCatalog) {
  if (!validCatalog(c)) reject("AUDIO_LIBRARY_INVALID", "音频库数据不符合约定");
  if (
    new Set(c.items.map((x) => x.id)).size !== c.items.length ||
    new Set(c.groups.map((x) => x.id)).size !== c.groups.length
  )
    reject("AUDIO_LIBRARY_INVALID", "音频库标识重复");
  const presets = c.presets ?? [];
  if (
    new Set(presets.map((x) => x.id)).size !== presets.length ||
    new Set(presets.map((x) => normalizeAudioLibraryText(x.name))).size !== presets.length ||
    presets.some((x) => !normalizeAudioLibraryText(x.name))
  )
    reject("AUDIO_LIBRARY_PRESET_DUPLICATE", "预设队列名称不能为空或重复", 409);
  for (const item of c.items)
    if (item.groupId && !c.groups.some((g) => g.id === item.groupId))
      reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "目标分组不存在", 404);
  const siblingNames = new Set<string>();
  for (const g of c.groups) {
    const key = `${g.parentId ?? ""}:${normalizeAudioLibraryText(g.name)}`;
    if (siblingNames.has(key)) reject("AUDIO_LIBRARY_GROUP_DUPLICATE", "同级分组名称不可重复", 409);
    siblingNames.add(key);
    const seen = new Set([g.id]);
    let parent = g.parentId;
    while (parent) {
      if (seen.has(parent) || seen.size >= 3) reject("AUDIO_LIBRARY_GROUP_DEPTH", "分组最多三级，不能循环嵌套");
      seen.add(parent);
      const node = c.groups.find((x) => x.id === parent);
      if (!node) reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "父分组不存在", 404);
      parent = node.parentId;
    }
  }
}
