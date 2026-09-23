<!-- 中文模块说明：桌面前端页面，负责桌面设置和受控的旧版数据迁移入口。 -->
<template>
  <ToolLayout>
    <section class="main-column">
      <ToolPageHeader
        title="桌面设置与数据迁移"
        description="所有运行数据、备份和设置都保存在当前 Windows 用户的数据目录；安装目录不会写入用户文件。"
        kicker="DESKTOP · LOCAL DATA"
      />

      <n-alert v-if="!desktop" type="info" :bordered="false">
        此页面仅在 Windows 桌面应用中提供。Web 开发模式不会读取或修改本机桌面设置。
      </n-alert>

      <template v-else>
        <n-alert v-if="error" type="error" :bordered="false" class="settings-alert">{{ error }}</n-alert>
        <section class="workspace-panel">
          <div class="panel-heading">
            <div>
              <h3>启动与更新</h3>
              <p class="panel-description">
                偏好将原子写入用户配置目录；只在已签名安装版中从固定 HTTPS 更新源检查更新。
              </p>
            </div>
            <n-space>
              <n-button tertiary :loading="loading" @click="loadSettings">刷新</n-button>
              <n-button tertiary :loading="checkingUpdates" :disabled="loading" @click="checkForUpdates"
                >检查更新</n-button
              >
            </n-space>
          </div>
          <n-space vertical :size="18">
            <n-space justify="space-between" align="center">
              <div>
                <strong>登录 Windows 后启动</strong>
                <p class="setting-copy">仅设置当前用户的 Windows 登录项。</p>
              </div>
              <n-switch
                :value="settings?.startAtLogin"
                :disabled="saving || loading"
                @update:value="saveStartAtLogin"
              />
            </n-space>
            <n-space justify="space-between" align="center">
              <div>
                <strong>自动检查更新</strong>
                <p class="setting-copy">默认开启；下载完成后会询问是否重启安装。</p>
              </div>
              <n-switch
                :value="settings?.automaticUpdateChecks"
                :disabled="saving || loading"
                @update:value="saveAutomaticUpdateChecks"
              />
            </n-space>
          </n-space>
        </section>

        <section class="workspace-panel">
          <div class="panel-heading">
            <div>
              <h3>本机数据目录</h3>
              <p class="panel-description">此处包含数据库、素材、可选能力包、模型、迁移备份和桌面设置。</p>
            </div>
            <n-button secondary :disabled="loading" @click="revealDataDirectory">在资源管理器中打开</n-button>
          </div>
          <n-code v-if="settings" :code="settings.dataDirectory" language="text" word-wrap />
        </section>

        <section class="workspace-panel">
          <div class="panel-heading">
            <div>
              <h3>导入旧版数据</h3>
              <p class="panel-description">
                选择旧版 <code>storage</code> 目录后，应用会停止本地服务、复制到临时区并逐文件校验，再原子切换。
              </p>
            </div>
            <n-button type="primary" :loading="migrating" @click="selectLegacyDirectory">选择历史数据目录</n-button>
          </div>
          <n-alert type="warning" :bordered="false">
            导入会替换当前数据目录，但替换前的完整数据会移动到用户目录内的迁移备份。源目录始终只读，不会被删除或改写。
          </n-alert>
          <p v-if="selectedLegacyDirectory" class="selected-source">
            已选择：{{ selectedLegacyDirectory.displayName }}
          </p>
        </section>

        <section v-if="settings?.lastMigration" class="workspace-panel">
          <div class="panel-heading">
            <div>
              <h3>最近一次迁移</h3>
              <p class="panel-description">
                {{ migrationStatusLabel(settings.lastMigration.status) }} ·
                {{ formatDate(settings.lastMigration.completedAt) }} · {{ settings.lastMigration.files }} 个文件 /
                {{ formatBytes(settings.lastMigration.bytes) }}
              </p>
            </div>
            <n-button
              v-if="settings.lastMigration.status === 'imported'"
              type="error"
              secondary
              :loading="migrating"
              @click="rollbackMigration"
              >回滚到导入前数据</n-button
            >
          </div>
          <n-code :code="settings.lastMigration.id" language="text" word-wrap />
          <p class="setting-copy">
            回滚也会先保留当前导入后数据的保护副本；如果备份摘要不匹配，应用会拒绝回滚而不会改写任何文件。
          </p>
        </section>
      </template>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NAlert, NButton, NCode, NSpace, NSwitch, useMessage } from "naive-ui";
import ToolLayout from "../layouts/ToolLayout.vue";
import ToolPageHeader from "../components/tool/ToolPageHeader.vue";
import { useConfirmDialog } from "../composables/useConfirmDialog";
import { formatApiError } from "../services/http";

type DesktopMigrationSummary = {
  id: string;
  status: "imported" | "rolled-back";
  completedAt: string;
  files: number;
  bytes: number;
};

type DesktopSettingsState = {
  startAtLogin: boolean;
  automaticUpdateChecks: boolean;
  dataDirectory: string;
  lastMigration?: DesktopMigrationSummary;
};

const desktop = computed(() => window.toolboxDesktop);
const message = useMessage();
const confirm = useConfirmDialog();
const settings = ref<DesktopSettingsState>();
const selectedLegacyDirectory = ref<{ selectionId: string; displayName: string }>();
const loading = ref(false);
const saving = ref(false);
const migrating = ref(false);
const checkingUpdates = ref(false);
const error = ref("");

onMounted(() => void loadSettings());

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

function migrationStatusLabel(status: DesktopMigrationSummary["status"]) {
  return status === "imported" ? "已导入" : "已回滚";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
</script>

<style scoped>
.panel-description,
.setting-copy,
.selected-source {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.settings-alert {
  margin-bottom: 16px;
}

.selected-source {
  color: #0f766e;
  font-weight: 700;
}
</style>
