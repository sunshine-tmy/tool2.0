import type { HTMLAttributes } from "vue";
import type { CascaderOption } from "naive-ui";
import type { ArchiveGroup } from "@toolbox/shared/archive";

export type ArchiveGroupOption = { label: string; value: string; disabled?: boolean; children?: ArchiveGroupOption[] };

export function archiveGroupTree(groups: ArchiveGroup[], parentId: string | null = null): ArchiveGroupOption[] {
  return groups.filter((group) => (group.parentId ?? null) === parentId).map((group) => {
    const children = archiveGroupTree(groups, group.id);
    return { label: group.name, value: group.id, ...(children.length ? { children } : {}) };
  });
}

export const groupMenuProps: HTMLAttributes = {
  style: { position: "relative", zIndex: 3000, maxWidth: "calc(100vw - 32px)", overflowX: "auto" }
};
export function filterArchiveGroups(pattern: string, _option: CascaderOption, path: CascaderOption[]) {
  return path.map((node) => String(node.label ?? "")).join(" / ").toLocaleLowerCase().includes(pattern.trim().toLocaleLowerCase());
}
