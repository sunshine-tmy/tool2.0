/** 两种配音批次列表共用本页选择和逐项删除结果处理。 */
import { computed, ref, watch, type Ref } from "vue";
import { formatApiError } from "../../services/http";

export function useSpeechBatchSelection(options: {
  batches: Ref<Array<{ id: string }>>;
  blocked: () => boolean;
  remove: (id: string) => Promise<unknown>;
  onRemoved: (id: string) => void;
  reload: () => Promise<unknown>;
  confirm: (message: string, options: { title: string; positiveText?: string; danger?: boolean }) => Promise<boolean>;
  message: { success: (message: string) => void; warning: (message: string) => void };
}) {
  const selectedBatchIds = ref<string[]>([]);
  const deletingBatches = ref(false);
  const pageIds = computed(() => options.batches.value.map((batch) => batch.id));
  const allPageBatchesSelected = computed(
    () => pageIds.value.length > 0 && pageIds.value.every((id) => selectedBatchIds.value.includes(id))
  );
  const somePageBatchesSelected = computed(
    () => !allPageBatchesSelected.value && pageIds.value.some((id) => selectedBatchIds.value.includes(id))
  );
  watch([pageIds, deletingBatches], () => {
    if (!deletingBatches.value)
      selectedBatchIds.value = selectedBatchIds.value.filter((id) => pageIds.value.includes(id));
  });
  function toggleBatchSelection(id: string, checked: boolean) {
    if (deletingBatches.value || options.blocked() || !pageIds.value.includes(id)) return;
    selectedBatchIds.value = checked
      ? [...new Set([...selectedBatchIds.value, id])]
      : selectedBatchIds.value.filter((selected) => selected !== id);
  }
  function toggleAllPageBatches(checked: boolean) {
    if (deletingBatches.value || options.blocked()) return;
    selectedBatchIds.value = checked ? [...pageIds.value] : [];
  }
  async function removeSelectedBatches() {
    if (deletingBatches.value || options.blocked()) return;
    const ids = [...new Set(selectedBatchIds.value)].filter((id) => pageIds.value.includes(id));
    if (!ids.length) return;
    deletingBatches.value = true;
    try {
      if (
        !(await options.confirm(
          `删除所选 ${ids.length} 个批次及其音频、字幕和批次参考音色（如有）？此操作不可恢复，已加入音频库的独立副本不受影响。运行中的批次可能无法删除，失败项将保留选中。`,
          { title: "删除所选批次", positiveText: "确认删除", danger: true }
        ))
      )
        return;
      let removed = 0;
      const failures: string[] = [];
      for (const id of ids) {
        try {
          await options.remove(id);
          removed++;
          selectedBatchIds.value = selectedBatchIds.value.filter((selected) => selected !== id);
          options.onRemoved(id);
        } catch (error) {
          failures.push(formatApiError(error));
        }
      }
      if (failures.length)
        options.message.warning(`已删除 ${removed} 个批次，${failures.length} 个失败；失败项保留选中：${failures[0]}`);
      else options.message.success(`已删除 ${removed} 个批次`);
      await options.reload();
    } catch (error) {
      options.message.warning(`批次删除未能完成：${formatApiError(error)}`);
    } finally {
      deletingBatches.value = false;
    }
  }
  return {
    selectedBatchIds,
    deletingBatches,
    allPageBatchesSelected,
    somePageBatchesSelected,
    toggleBatchSelection,
    toggleAllPageBatches,
    removeSelectedBatches
  };
}
