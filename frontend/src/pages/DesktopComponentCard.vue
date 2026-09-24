<!-- 中文模块说明：桌面设置组件，负责 展示单个受审核能力包状态和安全管理操作。 -->
<template>
  <n-card size="small" class="component-card">
    <div class="component-card-heading">
      <div>
        <div class="component-title-row">
          <h4>{{ component.displayName }}</h4>
          <n-tag size="small" :type="statusType">{{ statusLabel }}</n-tag>
          <n-tag v-if="component.health === 'unhealthy'" size="small" type="error">自检异常</n-tag>
        </div>
        <p class="component-purpose">{{ component.purpose }}</p>
      </div>
      <n-space>
        <n-button
          v-if="!component.installed"
          type="primary"
          size="small"
          :disabled="busy || component.state === 'blocked'"
          :loading="operationLoading"
          @click="$emit('install', component)"
        >
          <template #icon><Download :size="15" /></template>安装
        </n-button>
        <n-button
          v-else
          size="small"
          :disabled="busy"
          :loading="operationLoading"
          @click="$emit('reinstall', component)"
        >
          <template #icon><RefreshCw :size="15" /></template>重装
        </n-button>
        <n-button
          v-if="component.installed"
          size="small"
          type="error"
          secondary
          :disabled="busy || component.dependentIds.length > 0"
          :loading="operationLoading"
          :title="component.dependentIds.length ? `被 ${component.dependentIds.join('、')} 依赖` : undefined"
          @click="$emit('uninstall', component)"
        >
          <template #icon><Trash2 :size="15" /></template>卸载
        </n-button>
        <n-button
          v-if="job?.state === 'running' && job.phase === 'downloading'"
          size="small"
          quaternary
          :loading="canceling"
          @click="$emit('cancel', job)"
        >
          取消下载
        </n-button>
      </n-space>
    </div>

    <div class="component-facts">
      <span>版本 {{ component.installedVersion || component.version }}</span>
      <span>下载 {{ formatBytes(component.downloadBytes) }}</span>
      <span>安装后约 {{ formatBytes(component.installedBytes) }}</span>
      <a v-if="component.licenseUrl" :href="component.licenseUrl" target="_blank" rel="noreferrer">
        许可信息：{{ component.licenseName }}
      </a>
      <span v-else>{{ component.licenseName }}</span>
    </div>

    <p v-if="component.dependencyIds.length" class="component-note">依赖：{{ component.dependencyIds.join("、") }}</p>
    <p v-if="component.dependentIds.length" class="component-note">
      被其他能力依赖：{{ component.dependentIds.join("、") }}；请先卸载依赖它的能力。
    </p>
    <p v-if="component.installConditions.length" class="component-note">
      安装条件：{{ component.installConditions.join("；") }}
    </p>
    <n-alert v-if="component.blockedReason" type="warning" :bordered="false" class="component-message">
      {{ component.blockedReason }}
    </n-alert>
    <n-alert v-if="component.failureReason" type="error" :bordered="false" class="component-message">
      {{ component.failureReason }}
    </n-alert>

    <div v-if="job" class="component-job" aria-live="polite">
      <div class="component-job-heading">
        <strong>{{ operationLabel(job.operation) }} · {{ phaseLabel(job.phase) }}</strong>
        <span>{{ job.progress.percentage }}%</span>
      </div>
      <n-progress
        type="line"
        :percentage="job.progress.percentage"
        :show-indicator="false"
        :status="job.state === 'failed' ? 'error' : 'default'"
      />
      <p v-if="job.phase === 'downloading'" class="component-note">
        {{ formatBytes(job.progress.downloadedBytes) }} / {{ formatBytes(job.progress.totalDownloadBytes) }}
      </p>
      <n-alert v-if="job.errorMessage" type="error" :bordered="false" class="component-message">
        {{ job.errorMessage }} <span v-if="job.errorCode">({{ job.errorCode }})</span>
      </n-alert>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NAlert, NButton, NCard, NProgress, NSpace, NTag } from "naive-ui";
import { Download, RefreshCw, Trash2 } from "lucide-vue-next";
import type { ComponentJob, ComponentPackageStatus } from "@toolbox/shared";

const props = defineProps<{
  component: ComponentPackageStatus;
  job?: ComponentJob;
  canceling?: boolean;
  operationLoading?: boolean;
}>();

defineEmits<{
  install: [component: ComponentPackageStatus];
  reinstall: [component: ComponentPackageStatus];
  uninstall: [component: ComponentPackageStatus];
  cancel: [job: ComponentJob];
}>();

const busy = computed(
  () =>
    props.operationLoading ||
    ["downloading", "installing"].includes(props.component.state) ||
    Boolean(props.job && ["queued", "running"].includes(props.job.state))
);
const statusLabel = computed(() => {
  if (props.job?.state === "queued") return "等待中";
  if (props.job?.state === "running") return props.job.phase === "downloading" ? "下载中" : "安装处理中";
  if (props.component.state === "ready") return props.component.health === "healthy" ? "健康可用" : "已安装";
  return {
    "not-installed": "未安装",
    downloading: "下载中",
    installing: "安装处理中",
    ready: "已安装",
    failed: "安装失败",
    blocked: "依赖未满足"
  }[props.component.state];
});
const statusType = computed(() => {
  if (props.job?.state === "failed" || props.component.state === "failed" || props.component.health === "unhealthy")
    return "error";
  if (props.component.state === "blocked" || (props.component.installed && props.component.health === "unknown"))
    return "warning";
  return props.component.health === "healthy" ? "success" : "default";
});

function operationLabel(operation: ComponentJob["operation"]) {
  return { install: "安装", reinstall: "重装", uninstall: "卸载" }[operation];
}

function phaseLabel(phase: ComponentJob["phase"]) {
  return {
    queued: "排队中",
    downloading: "下载中",
    verifying: "完整性校验",
    extracting: "解包中",
    "building-python": "构建运行环境",
    "self-test": "安装后自检",
    switching: "切换版本",
    uninstalling: "卸载中",
    complete: "完成"
  }[phase];
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
</script>

<style scoped>
.component-card-heading,
.component-title-row,
.component-facts,
.component-job-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.component-card-heading {
  align-items: flex-start;
}

.component-title-row {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.component-title-row h4 {
  margin: 0;
  font-size: 15px;
}

.component-purpose,
.component-note {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.component-facts {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 14px;
  color: #64748b;
  font-size: 12px;
}

.component-facts a {
  color: #2563eb;
}

.component-message {
  margin-top: 10px;
}

.component-job {
  margin-top: 14px;
}

.component-job-heading {
  margin-bottom: 8px;
  font-size: 12px;
}

@media (max-width: 640px) {
  .component-card-heading {
    flex-direction: column;
  }
}
</style>
