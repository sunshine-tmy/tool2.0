<template>
  <ToolLayout>
    <section class="main-column data-backup-page">
      <ToolPageHeader
        title="数据备份与恢复"
        description="选择业务模块备份到文件，在另一台设备合并或替换恢复。"
        kicker="DESKTOP · DATA"
      />
      <n-button @click="$router.push('/settings')">返回桌面设置</n-button>
      <n-alert v-if="!bridge" type="info"
        >请在支持此功能的桌面客户端中操作。局域网网页不能导出或替换主机的全部业务数据。</n-alert
      >
      <template v-else>
        <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>
        <n-alert type="info"
          >包含所选模块的现存记录、媒体和关联数据。模型、运行环境、登录状态和私钥不包含在备份中；原有到期规则保持不变。快照及恢复期间会短暂暂停所有模块的后台服务。</n-alert
        >
        <section v-if="active" class="workspace-panel" aria-live="polite">
          <h3>{{ active.phase }}</h3>
          <p>
            {{ active.files }} / {{ active.totalFiles }} 个文件或记录
            <span v-if="active.totalBytes">
              · {{ formatBytes(active.bytes) }} / {{ formatBytes(active.totalBytes) }}</span
            >
          </p>
          <n-progress
            type="line"
            :percentage="
              active.totalBytes
                ? Math.min(100, Math.floor((active.bytes / active.totalBytes) * 100))
                : active.totalFiles
                  ? Math.min(100, Math.floor((active.files / active.totalFiles) * 100))
                  : 0
            "
          />
          <n-button :disabled="!active.cancelable" @click="cancel(active.id)">{{
            active.cancelable ? "取消操作" : "正在安全收尾，请等待"
          }}</n-button>
        </section>
        <section class="workspace-panel">
          <n-tabs v-model:value="tab" type="line">
            <n-tab-pane name="export" tab="导出数据">
              <h3>选择导出模块</h3>
              <n-checkbox-group v-model:value="exportModules" :disabled="busy">
                <div class="backup-module-grid">
                  <n-checkbox v-for="module in backupModules" :key="module.id" :value="module.id">{{
                    module.name
                  }}</n-checkbox>
                </div>
              </n-checkbox-group>
              <p>多媒体归档包含分组、发布标记、截帧、配乐、水印库和编辑方案；音频库包含回收站和播放预设。</p>
              <n-checkbox v-model:checked="includePreferences" :disabled="busy"
                >包含本机模块偏好（归档展示方式、音频分组和播放队列）</n-checkbox
              >
              <div class="backup-actions">
                <n-button
                  type="primary"
                  :disabled="busy || !exportModules.length"
                  :loading="pending"
                  @click="exportData"
                  >选择位置并导出</n-button
                >
              </div>
            </n-tab-pane>
            <n-tab-pane name="import" tab="导入数据">
              <n-space align="center"
                ><n-button :disabled="busy" :loading="pending" @click="selectFile">选择 ZIP 备份</n-button
                ><span>{{ selection?.displayName }}</span></n-space
              >
              <template v-if="selection?.selectionId">
                <h3>选择要恢复的模块</h3>
                <n-checkbox-group v-model:value="importModules" :disabled="busy">
                  <div class="backup-module-grid">
                    <n-checkbox v-for="module in selection.modules" :key="module.id" :value="module.id"
                      >{{ moduleName(module.id) }} · {{ module.records }} 条 ·
                      {{ formatBytes(module.bytes) }}</n-checkbox
                    >
                  </div>
                </n-checkbox-group>
                <n-radio-group v-model:value="mode" :disabled="busy" class="backup-actions">
                  <n-space
                    ><n-radio value="merge">合并：保留已有内容，添加缺少的数据</n-radio
                    ><n-radio value="replace">替换：恢复所选模块到备份状态</n-radio></n-space
                  >
                </n-radio-group>
                <n-button :disabled="busy || !importModules.length" :loading="pending" @click="inspect"
                  >预检数据与冲突</n-button
                >
              </template>
              <div v-if="preview" class="backup-preview">
                <h3>导入预览</h3>
                <p>
                  备份创建于 {{ date(preview.createdAt) }} · 应用 {{ preview.appVersion }} · 预计额外空间
                  {{ formatBytes(preview.requiredBytes) }}
                </p>
                <div class="backup-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>模块</th>
                        <th>当前记录</th>
                        <th>备份记录</th>
                        <th>新增</th>
                        <th>保留 / 跳过</th>
                        <th>重新编号冲突</th>
                        <th>已到期</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="module in preview.modules" :key="module.id">
                        <td>{{ moduleName(module.id) }}</td>
                        <td>{{ module.existing }}</td>
                        <td>{{ module.records }}</td>
                        <td>{{ module.added }}</td>
                        <td>{{ module.skipped }}</td>
                        <td>{{ module.conflicts }}</td>
                        <td>{{ module.expired }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <n-alert
                  v-for="warning in preview.warnings"
                  :key="warning"
                  :type="preview.mode === 'replace' ? 'warning' : 'info'"
                  >{{ warning }}</n-alert
                >
                <p>预检有效至 {{ date(preview.expiresAt) }}。数据或备份文件变化后需重新预检。</p>
                <n-button :type="mode === 'replace' ? 'error' : 'primary'" :disabled="busy" @click="restore"
                  >确认{{ mode === "replace" ? "替换" : "合并" }}导入</n-button
                >
              </div>
            </n-tab-pane>
          </n-tabs>
        </section>
        <section class="workspace-panel">
          <div class="panel-heading">
            <h3>导入前恢复点</h3>
            <n-button :disabled="pending" @click="refresh">刷新</n-button>
          </div>
          <p>恢复点保存在本设备，长期保留，需手动删除。回滚也会先保存当前状态。</p>
          <n-empty v-if="!state.restorePoints.length" description="暂无恢复点" />
          <div
            v-for="point in state.restorePoints.slice((pointsPage - 1) * 10, pointsPage * 10)"
            :key="point.id"
            class="backup-record"
          >
            <div>
              <strong>{{ point.problem ? "恢复点需要检查" : date(point.createdAt) }}</strong>
              <p>{{ point.problem || `${point.modules.map(moduleName).join("、")} · ${formatBytes(point.bytes)}` }}</p>
            </div>
            <n-space
              ><n-button :disabled="busy || Boolean(point.problem)" @click="rollback(point.id)">恢复到此状态</n-button
              ><n-button type="error" tertiary :disabled="busy" @click="deletePoint(point.id)"
                >删除恢复点</n-button
              ></n-space
            >
          </div>
          <nav v-if="state.restorePoints.length" class="backup-pagination" aria-label="恢复点分页">
            <span class="backup-pagination-total">共 {{ state.restorePoints.length }} 个恢复点</span>
            <n-pagination
              v-model:page="pointsPage"
              class="pagination-with-total"
              :page-size="10"
              :item-count="state.restorePoints.length"
            />
          </nav>
        </section>
        <section class="workspace-panel">
          <h3>操作记录</h3>
          <n-empty v-if="!state.operations.length" description="暂无操作记录" />
          <div
            v-for="operation in state.operations.slice((historyPage - 1) * 10, historyPage * 10)"
            :key="operation.id"
            class="backup-record"
          >
            <div>
              <strong
                >{{ { export: "导出", import: "导入", rollback: "回滚" }[operation.type] }} ·
                {{ operation.phase }}</strong
              >
              <p>
                {{ date(operation.startedAt) }} ·
                {{ operation.message || (operation.status === "completed" ? "已完成校验与保存" : "") }}
              </p>
              <small v-if="operation.restorePointId">已保留导入前恢复点</small>
            </div>
            <n-button
              v-if="operation.status === 'failed' || operation.status === 'canceled'"
              :disabled="busy"
              @click="tab = operation.type === 'export' ? 'export' : 'import'"
              >{{ operation.type === "export" ? "重新导出" : "重新选择并预检" }}</n-button
            >
          </div>
          <nav v-if="state.operations.length" class="backup-pagination" aria-label="操作记录分页">
            <span class="backup-pagination-total">共 {{ state.operations.length }} 条操作</span>
            <n-pagination
              v-model:page="historyPage"
              class="pagination-with-total"
              :page-size="10"
              :item-count="state.operations.length"
            />
          </nav>
        </section>
      </template>
    </section>
  </ToolLayout>
</template>
<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NEmpty,
  NPagination,
  NProgress,
  NRadio,
  NRadioGroup,
  NSpace,
  NTabPane,
  NTabs
} from "naive-ui";
import { backupModules } from "@toolbox/shared/system";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { formatBytesAdaptive as formatBytes } from "../../shared/utils/format-bytes";
import { useDataBackup } from "./useDataBackup";
const {
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
} = useDataBackup();
const moduleName = (id: string) => backupModules.find((m) => m.id === id)?.name ?? id;
const date = (value: string) => new Date(value).toLocaleString("zh-CN");
</script>
<style scoped>
.data-backup-page {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.backup-module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
  margin: 18px 0;
}
.backup-actions {
  display: block;
  margin: 20px 0;
}
.backup-preview {
  margin-top: 24px;
  display: grid;
  gap: 14px;
}
.backup-table-wrap {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
}
th,
td {
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid var(--border-color, #e4e8f0);
}
.backup-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color, #e4e8f0);
}
.backup-record p {
  margin: 6px 0;
  overflow-wrap: anywhere;
}
.backup-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 16px;
}
.backup-pagination-total {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}
</style>
