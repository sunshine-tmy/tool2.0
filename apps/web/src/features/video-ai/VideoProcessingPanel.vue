<template>
  <aside class="processing-panel" aria-label="视频处理设置">
    <section>
      <div class="section-heading">
        <div>
          <h2>修复设置</h2>
          <p>选择适合画面的修复方式</p>
        </div>
      </div>
      <div class="mode-grid" role="radiogroup" aria-label="修复档位">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          type="button"
          class="mode-card"
          :class="{ active: mode === option.value }"
          :disabled="busy || !engineAvailable(option.value)"
          @click="$emit('update:mode', option.value)"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ option.short }}</span>
        </button>
      </div>
      <div class="mode-detail" :class="{ unavailable: !engineAvailable(mode) }">
        <strong>{{ activeOption?.label }} · {{ activeOption?.engine }}</strong>
        <p>{{ activeHint }}</p>
        <RouterLink v-if="!engineAvailable(mode)" to="/settings?component=video-ai-cuda">前往能力管理</RouterLink>
      </div>
      <div v-if="unavailableOptions.length" class="availability-note">
        <span>{{ unavailableOptions.join("；") }}</span>
        <RouterLink to="/settings?component=video-ai-cuda">查看视频能力更新</RouterLink>
      </div>
    </section>

    <section>
      <div class="section-heading compact">
        <div>
          <h2>字幕区域</h2>
          <p>{{ regionSummary }}</p>
        </div>
      </div>
      <div class="region-actions">
        <n-button :disabled="!hasFile || busy" :loading="detecting" @click="$emit('detect')">自动检测字幕</n-button>
        <n-button
          :disabled="!hasFile || busy"
          :type="manualMode ? 'primary' : 'default'"
          @click="$emit('toggle-manual')"
        >
          {{ manualMode ? "完成框选" : "手动框选" }}
        </n-button>
        <n-button v-if="regionCount" :disabled="busy" @click="$emit('clear-regions')">清除</n-button>
      </div>
      <p v-if="detectionNotice" class="notice">{{ detectionNotice }}</p>
    </section>

    <section v-if="task" class="task-status">
      <div class="status-title">
        <strong>{{ phaseLabel }}</strong>
        <span>{{ displayProgress }}%</span>
      </div>
      <n-progress type="line" :percentage="progress" :show-indicator="false" />
      <p v-if="task.totalFrames">{{ task.processedFrames ?? 0 }} / {{ task.totalFrames }} 帧</p>
      <p v-else-if="task.status === 'pending'">任务已进入队列，等待本机处理服务接收。</p>
    </section>

    <div v-if="error" class="error-card" role="alert">
      <strong>{{ errorTitle }}</strong>
      <p>{{ error }}</p>
      <details>
        <summary>查看处理建议</summary>
        <span>{{ errorAdvice }}</span>
      </details>
    </div>

    <div v-if="warnings.length" class="warning-card">
      <strong>处理提示</strong>
      <ul>
        <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
      </ul>
    </div>

    <div v-if="task?.status === 'completed' && task.output" class="completed-card">
      <strong>处理完成</strong>
      <span>{{ task.output.width }} × {{ task.output.height }} · {{ formatBytes(task.output.bytes) }}</span>
      <n-button type="primary" tag="a" :href="outputUrl" target="_blank" rel="noopener">下载结果</n-button>
    </div>

    <div class="primary-actions">
      <n-button type="primary" size="large" block :disabled="!canSubmit" :loading="submitting" @click="$emit('submit')">
        开始处理
      </n-button>
      <n-button v-if="canCancel" block @click="$emit('cancel')">取消任务</n-button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NProgress } from "naive-ui";
import { RouterLink } from "vue-router";
import type { VideoAiMode, VideoAiTask } from "@toolbox/shared";

export interface VideoModeOption {
  value: VideoAiMode;
  label: string;
  engine: string;
  short: string;
  hint: string;
}

const props = defineProps<{
  mode: VideoAiMode;
  modeOptions: VideoModeOption[];
  availableModes: VideoAiMode[];
  unavailableReasons: Partial<Record<VideoAiMode, string>>;
  hasFile: boolean;
  busy: boolean;
  submitting: boolean;
  detecting: boolean;
  manualMode: boolean;
  regionCount: number;
  detectionNotice?: string;
  task?: VideoAiTask;
  progress: number;
  phaseLabel: string;
  error?: string;
  warnings: string[];
  outputUrl?: string;
  canSubmit: boolean;
  canCancel: boolean;
}>();

defineEmits<{
  "update:mode": [value: VideoAiMode];
  detect: [];
  "toggle-manual": [];
  "clear-regions": [];
  submit: [];
  cancel: [];
}>();

const activeOption = computed(() => props.modeOptions.find((option) => option.value === props.mode));
const activeHint = computed(() => {
  const reason = !engineAvailable(props.mode) ? props.unavailableReasons[props.mode] : "";
  return `${activeOption.value?.hint || ""}${reason ? ` 当前不可用：${reason}` : ""}`;
});
const unavailableOptions = computed(() =>
  props.modeOptions
    .filter((option) => !engineAvailable(option.value))
    .map((option) => `${option.label}不可用：${props.unavailableReasons[option.value] || "当前能力未提供该引擎"}`)
);
const displayProgress = computed(() => Number(props.progress.toFixed(1)).toString());
const regionSummary = computed(() => {
  if (props.manualMode) return "正在手动框选";
  if (!props.regionCount) return "尚未选择区域";
  return `已选择 ${props.regionCount} 处区域`;
});
const errorTitle = computed(() => {
  if (props.error?.includes("能力") || props.error?.includes("服务")) return "处理能力不可用";
  if (props.error?.includes("检测")) return "字幕检测失败";
  return "视频处理失败";
});
const errorAdvice = computed(() => {
  if (errorTitle.value === "处理能力不可用") return "请检查能力管理与运行诊断，确认本机处理服务已启动。";
  if (errorTitle.value === "字幕检测失败") return "可以重试自动检测，或改用手动框选后继续处理。";
  return "请保留当前记录并查看运行诊断；如需重试，请重新选择原视频。";
});

function engineAvailable(value: VideoAiMode) {
  return props.availableModes.includes(value);
}
function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
</script>

<style scoped>
.processing-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-subtle);
}
.processing-panel section + section {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.section-heading h2,
.section-heading p,
.mode-detail p,
.task-status p,
.error-card p {
  margin: 0;
}
.section-heading h2 {
  font-size: 16px;
}
.section-heading p,
.notice,
.task-status p,
.mode-card span,
.mode-detail p,
.completed-card span {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.section-heading {
  margin-bottom: var(--space-3);
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
.mode-card {
  display: flex;
  min-height: 58px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface);
  cursor: pointer;
}
.mode-card.active {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
  box-shadow: 0 0 0 1px var(--color-primary-100);
}
.mode-card:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
.mode-detail,
.error-card,
.warning-card,
.completed-card,
.task-status {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.mode-detail.unavailable,
.error-card {
  border: 1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-error) 6%, var(--color-surface));
}
.availability-note {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 12px;
}
.warning-card {
  border: 1px solid color-mix(in srgb, var(--color-warning) 35%, var(--color-border));
}
.warning-card ul {
  margin: 0;
  padding-left: 18px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.region-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.notice {
  margin: var(--space-2) 0 0;
}
.status-title,
.completed-card {
  align-items: flex-start;
}
.status-title {
  display: flex;
  justify-content: space-between;
}
.error-card details,
.error-card p {
  color: var(--color-error);
  font-size: 12px;
}
.error-card summary {
  cursor: pointer;
  color: var(--color-text-secondary);
}
.completed-card {
  border: 1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-border));
}
.primary-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: auto;
}
</style>
