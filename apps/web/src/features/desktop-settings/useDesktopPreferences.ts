import { computed, ref } from "vue";
import { useMessage } from "naive-ui";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
import type { DesktopSettingsState } from "@toolbox/shared/desktop";
export function useDesktopPreferences() {
  const desktop = computed(() => window.toolboxDesktop),
    message = useMessage(),
    confirm = useConfirmDialog();
  const settings = ref<DesktopSettingsState>(),
    selectedLegacyDirectory = ref<{ selectionId: string; displayName: string }>();
  const loading = ref(false),
    saving = ref(false),
    migrating = ref(false),
    checkingUpdates = ref(false),
    error = ref("");
  async function loadSettings() {
    if (!desktop.value) return;
    loading.value = true;
    error.value = "";
    try {
      settings.value = await desktop.value.getSettings();
    } catch (cause) {
      error.value = formatApiError(cause, "读取桌面设置失败");
    } finally {
      loading.value = false;
    }
  }

  async function saveStartAtLogin(value: boolean) {
    await saveSettings({ startAtLogin: value });
  }

  async function saveAutomaticUpdateChecks(value: boolean) {
    await saveSettings({ automaticUpdateChecks: value });
  }

  async function saveSettings(update: { startAtLogin?: boolean; automaticUpdateChecks?: boolean }) {
    if (!desktop.value) return;
    saving.value = true;
    error.value = "";
    try {
      settings.value = await desktop.value.updateSettings(update);
      message.success("桌面设置已保存");
    } catch (cause) {
      error.value = formatApiError(cause, "保存桌面设置失败");
    } finally {
      saving.value = false;
    }
  }

  async function revealDataDirectory() {
    if (!desktop.value) return;
    try {
      await desktop.value.revealDataDirectory();
    } catch (cause) {
      error.value = formatApiError(cause, "打开用户数据目录失败");
    }
  }

  async function checkForUpdates() {
    if (!desktop.value) return;
    checkingUpdates.value = true;
    error.value = "";
    try {
      const result = await desktop.value.checkForUpdates();
      if (!result.enabled) message.info("当前不是已配置更新源的 NSIS 安装版，无法检查更新");
      else message.success("正在检查更新；如有新版本，下载完成后会提示安装");
    } catch (cause) {
      error.value = formatApiError(cause, "检查更新失败");
    } finally {
      checkingUpdates.value = false;
    }
  }

  async function selectLegacyDirectory() {
    if (!desktop.value) return;
    error.value = "";
    try {
      const selection = await desktop.value.selectLegacyDataDirectory();
      if (selection.canceled) return;
      selectedLegacyDirectory.value = selection;
      const accepted = await confirm(
        `将导入“${selection.displayName}”并替换当前本机数据。导入前会创建可验证的备份，应用将自动重启本地服务。`,
        { title: "确认导入旧版数据", positiveText: "开始备份并导入", danger: true }
      );
      if (!accepted) return;
      migrating.value = true;
      await desktop.value.importLegacyData(selection.selectionId);
      // 主进程在切换完成后会加载新的本地服务地址；通常在此之前页面已重新载入。
    } catch (cause) {
      error.value = formatApiError(cause, "导入旧版数据失败");
    } finally {
      migrating.value = false;
    }
  }

  async function rollbackMigration() {
    if (!desktop.value || !settings.value?.lastMigration) return;
    const migration = settings.value.lastMigration;
    const accepted = await confirm("将停止本地服务并恢复导入前的数据。当前数据会先保留为保护副本。", {
      title: "确认回滚数据迁移",
      positiveText: "回滚到导入前数据",
      danger: true
    });
    if (!accepted) return;
    migrating.value = true;
    error.value = "";
    try {
      await desktop.value.rollbackDataMigration(migration.id);
    } catch (cause) {
      error.value = formatApiError(cause, "回滚数据迁移失败");
    } finally {
      migrating.value = false;
    }
  }

  return {
    desktop,
    settings,
    selectedLegacyDirectory,
    loading,
    saving,
    migrating,
    checkingUpdates,
    error,
    loadSettings,
    saveStartAtLogin,
    saveAutomaticUpdateChecks,
    revealDataDirectory,
    checkForUpdates,
    selectLegacyDirectory,
    rollbackMigration
  };
}
