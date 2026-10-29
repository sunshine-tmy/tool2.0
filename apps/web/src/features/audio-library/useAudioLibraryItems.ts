import { reactive, ref } from "vue";
import { useMessage } from "naive-ui";
import type { AudioLibraryItemView, AudioLibraryEdit } from "@toolbox/shared";
import { audioLibraryApi as api } from "./api";
import { audioLibraryPlayer as player } from "./player";
import type { AudioLibraryCollection } from "./useAudioLibraryCollection";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { copyTextToClipboard } from "../../shared/utils/clipboard";
import { formatApiError } from "../../shared/http/http";
export function useAudioLibraryItems(collection: AudioLibraryCollection) {
  const { data, loading, selected, view, load } = collection;
  const message = useMessage(),
    confirm = useConfirmDialog(),
    busy = ref(false),
    purgingSelected = ref(false);
  async function run(fn: () => Promise<unknown>) {
    if (busy.value) return;
    busy.value = true;
    try {
      await fn();
      await load();
    } catch (e) {
      message.error(formatApiError(e));
    } finally {
      busy.value = false;
    }
  }
  function enqueue(items: AudioLibraryItemView[]) {
    player.add(items.filter((x) => x.available));
    message.success("已加入播放队列");
  }
  function enqueueSelected() {
    enqueue(data.value?.items.filter((x) => selected.value.includes(x.id)) || []);
  }
  function syncPlayer(item: AudioLibraryItemView) {
    for (const entry of player.queue) if (entry.item.id === item.id) entry.item = item;
    if (player.preview?.id === item.id) player.preview = item;
  }
  const detailVisible = ref(false),
    detail = ref<AudioLibraryItemView>(),
    draft = reactive<AudioLibraryEdit>({});
  function openDetail(item: AudioLibraryItemView) {
    detail.value = item;
    Object.assign(draft, {
      title: item.title,
      purpose: item.purpose ?? (["chatterbox", "edge-tts"].includes(item.source.kind) ? "speech" : "general"),
      language: item.language,
      foreignText: item.foreignText,
      chineseText: item.chineseText,
      note: item.note,
      revision: item.revision
    });
    detailVisible.value = true;
  }
  async function saveDetail() {
    if (!detail.value) return;
    await run(async () => {
      const saved = await api.edit(detail.value!.id, { ...draft });
      detail.value = saved;
      draft.revision = saved.revision;
      syncPlayer(saved);
      message.success("标注已保存");
    });
  }
  async function copy(text: string) {
    try {
      await copyTextToClipboard(text);
      message.success("已复制");
    } catch {
      message.error("复制失败，请手动复制");
    }
  }
  async function trashSelected() {
    const ids = [...selected.value];
    if (!ids.length) return;
    if (
      view.value !== "trash" &&
      !(await confirm(`将 ${ids.length} 条音频移入回收站？可以恢复。`, { title: "移入回收站" }))
    )
      return;
    await run(async () => {
      await api.trash(ids, view.value === "trash");
      if (view.value !== "trash") ids.forEach((id) => player.removeItem(id));
    });
  }
  async function trashDetail() {
    if (!detail.value || !(await confirm("将这条音频移入回收站？", { title: "移入回收站" }))) return;
    const id = detail.value.id;
    await run(async () => {
      await api.trash([id]);
      player.removeItem(id);
      detailVisible.value = false;
    });
  }
  async function restoreItem(item: AudioLibraryItemView) {
    await run(() => api.trash([item.id], true));
  }
  async function purge(item: AudioLibraryItemView) {
    if (!(await confirm(`彻底删除“${item.title}”及音频文件？此操作无法撤销。`, { title: "彻底删除" }))) return;
    await run(() => api.purge(item.id));
  }
  async function purgeSelected() {
    if (view.value !== "trash" || !selected.value.length || busy.value || purgingSelected.value || loading.value)
      return;
    const ids = [...selected.value];
    const failed: Array<{ id: string; message: string }> = [];
    purgingSelected.value = true;
    try {
      if (
        !(await confirm(`彻底删除所选 ${ids.length} 条音频及其文件？此操作无法撤销。`, {
          title: "彻底删除所选",
          positiveText: "确认彻底删除",
          danger: true
        }))
      )
        return;
      await run(async () => {
        // 串行删除且逐条记录失败，避免单条被占用阻断其他已确认删除的音频。
        for (const id of ids) {
          try {
            await api.purge(id);
            player.removeItem(id);
          } catch (e) {
            failed.push({ id, message: formatApiError(e) });
          }
        }
        if (failed.length) {
          message.warning(
            `已彻底删除 ${ids.length - failed.length} 条，${failed.length} 条删除失败：${failed[0].message}`,
            {
              duration: 8000
            }
          );
        } else message.success(`已彻底删除 ${ids.length} 条音频`);
      });
      if (view.value === "trash") {
        selected.value = failed.map((item) => item.id).filter((id) => data.value?.items.some((item) => item.id === id));
      }
    } finally {
      purgingSelected.value = false;
    }
  }

  return {
    busy,
    purgingSelected,
    run,
    enqueue,
    enqueueSelected,
    detailVisible,
    detail,
    draft,
    openDetail,
    saveDetail,
    copy,
    trashSelected,
    trashDetail,
    restoreItem,
    purge,
    purgeSelected
  };
}
