import path from "node:path";
import { nanoid } from "nanoid";
import type { AudioLibraryCatalog } from "@toolbox/shared";
import { normalizeAudioLibraryText as normalized } from "./catalog";

// Synchronous draft merge only; the store validates, reads live quota, serializes and commits the file additions.
export function mergeAudioLibraryBackup(
  c: AudioLibraryCatalog,
  backup: AudioLibraryCatalog,
  directory: string,
  additions: Array<{ id: string; directory: string }>,
  assertCapacity: (bytes: number) => void
) {
  const groupMap = new Map<string, string>();
  const adopt = (id: string): string => {
    if (groupMap.has(id)) return groupMap.get(id)!;
    const group = backup.groups.find((x) => x.id === id)!;
    const parentId = group.parentId ? adopt(group.parentId) : null;
    let target = c.groups.find((x) => x.parentId === parentId && normalized(x.name) === normalized(group.name));
    if (!target) {
      target = { id: nanoid(), name: group.name, parentId };
      c.groups.push(target);
    }
    groupMap.set(id, target.id);
    return target.id;
  };
  for (const group of backup.groups) adopt(group.id);
  const itemMap = new Map<string, string>();
  let added = 0,
    skipped = 0,
    bytes = 0;
  for (const source of backup.items) {
    if (c.items.some((x) => x.id === source.id && x.sha256 === source.sha256)) {
      itemMap.set(source.id, source.id);
      skipped++;
      continue;
    }
    const item = structuredClone(source);
    if (c.items.some((x) => x.id === item.id)) item.id = nanoid();
    itemMap.set(source.id, item.id);
    item.groupId = source.groupId ? groupMap.get(source.groupId)! : null;
    c.items.push(item);
    bytes += item.bytes;
    added++;
    additions.push({ id: item.id, directory: path.join(directory, "items", source.id) });
  }
  for (const addition of additions) {
    const item = c.items.find((x) => x.id === addition.id)!;
    const originalId = item.source.originalItemId;
    if (item.source.kind !== "clip" || !originalId) continue;
    // 迁移时原素材可能因 ID 冲突而重命名；不把孤立来源错误关联到目标库的同名素材。
    if (!itemMap.has(originalId))
      itemMap.set(originalId, c.items.some((x) => x.id === originalId) ? nanoid() : originalId);
    item.source.originalItemId = itemMap.get(originalId);
  }
  assertCapacity(bytes);
  c.presets ??= [];
  for (const source of backup.presets ?? []) {
    const preset = structuredClone(source);
    preset.itemIds = source.itemIds.map((id) => {
      if (!itemMap.has(id)) itemMap.set(id, c.items.some((x) => x.id === id) ? nanoid() : id);
      return itemMap.get(id)!;
    });
    const existing = c.presets.find((x) => x.id === preset.id);
    if (
      existing &&
      existing.name === preset.name &&
      existing.mode === preset.mode &&
      existing.gap === preset.gap &&
      JSON.stringify(existing.itemIds) === JSON.stringify(preset.itemIds)
    )
      continue;
    if (existing) preset.id = nanoid();
    let suffix = 1;
    while (c.presets.some((x) => normalized(x.name) === normalized(preset.name)))
      preset.name = `${source.name.slice(0, 65)}（导入${++suffix}）`;
    c.presets.push(preset);
  }
  return { added, skipped };
}
