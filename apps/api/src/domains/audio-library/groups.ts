import type { AudioLibraryCatalog, AudioLibraryGroup } from "@toolbox/shared";
import { nanoid } from "nanoid";
import { reject } from "./errors";

export type AudioLibraryGroupInput = { id?: string; name: string; parentId: string | null };
export type AudioLibraryMoveItem = { id: string; groupId: string | null; revision: number };

// Mutate only the supplied draft; the store owns serialization, validation, persistence and undo lifetimes.
export function upsertAudioLibraryGroup(c: AudioLibraryCatalog, input: AudioLibraryGroupInput) {
  const group: AudioLibraryGroup = { id: input.id ?? nanoid(), name: input.name.trim(), parentId: input.parentId };
  const existing = c.groups.findIndex((x) => x.id === group.id);
  if (input.id && existing < 0) reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "分组不存在", 404);
  if (existing < 0) c.groups.push(group);
  else c.groups[existing] = group;
  return group;
}

export function removeAudioLibraryGroup(c: AudioLibraryCatalog, id: string) {
  const ids = new Set([id]);
  for (let i = 0; i < 3; i++) for (const g of c.groups) if (g.parentId && ids.has(g.parentId)) ids.add(g.id);
  c.groups = c.groups.filter((g) => !ids.has(g.id));
  for (const item of c.items)
    if (item.groupId && ids.has(item.groupId)) {
      item.groupId = null;
      item.revision++;
      item.updatedAt = new Date().toISOString();
    }
}

export function moveAudioLibraryItems(c: AudioLibraryCatalog, ids: string[], groupId: string | null) {
  if (groupId && !c.groups.some((g) => g.id === groupId))
    reject("AUDIO_LIBRARY_GROUP_NOT_FOUND", "目标分组不存在", 404);
  const previous = ids.map((id) => {
    const item = c.items.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_NOT_FOUND", "部分素材已不存在，请刷新", 404);
    const old = { id, groupId: item.groupId, revision: item.revision + 1 };
    item.groupId = groupId;
    item.revision++;
    item.updatedAt = new Date().toISOString();
    return old;
  });
  return previous;
}

export function undoAudioLibraryMove(c: AudioLibraryCatalog, previous: AudioLibraryMoveItem[]) {
  for (const old of previous) {
    const item = c.items.find((x) => x.id === old.id);
    if (!item || item.revision !== old.revision || (old.groupId && !c.groups.some((g) => g.id === old.groupId)))
      reject("AUDIO_LIBRARY_CONFLICT", "素材或原分组已改变，不能撤销", 409);
    item.groupId = old.groupId;
    item.revision++;
    item.updatedAt = new Date().toISOString();
  }
}
