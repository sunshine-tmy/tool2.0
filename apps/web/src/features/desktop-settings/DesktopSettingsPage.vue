<!-- 中文模块说明：桌面前端页面，负责桌面设置和受控的旧版数据迁移入口。 -->
<template>
  <ToolLayout>
    <section class="main-column desktop-settings-main">
      <ToolPageHeader
        title="桌面设置与数据迁移"
        :description="
          settings?.platform === 'darwin'
            ? 'macOS 应用数据保存在当前用户的 Application Support 目录，不随应用移动或替换。'
            : '程序安装位置与持久数据位置分开显示；桌面版的数据库、素材、能力、模型与登录状态保存在安装目录下的 data 文件夹。'
        "
        kicker="DESKTOP · STORAGE"
      />

      <section class="workspace-panel">
        <div class="panel-heading">
          <div>
            <h3>启动与环境诊断</h3>
            <p class="panel-description">查看服务、运行环境和能力状态；深度检查与恢复须手动确认。</p>
          </div>
          <n-button secondary @click="$router.push('/settings/diagnostics')">打开诊断</n-button>
        </div>
      </section>
      <n-alert v-if="!desktop" type="info" :bordered="false">
        此页面仅在桌面应用中提供。Web 开发模式不会读取或修改本机桌面设置。
      </n-alert>

      <template v-else>
        <section class="workspace-panel">
          <div class="panel-heading">
            <div>
              <h3>数据备份与恢复</h3>
              <p class="panel-description">按模块导出完整业务数据，在另一台设备合并或替换导入；保留导入前恢复点。</p>
            </div>
            <n-button secondary @click="$router.push('/settings/data-backup')">打开数据备份</n-button>
          </div>
        </section>
        <section class="workspace-panel"><DesktopLanAccess mode="panel" /></section>
        <input
          ref="offlineArchiveInput"
          class="offline-archive-input"
          type="file"
          accept=".tar.gz,application/gzip,application/x-gzip"
          multiple
          @change="handleOfflineArchiveSelection"
        />
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
              <n-button
                tertiary
                :loading="checkingUpdates"
                :disabled="loading || !settings?.updateChecksSupported"
                @click="checkForUpdates"
                >检查更新</n-button
              >
            </n-space>
          </div>
          <n-space vertical :size="18">
            <n-space justify="space-between" align="center">
              <div>
                <strong>{{ settings?.platform === "darwin" ? "登录 macOS 后启动" : "登录 Windows 后启动" }}</strong>
                <p class="setting-copy">仅设置当前用户的登录项。</p>
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
                <p class="setting-copy">
                  {{
                    settings?.updateChecksSupported
                      ? "默认开启；下载完成后会询问是否重启安装。"
                      : "内部测试版尚未配置 macOS 更新源，此功能暂不可用。"
                  }}
                </p>
              </div>
              <n-switch
                :value="settings?.automaticUpdateChecks"
                :disabled="saving || loading || !settings?.updateChecksSupported"
                @update:value="saveAutomaticUpdateChecks"
              />
            </n-space>
          </n-space>
        </section>

        <section class="workspace-panel">
          <div class="panel-heading">
            <div>
              <h3>存储位置</h3>
              <p class="panel-description">
                {{
                  settings?.platform === "darwin"
                    ? "macOS 应用包本身只读；持久数据放在当前用户的应用支持目录，替换应用时会保留。"
                    : "应用管理的持久数据默认跟随本次选择的安装目录；卸载时默认保留。"
                }}
              </p>
            </div>
            <n-button secondary :disabled="loading" @click="revealDataDirectory">
              {{ settings?.platform === "darwin" ? "在 Finder 中打开" : "在资源管理器中打开" }}
            </n-button>
          </div>
          <div v-if="settings" class="storage-paths">
            <div>
              <p class="setting-copy">安装目录</p>
              <n-code :code="settings.installDirectory" language="text" word-wrap />
            </div>
            <div>
              <p class="setting-copy">完整数据目录</p>
              <n-code :code="settings.dataDirectory" language="text" word-wrap />
              <p class="setting-copy">{{ settings.dataDirectoryDescription }}</p>
            </div>
          </div>
        </section>

        <section class="workspace-panel cleanup-panel">
          <div class="panel-heading">
            <div>
              <h3>存储清理</h3>
              <p class="panel-description">仅清理超过保留期限的日志和临时文件，清单默认不勾选。</p>
            </div>
            <n-button secondary :loading="cleanupLoading" @click="loadCleanup">重新统计</n-button>
          </div>
          <n-alert type="info" :bordered="false" class="cleanup-scope">
            不会清理作品、历史任务、个人素材、数据库、已安装能力、模型、配置、浏览器登录状态或备份。清理前需要连续确认两次。
          </n-alert>
          <n-alert v-if="cleanupError" type="error" :bordered="false" class="settings-alert">
            {{ cleanupError }}
          </n-alert>
          <n-spin v-if="cleanupLoading && !cleanupCategories.length" />
          <template v-else>
            <n-checkbox-group v-if="cleanupCategories.length" v-model:value="selectedCleanupIds" class="cleanup-list">
              <n-checkbox v-for="category in cleanupCategories" :key="category.id" :value="category.id">
                <span class="cleanup-option">
                  <span>{{ category.label }}</span>
                  <small>{{ formatBytes(category.bytes) }} · {{ category.files }} 个过期文件</small>
                </span>
              </n-checkbox>
            </n-checkbox-group>
            <n-empty v-else-if="!cleanupError" description="当前没有超过保留期限的可清理文件" />
          </template>
          <div class="cleanup-total">
            <span>预计释放</span><strong>{{ formatBytes(cleanupSelectedBytes) }}</strong>
          </div>
          <n-button
            type="error"
            secondary
            :loading="cleanupExecuting"
            :disabled="!cleanupSelectedFileCount || cleanupLoading || Boolean(cleanupError)"
            @click="executeCleanup"
            >清理所选内容</n-button
          >
        </section>

        <section id="capability-management" class="workspace-panel capability-panel">
          <div class="panel-heading">
            <div>
              <h3>能力管理</h3>
              <p class="panel-description">
                按需在线安装或从本地导入运行时与模型。离线包仍会按内置签名目录校验；安装失败不会替换可用版本。离线导入请从可信发布页下载卡片所列的全部同版本归档文件。
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
                    :id="`capability-${component.id}`"
                    :key="component.id"
                    :component="component"
                    :job="componentJobs[component.id]"
                    :canceling="cancelingJobId === componentJobs[component.id]?.id"
                    :operation-loading="startingComponentId === component.id"
                    :offline-uploading="offlineUpload?.componentId === component.id"
                    :offline-upload-progress="offlineUpload?.componentId === component.id ? offlineUpload.progress : 0"
                    @install="installComponent"
                    @reinstall="reinstallComponent"
                    @uninstall="uninstallComponent"
                    @offline-import="selectOfflineImport"
                    @cancel-offline-import="cancelOfflineImport"
                    @cancel="cancelComponentJob"
                  />
                </div>
              </section>
            </template>
            <n-alert v-else type="info" :bordered="false">
              当前版本尚未配置固定版本、内部包源和受信任签名的能力资产；完成这些工程配置后，可安装能力会显示在这里。来源说明仅供参考，不作为内部使用门槛。
            </n-alert>
          </template>
          <p class="setting-copy capability-retention-note">
            卸载只移除该能力的运行时、依赖和模型，不删除作品、历史任务、个人素材或登录状态；被其他已安装能力依赖的共享组件必须先解除依赖。
          </p>
        </section>

        <section v-if="settings?.platform === 'win32'" class="workspace-panel">
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
import { onMounted } from "vue";
import { NAlert, NButton, NCheckbox, NCheckboxGroup, NCode, NEmpty, NSpin, NSpace, NSwitch } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import DesktopLanAccess from "../../integrations/desktop/DesktopLanAccess.vue";
import DesktopComponentCard from "./DesktopComponentCard.vue";
import { formatBytesThroughGb as formatBytes } from "../../shared/utils/format-bytes";
import { formatDate, migrationStatusLabel } from "./presentation";
import { useDesktopPreferences } from "./useDesktopPreferences";
import { useDesktopCapabilities } from "./useDesktopCapabilities";
import { useDesktopCleanup } from "./useDesktopCleanup";
const {
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
} = useDesktopPreferences();
const {
  offlineArchiveInput,
  offlineUpload,
  components,
  componentJobs,
  componentsLoading,
  componentsError,
  componentsNotice,
  startingComponentId,
  cancelingJobId,
  componentGroups,
  componentTotalLabel,
  loadComponents,
  installComponent,
  reinstallComponent,
  selectOfflineImport,
  handleOfflineArchiveSelection,
  cancelOfflineImport,
  uninstallComponent,
  cancelComponentJob
} = useDesktopCapabilities();
const {
  cleanupCategories,
  selectedCleanupIds,
  cleanupLoading,
  cleanupExecuting,
  cleanupError,
  cleanupSelectedBytes,
  cleanupSelectedFileCount,
  loadCleanup,
  executeCleanup
} = useDesktopCleanup();
onMounted(() => {
  void loadSettings();
  void loadComponents();
  void loadCleanup();
});
</script>

<style scoped>
.desktop-settings-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

/* 隐藏的上传控件和条件提示不能影响卡片间距，也不叠加全局相邻卡片的 margin。 */
.desktop-settings-main > .workspace-panel,
.desktop-settings-main > .settings-alert {
  margin: 0;
}

.desktop-settings-main > :deep(.tool-page-header) {
  margin-bottom: var(--space-1, 4px);
}

.desktop-settings-main > .workspace-panel > .panel-heading:only-child {
  margin-bottom: 0;
}

.offline-archive-input {
  display: none;
}

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

.cleanup-scope {
  margin-bottom: 16px;
}

.cleanup-list {
  display: grid;
  gap: 4px;
  margin: 16px 0;
}

.cleanup-list :deep(.n-checkbox) {
  align-items: flex-start;
  padding: 8px 0;
}

.cleanup-option {
  display: grid;
  gap: 3px;
}

.cleanup-option small {
  color: #64748b;
}

.cleanup-total {
  display: flex;
  justify-content: space-between;
  margin: 16px 0 12px;
  color: #64748b;
}

.cleanup-total strong {
  color: #243047;
}

.settings-alert {
  margin-bottom: 16px;
}

.selected-source {
  color: #0f766e;
  font-weight: 700;
}
</style>
