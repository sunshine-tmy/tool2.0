/** Group metadata lives separately from permanent archive manifests and media. */
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import { ArchiveGroupSchema, type ArchiveGroup, type ArchiveGroupAssignment } from "@toolbox/shared/archive";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import { ArchiveTaskError } from "./provider";

const groupKind = "archive-group";
const memberKind = "archive-group-member";
export class ArchiveGroupStore {
  constructor(private readonly database: ToolboxDatabase) {}

  list(): ArchiveGroup[] {
    return this.database
      .list(groupKind)
      .map((entity) => {
        if (!Value.Check(ArchiveGroupSchema, entity.payload) || entity.payload.id !== entity.id)
          throw new Error("ARCHIVE_GROUP_RECORD_INVALID");
        return structuredClone(entity.payload);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id));
  }
  assertExists(id: string) {
    if (!this.database.get(groupKind, id))
      throw new ArchiveTaskError("ARCHIVE_GROUP_NOT_FOUND", "分组不存在，请刷新后重选", 404);
  }
  save(name: string, id?: string) {
    const normalized = name.trim();
    if (
      !normalized ||
      normalized.length > 80 ||
      Array.from(normalized).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    )
      throw new ArchiveTaskError("ARCHIVE_GROUP_NAME_INVALID", "分组名称须为 1～80 个字符，不能包含控制字符", 400);
    return this.database.transaction(() => {
      const groups = this.list();
      const current = id ? groups.find((entry) => entry.id === id) : undefined;
      if (id && !current) this.assertExists(id);
      if (groups.some((entry) => entry.id !== id && entry.name.toLowerCase() === normalized.toLowerCase()))
        throw new ArchiveTaskError("ARCHIVE_GROUP_NAME_EXISTS", "已有同名分组", 409);
      if (!id && groups.length >= 200)
        throw new ArchiveTaskError("ARCHIVE_GROUP_LIMIT", "最多保留 200 个分组，请先整理现有分组", 409);
      const now = new Date().toISOString();
      const group: ArchiveGroup = {
        id: id ?? nanoid(12),
        name: normalized,
        createdAt: current?.createdAt ?? now,
        updatedAt: now
      };
      this.database.upsert({
        id: group.id,
        kind: groupKind,
        status: "ready",
        payload: group,
        createdAt: group.createdAt,
        updatedAt: now
      });
      return group;
    });
  }
  memberships() {
    const groups = new Set(this.list().map((group) => group.id));
    return new Map(
      this.database
        .list(memberKind)
        .flatMap((entry) => (entry.status && groups.has(entry.status) ? [[entry.id, entry.status] as const] : []))
    );
  }
  assign(input: ArchiveGroupAssignment) {
    return this.database.transaction(() => {
      if (input.groupId) this.assertExists(input.groupId);
      if (input.itemIds.some((id) => !this.database.get("xhs-archive", id)))
        throw new ArchiveTaskError("ARCHIVE_NOT_FOUND", "部分所选作品已删除，请刷新后重新选择", 404);
      const now = new Date().toISOString();
      for (const id of input.itemIds) {
        if (!input.groupId) this.database.remove(memberKind, id);
        else
          this.database.upsert({
            id,
            kind: memberKind,
            status: input.groupId,
            payload: { groupId: input.groupId },
            createdAt: this.database.get(memberKind, id)?.createdAt ?? now,
            updatedAt: now
          });
      }
      return { updated: input.itemIds.length };
    });
  }
  /** A deleted target or archive must never be recreated by a late import result. */
  assignImported(groupId: string, itemIds: string[]) {
    if (!this.database.get(groupKind, groupId)) return;
    const existing = itemIds.filter((id) => this.database.get("xhs-archive", id));
    if (existing.length) this.assign({ groupId, itemIds: existing });
  }
  remove(id: string) {
    return this.database.transaction(() => {
      this.assertExists(id);
      for (const entry of this.database.list(memberKind)) {
        if (entry.status === id) this.database.remove(memberKind, entry.id);
      }
      this.database.remove(groupKind, id);
    });
  }
}
