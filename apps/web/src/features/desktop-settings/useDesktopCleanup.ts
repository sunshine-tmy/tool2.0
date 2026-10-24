import { computed, ref } from "vue";
import { useMessage } from "naive-ui";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError, httpClient, isApiErrorCancelled } from "../../shared/http/http";

import { CleanupInspectionSchema, CleanupResultsSchema, type CleanupCategory } from "@toolbox/shared";
import { formatBytesThroughGb as formatBytes } from "../../shared/utils/format-bytes";
export function useDesktopCleanup() {
  const message = useMessage(),
    confirm = useConfirmDialog();
  const cleanupCategories = ref<CleanupCategory[]>([]);
  const selectedCleanupIds = ref<string[]>([]);
  const cleanupLoading = ref(false);
  const cleanupExecuting = ref(false);
  const cleanupError = ref("");

  const cleanupSelected = computed(() =>
    cleanupCategories.value.filter((item) => selectedCleanupIds.value.includes(item.id))
  );
  const cleanupSelectedBytes = computed(() => cleanupSelected.value.reduce((sum, item) => sum + item.bytes, 0));
  const cleanupSelectedFileCount = computed(() => cleanupSelected.value.reduce((sum, item) => sum + item.files, 0));

  async function loadCleanup() {
    cleanupLoading.value = true;
    cleanupError.value = "";
    try {
      // Renderer 只显示两个低风险固定类别；真正的路径和保留期限由桌面后端限定。
      const categories = await httpClient.get("/maintenance/cleanup", CleanupInspectionSchema);
      cleanupCategories.value = categories.filter((item) => item.risk === "low" && ["logs", "temp"].includes(item.id));
      const availableIds = new Set(cleanupCategories.value.map((item) => item.id));
      selectedCleanupIds.value = selectedCleanupIds.value.filter((id) => availableIds.has(id));
    } catch (cause) {
      if (!isApiErrorCancelled(cause)) cleanupError.value = formatApiError(cause, "读取可清理内容失败");
    } finally {
      cleanupLoading.value = false;
    }
  }

  async function executeCleanup() {
    const selected = cleanupSelected.value.filter((item) => item.files > 0);
    if (!selected.length || cleanupExecuting.value) return;
    const labels = selected
      .map((item) => `${item.label}（${item.files} 个文件，${formatBytes(item.bytes)}）`)
      .join("、");
    const inspected = await confirm(
      `本次只会处理：${labels}。日志仅限 7 天前，临时文件仅限 24 小时前；其他应用数据不会改动。`,
      { title: "请检查清理范围", positiveText: "继续确认", danger: false }
    );
    if (!inspected) return;
    const accepted = await confirm(
      "这是第二次确认。清理后所选日志和临时文件无法恢复；作品、历史、素材、数据库、能力、模型、配置、登录状态和备份仍会保留。",
      { title: "最终确认清理", positiveText: "确认清理所选内容", danger: true }
    );
    if (!accepted) return;

    cleanupExecuting.value = true;
    cleanupError.value = "";
    try {
      const results = await httpClient.post("/maintenance/cleanup", CleanupResultsSchema, {
        ids: selected.map((item) => item.id)
      });
      const deletedFiles = results.reduce((sum, item) => sum + item.files, 0);
      const skippedFiles = results.reduce((sum, item) => sum + (item.skippedFiles ?? 0), 0);
      if (skippedFiles) message.warning(`已清理 ${deletedFiles} 个文件；${skippedFiles} 个被占用文件已跳过`);
      else message.success(`已清理 ${deletedFiles} 个过期文件`);
      selectedCleanupIds.value = [];
      await loadCleanup();
    } catch (cause) {
      if (!isApiErrorCancelled(cause)) cleanupError.value = formatApiError(cause, "清理失败；未能完成的内容已保留");
    } finally {
      cleanupExecuting.value = false;
    }
  }

  return {
    cleanupCategories,
    selectedCleanupIds,
    cleanupLoading,
    cleanupExecuting,
    cleanupError,
    cleanupSelectedBytes,
    cleanupSelectedFileCount,
    loadCleanup,
    executeCleanup
  };
}
