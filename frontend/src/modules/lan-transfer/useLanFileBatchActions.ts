import { computed, ref, type Ref } from "vue";
import type { LanFileView } from "./types";
import { lanTransferApi } from "./api";
import { getPageSelectionState, togglePageSelection, toggleSelectedId } from "../../utils/batch-selection";

type ActionMessage = {
  success: (message: string) => void;
  error: (message: string) => void;
};

export function useLanFileBatchActions(options: {
  files: Ref<LanFileView[]>;
  pagination: { page: number; total: number };
  refreshInfo: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  confirm: (message: string, options: { title: string }) => Promise<boolean>;
  message: ActionMessage;
}) {
  const selectedIds = ref<string[]>([]);
  const deleting = ref(false);
  const downloading = ref(false);
  const pageIds = computed(() => options.files.value.map((file) => file.id));
  const pageSelection = computed(() => getPageSelectionState(selectedIds.value, pageIds.value));

  function toggleFile(id: string, checked: boolean) {
    selectedIds.value = toggleSelectedId(selectedIds.value, id, checked);
  }

  function toggleAll(checked: boolean) {
    selectedIds.value = togglePageSelection(selectedIds.value, pageIds.value, checked);
  }

  function pruneSelection() {
    selectedIds.value = selectedIds.value.filter((id) => pageIds.value.includes(id));
  }

  async function deleteSelected() {
    if (!selectedIds.value.length) return;
    if (!(await options.confirm(`删除选中的 ${selectedIds.value.length} 个文件？`, { title: "批量删除文件" }))) return;

    deleting.value = true;
    try {
      const ids = [...selectedIds.value];
      await lanTransferApi.deleteFiles(ids);
      selectedIds.value = [];
      if (options.files.value.length === ids.length && options.pagination.page > 1) options.pagination.page -= 1;
      await options.refreshInfo();
      await options.refreshFiles();
      options.message.success("已批量删除文件");
    } catch (error) {
      options.message.error(error instanceof Error ? error.message : "批量删除文件失败");
    } finally {
      deleting.value = false;
    }
  }

  async function downloadSelected() {
    if (!selectedIds.value.length) return;
    downloading.value = true;
    try {
      const { blob, contentDisposition } = await lanTransferApi.downloadFiles([...selectedIds.value]);
      const fileName = decodeDownloadFileName(contentDisposition) ?? `lan-files-${Date.now()}.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      options.message.success("批量下载已开始");
      await options.refreshFiles();
    } catch (error) {
      options.message.error(error instanceof Error ? error.message : "批量下载文件失败");
    } finally {
      downloading.value = false;
    }
  }

  return {
    selectedIds,
    deleting,
    downloading,
    pageSelection,
    pruneSelection,
    toggleFile,
    toggleAll,
    deleteSelected,
    downloadSelected
  };
}

function decodeDownloadFileName(contentDisposition?: string) {
  if (!contentDisposition) return undefined;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="?([^";]+)"?/i.exec(contentDisposition)?.[1];
}
