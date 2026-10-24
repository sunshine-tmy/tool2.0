import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import { audioLibraryApi as api } from "./api";
import { rememberGroup, storedGroup } from "./preferences";
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
    moveTarget = ref<string | null>(storedGroup()),
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
    if (moveTarget.value && !groups.value.some((x) => x.value === moveTarget.value)) moveTarget.value = null;
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
  function newGroup() {
    Object.assign(groupDraft, { id: undefined, name: "", parentId: groupId.value });
    groupVisible.value = true;
  }
  function editGroup() {
    const group = data.value?.groups.find((x) => x.id === groupId.value);
    if (group) {
      Object.assign(groupDraft, group);
      groupVisible.value = true;
    }
  }
  async function saveGroup() {
    await run(async () => {
      await api.group(groupDraft.name, groupDraft.parentId, groupDraft.id);
      groupVisible.value = false;
    });
  }
  async function deleteGroup() {
    if (!groupId.value) return;
    const id = groupId.value;
    try {
      const [active, trash] = await Promise.all([
        api.list({ groupId: id, pageSize: 1 }),
        api.list({ groupId: id, view: "trash", pageSize: 1 })
      ]);
      if (
        !(await confirm(
          `删除该分组及其子分组？其中 ${active.total + trash.total} 条音频会移至“未分组”，不会删除文件。`,
          {
            title: "删除分组"
          }
        ))
      )
        return;
      await run(async () => {
        await api.removeGroup(id);
        groupId.value = null;
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
    newGroup,
    editGroup,
    saveGroup,
    deleteGroup
  };
}
