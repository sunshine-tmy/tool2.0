import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import type { ImageAiOperation, ImageAiTask, ImageAiTaskStatus } from "@toolbox/shared";
import { imageAiApi } from "../api";
import { isActive } from "./presentation";
import { useConfirmDialog } from "../../../shared/composables/useConfirmDialog";
import { formatApiError, isApiErrorCancelled } from "../../../shared/http/http";
export function useImageAiHistory(
  props: { refreshVersion: number },
  deleted: (id: string) => void,
  closeRemoved: (id: string) => void
) {
  const message = useMessage(),
    confirm = useConfirmDialog();
  const items = ref<ImageAiTask[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = 20;
  const keyword = ref("");
  const appliedKeyword = ref("");
  const operation = ref<ImageAiOperation | null>(null);
  const status = ref<ImageAiTaskStatus | null>(null);
  const loading = ref(false);
  const listError = ref("");
  const deletingId = ref<string>();
  const selectedIds = ref<string[]>([]);
  const batchDeleting = ref(false);
  const batchProcessed = ref(0);
  const batchTotal = ref(0);
  const batchError = ref("");
  const deletionBusy = computed(() => batchDeleting.value || deletingId.value !== undefined);
  const selectableIds = computed(() => items.value.filter((task) => !isActive(task)).map((task) => task.id));
  const allSelected = computed(
    () => selectableIds.value.length > 0 && selectableIds.value.every((id) => selectedIds.value.includes(id))
  );
  const partlySelected = computed(() => selectedIds.value.length > 0 && !allSelected.value);
  let controller: AbortController | undefined;
  let disposed = false;
  onMounted(loadHistory);
  watch(
    () => props.refreshVersion,
    () => {
      void loadHistory();
    }
  );
  watch([operation, status], applyFilters);
  onBeforeUnmount(() => {
    disposed = true;
    controller?.abort();
  });

  async function loadHistory() {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading.value = true;
    listError.value = "";
    try {
      const result = await imageAiApi.history(
        {
          page: page.value,
          pageSize,
          operation: operation.value ?? undefined,
          status: status.value ?? undefined,
          keyword: appliedKeyword.value || undefined
        },
        request.signal
      );
      if (disposed || request.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
      if (page.value > lastPage) {
        page.value = lastPage;
        await loadHistory();
        return;
      }
      items.value = result.items;
      total.value = result.total;
      selectedIds.value = selectedIds.value.filter((id) => selectableIds.value.includes(id));
    } catch (error) {
      if (!disposed && !request.signal.aborted && !isApiErrorCancelled(error))
        listError.value = formatApiError(error, "读取处理记录失败");
    } finally {
      if (!disposed && controller === request) loading.value = false;
    }
  }
  function applyFilters() {
    if (deletionBusy.value) return;
    selectedIds.value = [];
    batchError.value = "";
    appliedKeyword.value = keyword.value.trim();
    page.value = 1;
    void loadHistory();
  }
  function changePage(value: number) {
    if (deletionBusy.value) return;
    selectedIds.value = [];
    batchError.value = "";
    page.value = value;
    void loadHistory();
  }
  async function removeTask(task: ImageAiTask) {
    if (isActive(task) || deletionBusy.value) return;
    batchError.value = "";
    deletingId.value = task.id;
    try {
      if (
        !(await confirm(
          "将删除这条处理记录及应用保存在本机的原图、蒙版和处理结果，无法撤销。不会删除您电脑中另外保存的原始文件。",
          { title: "删除图片处理记录", danger: true, positiveText: "确认删除" }
        ))
      )
        return;
      if (disposed) return;
      await imageAiApi.removeHistory(task.id);
      if (disposed) return;
      removedFromView(task.id);
      message.success("处理记录及本机文件已删除");
      await loadHistory();
    } catch (error) {
      if (!disposed && !isApiErrorCancelled(error)) message.error(formatApiError(error, "删除处理记录失败"));
    } finally {
      if (!disposed) deletingId.value = undefined;
    }
  }
  function selectTask(id: string, checked: boolean) {
    if (loading.value || deletionBusy.value || !selectableIds.value.includes(id)) return;
    selectedIds.value = checked
      ? [...new Set([...selectedIds.value, id])]
      : selectedIds.value.filter((value) => value !== id);
  }
  function selectPage(checked: boolean) {
    if (loading.value || deletionBusy.value) return;
    selectedIds.value = checked ? [...selectableIds.value] : [];
  }
  function removedFromView(id: string) {
    closeRemoved(id);
    selectedIds.value = selectedIds.value.filter((value) => value !== id);
    items.value = items.value.filter((task) => task.id !== id);
    total.value = Math.max(0, total.value - 1);
    deleted(id);
  }
  async function removeSelected() {
    if (loading.value || deletionBusy.value) return;
    const ids = selectedIds.value.filter((id) => selectableIds.value.includes(id));
    if (!ids.length) return;
    batchDeleting.value = true;
    batchProcessed.value = 0;
    batchTotal.value = ids.length;
    batchError.value = "";
    try {
      if (
        !(await confirm(
          `将删除所选 ${ids.length} 条处理记录，以及应用保存在本机的对应原图、蒙版和处理结果，无法撤销。不会删除其他记录或电脑中另外保存的原始文件。`,
          { title: "批量删除图片处理记录", danger: true, positiveText: `确认删除 ${ids.length} 条` }
        ))
      )
        return;
      const failures: string[] = [];
      let deleted = 0;
      // Use the same server-side guarded operation for each fixed confirmed ID.
      // Serial execution avoids concurrent recursive removals and reports real outcomes.
      for (const id of ids) {
        if (disposed) return;
        try {
          await imageAiApi.removeHistory(id);
          if (disposed) return;
          removedFromView(id);
          deleted += 1;
        } catch (error) {
          if (disposed) return;
          failures.push(`${id}：${formatApiError(error, "删除失败")}`);
        }
        batchProcessed.value += 1;
      }
      if (deleted) message.success(`已删除 ${deleted} 条处理记录及本机文件`);
      if (failures.length)
        batchError.value = `${failures.length} 条未能完成删除，请检查提示后重试。${failures.slice(0, 3).join("；")}${failures.length > 3 ? "；还有其他未删除项目，可刷新后检查" : ""}`;
      await loadHistory();
    } catch (error) {
      if (!disposed && !isApiErrorCancelled(error)) message.error(formatApiError(error, "批量删除处理记录失败"));
    } finally {
      if (!disposed) batchDeleting.value = false;
    }
  }

  return {
    items,
    total,
    page,
    pageSize,
    keyword,
    operation,
    status,
    loading,
    listError,
    deletingId,
    selectedIds,
    batchDeleting,
    batchProcessed,
    batchTotal,
    batchError,
    deletionBusy,
    selectableIds,
    allSelected,
    partlySelected,
    loadHistory,
    applyFilters,
    changePage,
    removeTask,
    selectTask,
    selectPage,
    removeSelected
  };
}
