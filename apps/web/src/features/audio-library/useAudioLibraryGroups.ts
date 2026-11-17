import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import { audioLibraryApi as api } from "./api";
import { rememberGroup } from "./preferences";
import type { AudioLibraryCollection } from "./useAudioLibraryCollection";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
export function useAudioLibraryGroups(
  collection: AudioLibraryCollection,
  run: (fn: () => Promise<unknown>) => Promise<void>
) {
  const { groups, groupId, data } = collection;
  const message = useMessage(),
    confirm = useConfirmDialog();
  const moveVisible = ref(false),
    moveTarget = ref<string | null>(null),
    moveIds = ref<string[]>([]),
    recentIds = ref<string[]>(readRecent());
  function readRecent(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem("audio-library-recent-groups") || "[]");
      return Array.isArray(value) ? value.filter((x) => typeof x === "string").slice(0, 5) : [];
    } catch {
      return [];
    }
  }
  const recentOptions = computed(() => recentIds.value.flatMap((id) => groups.value.find((x) => x.value === id) || []));
  function openMove(ids: string[]) {
    moveIds.value = [...ids];
    moveTarget.value = null;
    moveVisible.value = true;
  }
  const undoToken = ref("");
  async function moveItems() {
    await run(async () => {
      const result = await api.move(moveIds.value, moveTarget.value);
      rememberGroup(moveTarget.value);
      if (moveTarget.value) {
        recentIds.value = [moveTarget.value, ...recentIds.value.filter((x) => x !== moveTarget.value)].slice(0, 5);
        try {
          localStorage.setItem("audio-library-recent-groups", JSON.stringify(recentIds.value));
        } catch {
          /* 分类移动仍成功。 */
        }
      }
      moveVisible.value = false;
      undoToken.value = result.undoToken || "";
      message.success("已移动，可在 15 秒内撤销");
    });
  }
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  watch(undoToken, (token) => {
    if (undoTimer) clearTimeout(undoTimer);
    if (token)
      undoTimer = setTimeout(() => {
        undoToken.value = "";
      }, 15000);
  });
  onBeforeUnmount(() => {
    if (undoTimer) clearTimeout(undoTimer);
  });
  async function undoMove() {
    const token = undoToken.value;
    if (!token) return;
    await run(async () => {
      await api.undo(token);
      undoToken.value = "";
      message.success("已撤销移动");
    });
  }
  const groupVisible = ref(false),
    groupDraft = reactive({ id: undefined as string | undefined, name: "", parentId: null as string | null });
  const parentOptions = computed(() => {
    const all = data.value?.groups || [];
    const descendants = new Set<string>();
    function collect(id: string) {
      if (descendants.has(id)) return;
      descendants.add(id);
      all.filter((group) => group.parentId === id).forEach((group) => collect(group.id));
    }
    if (groupDraft.id) collect(groupDraft.id);
    function subtreeDepth(id: string): number {
      const children = all.filter((group) => group.parentId === id);
      return 1 + (children.length ? Math.max(...children.map((child) => subtreeDepth(child.id))) : 0);
    }
    const neededDepth = groupDraft.id ? subtreeDepth(groupDraft.id) : 1;
    return groups.value.filter((option) => {
      if (descendants.has(option.value)) return false;
      let depth = 0;
      let current = all.find((group) => group.id === option.value);
      while (current && depth < 3) {
        depth++;
        current = all.find((group) => group.id === current?.parentId);
      }
      return depth + neededDepth <= 3;
    });
  });
  function newGroup(parentId: string | null = null) {
    Object.assign(groupDraft, { id: undefined, name: "", parentId: null });
    if (parentId && !parentOptions.value.some((option) => option.value === parentId)) {
      message.warning("分组最多支持三级，无法在此分组下新建子分组");
      return;
    }
    groupDraft.parentId = parentId;
    groupVisible.value = true;
  }
  function editGroup(id = groupId.value) {
    const group = data.value?.groups.find((x) => x.id === id);
    if (group) {
      Object.assign(groupDraft, group);
      groupVisible.value = true;
    }
  }
  async function saveGroup() {
    if (!groupDraft.name.trim()) {
      message.warning("请输入分组名称");
      return;
    }
    if (groupDraft.parentId && !parentOptions.value.some((option) => option.value === groupDraft.parentId)) {
      message.warning("请选择有效的上级分组");
      return;
    }
    await run(async () => {
      await api.group(groupDraft.name.trim(), groupDraft.parentId, groupDraft.id);
      groupVisible.value = false;
    });
  }
  async function deleteGroup(id = groupId.value) {
    if (!id) return;
    const name = data.value?.groups.find((group) => group.id === id)?.name || "该分组";
    try {
      const [active, trash] = await Promise.all([
        api.list({ groupId: id, pageSize: 1 }),
        api.list({ groupId: id, view: "trash", pageSize: 1 })
      ]);
      if (
        !(await confirm(
          `删除“${name}”及其子分组？其中 ${active.total + trash.total} 条音频会移至“未分组”，不会删除文件。`,
          {
            title: "删除分组"
          }
        ))
      )
        return;
      await run(async () => {
        await api.removeGroup(id);
        let selected = data.value?.groups.find((group) => group.id === groupId.value);
        while (selected) {
          if (selected.id === id) {
            groupId.value = null;
            break;
          }
          selected = data.value?.groups.find((group) => group.id === selected?.parentId);
        }
      });
    } catch (e) {
      message.error(formatApiError(e));
    }
  }

  return {
    moveVisible,
    moveTarget,
    moveIds,
    recentOptions,
    openMove,
    undoToken,
    moveItems,
    undoMove,
    groupVisible,
    groupDraft,
    parentOptions,
    newGroup,
    editGroup,
    saveGroup,
    deleteGroup
  };
}
