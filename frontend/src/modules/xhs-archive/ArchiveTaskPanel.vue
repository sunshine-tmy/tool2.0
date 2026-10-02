<!-- 中文模块说明：小红书归档前端模块，负责列表、详情、媒体和翻译交互 -->
<template>
  <section class="workspace-panel fetch-panel">
    <div class="input-row">
      <n-input
        v-model:value="inputUrl"
        size="large"
        clearable
        placeholder="直接按 Ctrl+V / Command+V 粘贴小红书或抖音作品分享文案"
        @keyup.enter="submit"
      />
      <n-button
        size="large"
        type="primary"
        :loading="submitting || task?.status === 'running' || task?.status === 'pending'"
        :disabled="!canSubmit"
        @click="submit"
      >
        <template #icon><Archive :size="16" /></template>
        获取并存档
      </n-button>
    </div>
    <div class="platform-row">
      <span>来源平台</span>
      <n-select v-model:value="platform" :options="platformOptions" aria-label="归档来源平台" style="width: 160px" />
      <span
        v-if="inputUrl.trim()"
        class="platform-hint"
        :class="{
          warning: !link.ok || (link.platform === 'douyin' && !douyinAvailable && !douyinCanAutoInstall)
        }"
      >
        {{ linkHint }}
      </span>
    </div>

    <div v-if="task" class="task-progress">
      <div class="task-head">
        <div class="task-status">
          <span
            class="task-status-dot"
            :class="{ failed: task.status === 'failed', completed: task.status === 'completed' }"
          />
          <div>
            <small>{{ taskStatusLabel }}</small>
            <strong>{{ task.message }}</strong>
          </div>
        </div>
        <span class="task-percentage">{{ task.progress }}%</span>
      </div>
      <n-progress
        type="line"
        :percentage="task.progress"
        :status="task.status === 'failed' ? 'error' : task.status === 'completed' ? 'success' : 'default'"
        :show-indicator="false"
        :height="8"
        :border-radius="4"
        rail-color="#e6ebf2"
      />
      <div class="stage-list">
        <div v-for="stage in stages" :key="stage.key" class="stage-step" :class="stageClass(stage.key)">
          <span class="stage-marker">
            <Check v-if="stageClass(stage.key).complete" :size="16" :stroke-width="2.6" />
            <component :is="stage.icon" v-else :size="16" />
          </span>
          <span class="stage-label">{{ stage.label }}</span>
        </div>
      </div>
      <div v-if="activeTask" class="task-actions">
        <span v-if="task?.stage === 'archiving'" class="task-commit-note">正在安全提交归档，暂不可取消</span>
        <n-button
          v-else
          size="small"
          type="warning"
          secondary
          :loading="cancelling"
          :disabled="cancelling"
          @click="emit('cancel')"
        >
          {{ cancelling ? "正在取消…" : "取消获取" }}
        </n-button>
      </div>
      <div v-if="task.status === 'failed'" class="task-error">
        <span>{{ task.error }}</span>
        <n-button
          v-if="
            task.platform === 'xiaohongshu' &&
            ['XHS_AUTH_REQUIRED', 'ARCHIVE_AUTH_REQUIRED'].includes(task.errorCode || '')
          "
          type="warning"
          size="small"
          :loading="authWaiting"
          @click="$emit('login')"
        >
          登录小红书并重试
        </n-button>
        <n-button v-else size="small" :disabled="!canSubmit" @click="submit">重新尝试</n-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NInput, NProgress, NSelect } from "naive-ui";
import { Archive, Box, Check, Download, FileSearch, HardDriveDownload } from "lucide-vue-next";
import {
  identifyArchiveLink,
  type ArchivePlatformSelection,
  type ContentArchiveTask,
  type XhsArchiveTaskStage
} from "@toolbox/shared";

const props = defineProps<{
  task?: ContentArchiveTask;
  submitting?: boolean;
  cancelling?: boolean;
  douyinAvailable?: boolean;
  douyinCanAutoInstall?: boolean;
  douyinMessage?: string;
  authWaiting: boolean;
}>();

const emit = defineEmits<{
  submit: [];
  login: [];
  cancel: [];
}>();

const inputUrl = defineModel<string>("inputUrl", { required: true });
const platform = defineModel<ArchivePlatformSelection>("platform", { default: "auto" });
const platformOptions = [
  { label: "自动识别", value: "auto" },
  { label: "小红书", value: "xiaohongshu" },
  { label: "抖音", value: "douyin" }
];
const link = computed(() => identifyArchiveLink(inputUrl.value, platform.value));
const linkHint = computed(() =>
  !link.value.ok
    ? link.value.message
    : link.value.platform === "douyin"
      ? props.douyinAvailable
        ? "已识别：抖音。仅归档公开可访问作品，不使用登录 Cookie。"
        : props.douyinCanAutoInstall
          ? "已识别：抖音。首次获取时将自动安装并校验匿名归档能力，仅处理公开可访问作品。"
          : `已识别：抖音。${props.douyinMessage || "抖音归档能力尚未就绪，请刷新环境状态。"}`
      : "已识别：小红书"
);
const canSubmit = computed(
  () =>
    link.value.ok &&
    (link.value.platform === "xiaohongshu" || props.douyinAvailable === true || props.douyinCanAutoInstall === true) &&
    !props.submitting &&
    !props.authWaiting &&
    !["running", "pending"].includes(props.task?.status || "")
);
const activeTask = computed(() => ["running", "pending"].includes(props.task?.status || ""));

function submit() {
  // 按钮、回车和失败重试共用门禁，避免绕过平台校验或重复创建正在执行的任务。
  if (canSubmit.value) emit("submit");
}
const stages: Array<{ key: XhsArchiveTaskStage; label: string; icon: unknown }> = [
  { key: "installing", label: "准备解析环境", icon: HardDriveDownload },
  { key: "parsing", label: "链接解析", icon: FileSearch },
  { key: "downloading", label: "媒体下载", icon: Download },
  { key: "archiving", label: "写入存档", icon: Box }
];
const stageOrder: XhsArchiveTaskStage[] = ["installing", "parsing", "downloading", "archiving", "completed"];

const taskStatusLabel = computed(() => {
  if (props.task?.status === "failed") return "处理失败";
  if (props.task?.status === "completed") return "处理完成";
  return "正在处理";
});

function stageClass(stage: XhsArchiveTaskStage) {
  if (!props.task) return {};
  const active = props.task.stage === stage;
  const complete =
    props.task.status === "completed" || stageOrder.indexOf(props.task.stage) > stageOrder.indexOf(stage);
  return { active, complete };
}
</script>

<style scoped>
.fetch-panel {
  padding: 22px;
}
.platform-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  color: #64748b;
  font-size: 13px;
}
.platform-hint.warning {
  color: #b45309;
}
.input-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.input-row .n-input {
  flex: 1;
}
.task-progress {
  margin-top: 20px;
  padding: 20px 22px 18px;
  border: 1px solid #e5eaf1;
  border-radius: 16px;
  background: linear-gradient(145deg, #ffffff 0%, #f7f9fc 100%);
  box-shadow: 0 8px 24px rgba(40, 57, 86, 0.06);
}
.task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.task-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}
.task-status > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.task-status small {
  color: #8a94a6;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.task-status strong {
  overflow: hidden;
  color: #263247;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-status-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border: 3px solid #dbeafe;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
}
.task-status-dot.completed {
  border-color: #d1fae5;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.08);
}
.task-status-dot.failed {
  border-color: #fee2e2;
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.08);
}
.task-percentage {
  flex: 0 0 auto;
  padding: 5px 9px;
  color: #516078;
  border: 1px solid #e1e7ef;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.task-progress :deep(.n-progress-graph-line-fill) {
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.24);
}
.stage-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(90px, 1fr));
  margin-top: 18px;
  overflow-x: auto;
  padding: 2px 2px 4px;
}
.stage-step {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #8a94a6;
  font-size: 12px;
  text-align: center;
}
.stage-step:not(:last-child)::after {
  position: absolute;
  z-index: 0;
  top: 16px;
  left: calc(50% + 20px);
  width: calc(100% - 40px);
  height: 2px;
  border-radius: 999px;
  background: #dfe5ed;
  content: "";
}
.stage-marker {
  position: relative;
  z-index: 1;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 2px solid #dfe5ed;
  border-radius: 50%;
  background: #fff;
  transition: 0.2s ease;
}
.stage-label {
  white-space: nowrap;
}
.stage-step.active {
  color: #2563eb;
  font-weight: 600;
}
.stage-step.active .stage-marker {
  color: #fff;
  border-color: #2563eb;
  background: #2563eb;
  box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.1);
}
.stage-step.complete {
  color: #0f9f7f;
}
.stage-step.complete .stage-marker {
  color: #fff;
  border-color: #10b981;
  background: #10b981;
}
.stage-step.complete:not(:last-child)::after {
  background: #6ee7c1;
}
.task-error {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-top: 14px;
  color: #d03050;
}
.task-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.task-commit-note {
  color: #8a94a6;
  font-size: 12px;
}
@media (max-width: 640px) {
  .input-row {
    flex-wrap: wrap;
  }
  .input-row .n-input {
    flex-basis: 100%;
  }
  .stage-list {
    grid-template-columns: repeat(4, minmax(88px, 1fr));
  }
  .fetch-panel {
    padding: 16px;
  }
}
</style>
