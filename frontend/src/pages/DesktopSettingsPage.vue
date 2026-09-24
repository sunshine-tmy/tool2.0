<!-- 中文模块说明：桌面前端页面，负责桌面设置和受控的旧版数据迁移入口。 -->
<template>
  <ToolLayout>
    <section class="main-column">
      <ToolPageHeader
        title="桌面设置与数据迁移"
        description="程序安装位置与持久数据位置分开显示；桌面版的数据库、素材、能力、模型与登录状态保存在安装目录下的 data 文件夹。"
        kicker="DESKTOP · STORAGE"
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
              <h3>存储位置</h3>
              <p class="panel-description">应用管理的持久数据默认跟随本次选择的安装目录；卸载时默认保留。</p>
            </div>
            <n-button secondary :disabled="loading" @click="revealDataDirectory">在资源管理器中打开</n-button>
          </div>
          <div v-if="settings" class="storage-paths">
            <div>
              <p class="setting-copy">安装目录</p>
              <n-code :code="settings.installDirectory" language="text" word-wrap />
            </div>
            <div>
              <p class="setting-copy">完整数据目录</p>
              <n-code :code="settings.dataDirectory" language="text" word-wrap />
            </div>
          </div>
        </section>

        <section class="workspace-panel capability-panel">
          <div class="panel-heading">
            <div>
              <h3>能力管理</h3>
              <p class="panel-description">
                按需安装本地运行时与模型。安装前会展示体积、用途和许可；后端会在下载前检查磁盘空间，失败不会替换可用版本。
              </p>
              <p v-if="componentTotalLabel" class="setting-copy">{{ componentTotalLabel }}（共享依赖只计一次）</p>
            </div>
            <n-button secondary :loading="componentsLoading" @click="loadComponents">刷新能力状态</n-button>
          </div>
          <n-alert v-if="componentsError" type="error" :bordered="false" class="settings-alert">
            {{ componentsError }}
          </n-alert>
          <template v-else>
            <n-alert v-if="componentsNotice" type="warning" :bordered="false" class="settings-alert">
              {{ componentsNotice }}
            </n-alert>
            <n-spin v-if="componentsLoading && !components.length" />
            <template v-else-if="components.length">
              <section v-for="group in componentGroups" :key="group.id" class="component-group">
                <h4>{{ group.label }}</h4>
                <div class="component-list">
                  <DesktopComponentCard
                    v-for="component in group.items"
                    :key="component.id"
                    :component="component"
                    :job="componentJobs[component.id]"
                    :canceling="cancelingJobId === componentJobs[component.id]?.id"
                    :operation-loading="startingComponentId === component.id"
                    @install="installComponent"
                    @reinstall="reinstallComponent"
                    @uninstall="uninstallComponent"
                    @cancel="cancelComponentJob"
                  />
                </div>
              </section>
            </template>
            <n-alert v-else type="info" :bordered="false">
              当前版本没有已审核并签名的可安装能力包。获得许可与供应链审核的能力包发布后会显示在这里；本阶段不会从未审核来源安装能力包，现有业务运行方式保持不变。
            </n-alert>
          </template>
          <p class="setting-copy capability-retention-note">
            卸载只移除该能力的运行时、依赖和模型，不删除作品、历史任务、个人素材或登录状态；被其他已安装能力依赖的共享组件必须先解除依赖。
          </p>
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { NAlert, NButton, NCode, NSpin, NSpace, NSwitch, useMessage } from "naive-ui";
import type { ComponentGroup, ComponentJob, ComponentPackageStatus } from "@toolbox/shared";
import ToolLayout from "../layouts/ToolLayout.vue";
import ToolPageHeader from "../components/tool/ToolPageHeader.vue";
import DesktopComponentCard from "./DesktopComponentCard.vue";
import { useConfirmDialog } from "../composables/useConfirmDialog";
import { formatApiError } from "../services/http";
import { componentApi, subscribeComponentJob } from "../services/components";

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
  installDirectory: string;
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
const components = ref<ComponentPackageStatus[]>([]);
const componentJobs = ref<Record<string, ComponentJob>>({});
const componentsLoading = ref(false);
const componentsError = ref("");
const componentsNotice = ref("");
const startingComponentId = ref("");
const cancelingJobId = ref("");
const jobSubscriptions = new Map<string, () => void>();

const componentGroupLabels: Record<ComponentGroup, string> = {
  shared: "共享基础能力",
  media: "视频与媒体",
  audio: "语音与配音",
  image: "AI 图片处理",
  archive: "内容归档",
  translation: "翻译"
};
const componentGroups = computed(() => {
  const order: ComponentGroup[] = ["shared", "media", "audio", "image", "archive", "translation"];
  return order
    .map((id) => ({
      id,
      label: componentGroupLabels[id],
      items: components.value.filter((item) => item.groupId === id)
    }))
    .filter((group) => group.items.length);
});
const componentTotalLabel = computed(() => {
  if (!components.value.length) return "";
  const totalDownloadBytes = components.value.reduce((sum, item) => sum + item.downloadBytes, 0);
  const totalInstalledBytes = components.value.reduce((sum, item) => sum + item.installedBytes, 0);
  return `已审核 ${components.value.length} 项 · 下载合计 ${formatBytes(totalDownloadBytes)} · 全部安装后约 ${formatBytes(totalInstalledBytes)}`;
});

onMounted(() => {
  void loadSettings();
  void loadComponents();
});

onBeforeUnmount(() => {
  for (const unsubscribe of jobSubscriptions.values()) unsubscribe();
  jobSubscriptions.clear();
});

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

async function loadComponents() {
  if (!desktop.value) return;
  componentsLoading.value = true;
  componentsError.value = "";
  try {
    components.value = await componentApi.list();
    // 组件卡片在页面刷新后通过服务端公开的 activeJobId 恢复进度订阅。
    await Promise.all(
      components.value
        .filter((component) => component.activeJobId && !componentJobs.value[component.id])
        .map(async (component) => {
          try {
            trackComponentJob(await componentApi.getJob(component.activeJobId!));
          } catch {
            // 作业可能刚完成或服务刚重启；重新读取目录即可显示实际已安装状态。
          }
        })
    );
  } catch (cause) {
    componentsError.value = formatApiError(cause, "读取能力目录失败");
  } finally {
    componentsLoading.value = false;
  }
}

async function installComponent(component: ComponentPackageStatus) {
  const accepted = await confirm(
    `将下载“${component.displayName}”约 ${formatBytes(component.downloadBytes)}，安装后约占用 ${formatBytes(component.installedBytes)}。许可：${component.licenseName}。后端会在下载前复核磁盘空间，安装失败不会替换健康版本。${formatInstallConditions(component)}`,
    { title: "确认安装能力", positiveText: "开始安装" }
  );
  if (accepted) await startComponentOperation(component, "install");
}

async function reinstallComponent(component: ComponentPackageStatus) {
  const accepted = await confirm(
    `将重新下载并校验“${component.displayName}”。新版本通过自检前会保留当前版本，失败时不会破坏现有可用能力。作品与历史数据不受影响。`,
    { title: "确认重装能力", positiveText: "开始重装" }
  );
  if (accepted) await startComponentOperation(component, "reinstall");
}

async function uninstallComponent(component: ComponentPackageStatus) {
  if (component.dependentIds.length) {
    message.warning(`该组件仍被 ${component.dependentIds.join("、")} 依赖，请先卸载依赖能力`);
    return;
  }
  const accepted = await confirm(
    `将删除“${component.displayName}”的运行时、依赖和模型。作品、历史任务、个人素材、登录状态及其他应用数据均会保留。`,
    { title: "确认卸载能力", positiveText: "仅卸载能力", danger: true }
  );
  if (accepted) await startComponentOperation(component, "uninstall");
}

async function startComponentOperation(component: ComponentPackageStatus, operation: ComponentJob["operation"]) {
  if (startingComponentId.value) return;
  startingComponentId.value = component.id;
  componentsError.value = "";
  componentsNotice.value = "";
  try {
    const job =
      operation === "install"
        ? await componentApi.install(component.id)
        : operation === "reinstall"
          ? await componentApi.reinstall(component.id)
          : await componentApi.uninstall(component.id);
    trackComponentJob(job);
  } catch (cause) {
    componentsError.value = formatApiError(cause, "能力管理操作失败");
  } finally {
    startingComponentId.value = "";
  }
}

function trackComponentJob(job: ComponentJob) {
  if (["completed", "failed", "cancelled"].includes(job.state)) {
    finishComponentJob(job, false);
    return;
  }
  componentJobs.value = { ...componentJobs.value, [job.componentId]: job };
  if (jobSubscriptions.has(job.id)) return;
  const unsubscribe = subscribeComponentJob(
    job.id,
    (updated) => {
      if (["completed", "failed", "cancelled"].includes(updated.state)) {
        finishComponentJob(updated, true);
        return;
      }
      componentJobs.value = { ...componentJobs.value, [updated.componentId]: updated };
      componentsError.value = "";
      componentsNotice.value = "";
    },
    () => {
      componentsNotice.value = "进度连接暂时中断，正在自动重连；安装状态不会因此丢失。";
    }
  );
  jobSubscriptions.set(job.id, unsubscribe);
}

function finishComponentJob(job: ComponentJob, announce: boolean) {
  jobSubscriptions.get(job.id)?.();
  jobSubscriptions.delete(job.id);
  const { [job.componentId]: _finished, ...remainingJobs } = componentJobs.value;
  componentJobs.value = remainingJobs;
  if (announce) {
    if (job.state === "completed") message.success(`${operationName(job.operation)}已完成`);
    else if (job.state === "cancelled") message.info("能力下载已取消；当前可用版本未受影响");
    else message.error(job.errorMessage || `${operationName(job.operation)}失败`);
  }
  void loadComponents();
}

async function cancelComponentJob(job: ComponentJob) {
  cancelingJobId.value = job.id;
  componentsError.value = "";
  componentsNotice.value = "";
  try {
    trackComponentJob(await componentApi.cancel(job.id));
  } catch (cause) {
    componentsError.value = formatApiError(cause, "取消下载失败");
  } finally {
    cancelingJobId.value = "";
  }
}

function formatInstallConditions(component: ComponentPackageStatus) {
  return component.installConditions.length ? ` 安装条件：${component.installConditions.join("；")}。` : "";
}

function operationName(operation: ComponentJob["operation"]) {
  return { install: "安装", reinstall: "重装", uninstall: "卸载" }[operation];
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

.storage-paths {
  display: grid;
  gap: 14px;
}

.settings-alert {
  margin-bottom: 16px;
}

.selected-source {
  color: #0f766e;
  font-weight: 700;
}
</style>
