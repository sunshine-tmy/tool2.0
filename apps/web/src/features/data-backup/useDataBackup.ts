import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  backupModules,
  cleanBackupPreferences,
  type BackupModuleId,
  type BackupMode,
  type BackupPreview,
  type BackupState,
  type BackupFileSelection,
  type DataBackupBridge
} from "@toolbox/shared/system";
import { apiBaseUrl } from "../../shared/config/runtime";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";

const clientKeys: Record<string, string> = {
  "archive.view": "toolbox:media-archive:view-mode",
  "audio.lastGroup": `audio-library:${apiBaseUrl}:last-group`,
  "audio.recentGroups": "audio-library-recent-groups",
  "audio.player": `toolbox-audio-player:${apiBaseUrl}`
};
export function collectBackupPreferences() {
  try {
    return cleanBackupPreferences(
      Object.fromEntries(
        Object.entries(clientKeys).flatMap(([key, local]) => {
          const value = localStorage.getItem(local);
          return value === null ? [] : [[key, value]];
        })
      )
    );
  } catch {
    return {};
  }
}
export function applyBackupPreferences(state: BackupState) {
  const latest = state.operations.find((o) => o.status === "completed" && o.preferences);
  if (!latest) return false;
  try {
    if (localStorage.getItem("toolbox:backup-preferences-applied") === latest.id) return false;
    let changed = false;
    for (const [key, value] of Object.entries(cleanBackupPreferences(latest.preferences))) {
      const local = clientKeys[key];
      if (localStorage.getItem(local) !== value) {
        localStorage.setItem(local, value);
        changed = true;
      }
    }
    localStorage.setItem("toolbox:backup-preferences-applied", latest.id);
    return changed;
  } catch {
    return false;
  }
}
export function useDataBackup() {
  const confirm = useConfirmDialog();
  const bridge = computed(() => {
    const candidate = window.toolboxDesktop;
    return candidate &&
      [
        candidate.getDataBackupState,
        candidate.selectDataBackup,
        candidate.previewDataBackup,
        candidate.exportModuleData,
        candidate.importModuleData,
        candidate.cancelDataBackup,
        candidate.rollbackModuleData,
        candidate.deleteDataRestorePoint
      ].every((method) => typeof method === "function")
      ? (candidate as DataBackupBridge)
      : undefined;
  });
  const state = ref<BackupState>({ operations: [], restorePoints: [] }),
    error = ref(""),
    pending = ref(false);
  const exportModules = ref<BackupModuleId[]>(backupModules.map((m) => m.id)),
    importModules = ref<BackupModuleId[]>([]);
  const includePreferences = ref(true),
    mode = ref<BackupMode>("merge"),
    selection = ref<BackupFileSelection>(),
    preview = ref<BackupPreview>();
  const historyPage = ref(1),
    pointsPage = ref(1),
    tab = ref("export");
  const active = computed(() => state.value.operations.find((o) => o.status === "running") ?? state.value.preflight);
  const busy = computed(() => pending.value || Boolean(active.value));
  let disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    refreshing = false;
  async function run(action: () => Promise<unknown>) {
    if (!bridge.value || busy.value) return;
    pending.value = true;
    error.value = "";
    try {
      await action();
    } catch (cause) {
      if (!disposed) error.value = cause instanceof Error ? cause.message : "操作失败，请重试";
    } finally {
      if (!disposed) pending.value = false;
    }
  }
  async function refresh() {
    if (!bridge.value || refreshing || disposed) return;
    refreshing = true;
    try {
      const next = await bridge.value.getDataBackupState();
      if (disposed) return;
      state.value = next;
      if (applyBackupPreferences(next)) window.location.reload();
    } catch (cause) {
      if (!disposed) error.value = cause instanceof Error ? cause.message : "无法读取备份状态";
    } finally {
      refreshing = false;
    }
  }
  async function exportData() {
    await run(async () => {
      const clientPreferences = collectBackupPreferences();
      const result = await bridge.value!.exportModuleData({
        // Electron IPC cannot serialize Vue proxies; send a detached selection snapshot.
        modules: [...exportModules.value],
        ...(includePreferences.value ? { preferences: clientPreferences } : {}),
        clientPreferences
      });
      if (!result.canceled) await refresh();
    });
  }
  async function selectFile() {
    await run(async () => {
      const result = await bridge.value!.selectDataBackup();
      if (disposed || result.canceled) return;
      selection.value = result;
      importModules.value = result.modules?.map((m) => m.id) ?? [];
      preview.value = undefined;
    });
  }
  async function inspect() {
    await run(async () => {
      if (!selection.value?.selectionId) return;
      const signature = JSON.stringify([selection.value.selectionId, importModules.value, mode.value]);
      const result = await bridge.value!.previewDataBackup({
        selectionId: selection.value.selectionId,
        modules: [...importModules.value],
        mode: mode.value
      });
      if (!disposed && signature === JSON.stringify([selection.value.selectionId, importModules.value, mode.value]))
        preview.value = result;
    });
  }
  async function restore() {
    const current = preview.value;
    if (!current || busy.value) return;
    const accepted = await confirm(
      current.mode === "replace"
        ? "将替换所选模块的全部业务数据；空模块会清空对应现有数据。未选模块保留，操作前会生成恢复点。"
        : "将添加缺少的数据，已有内容按预检结果保留。操作前会生成恢复点。",
      {
        title: current.mode === "replace" ? "确认替换所选模块" : "确认合并导入",
        positiveText: "备份现状并导入",
        danger: current.mode === "replace"
      }
    );
    if (!accepted || disposed) return;
    await run(async () => {
      await bridge.value!.importModuleData(current.planId, collectBackupPreferences());
      preview.value = undefined;
      await refresh();
    });
  }
  async function rollback(id: string) {
    const point = state.value.restorePoints.find((p) => p.id === id);
    if (!point || busy.value) return;
    const accepted = await confirm(
      `将恢复 ${point.modules.map((id) => backupModules.find((m) => m.id === id)?.name).join("、")} 到此恢复点。这些模块之后的变化会被替换；将先保存当前状态，其他模块保持不变。`,
      { title: "回滚所选模块", positiveText: "备份现状并回滚", danger: true }
    );
    if (accepted && !disposed)
      await run(async () => {
        await bridge.value!.rollbackModuleData(id, collectBackupPreferences());
        await refresh();
      });
  }
  async function deletePoint(id: string) {
    if (busy.value) return;
    if (
      (await confirm("只删除这个恢复点，不删除当前业务数据。删除后无法再用它回滚。", {
        title: "删除恢复点",
        danger: true
      })) &&
      !disposed
    )
      await run(async () => {
        await bridge.value!.deleteDataRestorePoint(id);
        await refresh();
      });
  }
  async function cancel(id: string) {
    try {
      await bridge.value?.cancelDataBackup(id);
      await refresh();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "取消失败";
    }
  }
  watch(
    [importModules, mode],
    () => {
      preview.value = undefined;
    },
    { deep: true }
  );
  watch(
    () => [state.value.restorePoints.length, state.value.operations.length],
    ([points, operations]) => {
      pointsPage.value = Math.min(pointsPage.value, Math.max(1, Math.ceil(points / 10)));
      historyPage.value = Math.min(historyPage.value, Math.max(1, Math.ceil(operations / 10)));
    }
  );
  onMounted(() => {
    const poll = async () => {
      await refresh();
      if (!disposed) timer = setTimeout(poll, active.value ? 1000 : 5000);
    };
    void poll();
  });
  onBeforeUnmount(() => {
    disposed = true;
    if (timer) clearTimeout(timer);
  });
  return {
    bridge,
    state,
    error,
    pending,
    busy,
    active,
    exportModules,
    importModules,
    includePreferences,
    mode,
    selection,
    preview,
    tab,
    historyPage,
    pointsPage,
    refresh,
    exportData,
    selectFile,
    inspect,
    restore,
    rollback,
    deletePoint,
    cancel
  };
}
