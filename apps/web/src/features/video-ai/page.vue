<template>
  <ToolLayout>
    <section class="video-ai-page">
      <ToolPageHeader
        title="视频去字幕"
        kicker="VIDEO / SUBTITLE"
        description="自动检测并修复烧录在画面中的硬字幕，保留原分辨率与原音轨，全程在本机完成。"
      >
        <template #actions>
          <div class="health-card" :class="healthState">
            <span class="health-dot" aria-hidden="true"></span>
            <div>
              <strong>{{ healthTitle }}</strong>
              <span>{{ healthSummary }}</span>
            </div>
            <n-button text :loading="healthLoading" @click="refreshHealth">刷新</n-button>
          </div>
        </template>
      </ToolPageHeader>

      <n-alert v-if="capabilityError" type="warning" class="capability-alert">
        {{ capabilityError }}
        <RouterLink to="/settings?component=video-ai">前往能力管理</RouterLink>
      </n-alert>

      <section class="workspace-panel editor-panel">
        <div class="file-toolbar">
          <n-button type="primary" size="large" :disabled="busy" @click="fileInput?.click()">上传视频</n-button>
          <div class="file-copy">
            <strong>{{ file ? file.name : "选择需要去除硬字幕的视频" }}</strong>
            <span v-if="file">
              {{ formatBytes(file.size)
              }}<template v-if="mediaMetadata">
                · {{ mediaMetadata.width }}×{{ mediaMetadata.height }} ·
                {{ formatDuration(mediaMetadata.duration) }}</template
              >
            </span>
            <span v-else>支持 MP4 / MKV / AVI / MOV / WebM，单个最大 2 GiB</span>
          </div>
          <input
            ref="fileInput"
            class="file-input"
            type="file"
            accept=".mp4,.mkv,.avi,.mov,.webm,video/*"
            :disabled="busy"
            @change="onFileChange"
          />
        </div>

        <div v-if="inspectedTask" class="inspection-banner">
          <span>正在查看历史任务：{{ inspectedTask.inputName }}</span>
          <n-button v-if="activeTaskId" text @click="returnToActiveTask">返回当前任务</n-button>
        </div>

        <div class="editor-grid">
          <VideoWorkspace
            :src="displayPreviewUrl"
            :muted="sourceKind === 'original'"
            :source-kind="sourceKind"
            :show-source-switch="showSourceSwitch"
            :manual-mode="manualMode && !inspectedTask"
            :manual-area="draftRect"
            :segments="displaySegments"
            :manual-ranges="manualRanges"
            :duration="mediaMetadata?.duration || 0"
            :editable="!!file && !busy && !inspectedTask && sourceKind === 'original'"
            :width="displayWidth"
            :height="displayHeight"
            @update:manual-ranges="manualRanges = $event"
            @metadata="onMetadata"
            @update:manual-area="draftRect = $event"
            @change-source="sourceKind = $event"
          />

          <VideoProcessingPanel
            v-model:mode="mode"
            :mode-options="modeOptions"
            :available-modes="availableModes"
            :unavailable-reasons="unavailableReasons"
            :has-file="!!file"
            :busy="busy"
            :submitting="submitting"
            :detecting="detecting"
            :manual-mode="manualMode"
            :region-count="regionCount"
            :detection-notice="detectionNotice"
            :task="displayTask"
            :progress="displayProgress"
            :phase-label="phaseLabel"
            :error="displayError"
            :warnings="displayWarnings"
            :output-url="displayOutputUrl"
            :can-submit="canSubmit"
            :can-cancel="canCancelActiveTask"
            @detect="detectSubtitle"
            @toggle-manual="toggleManualMode"
            @clear-regions="clearRegions"
            @submit="submit"
            @cancel="cancelTask"
          />
        </div>
      </section>

      <VideoHistoryPanel
        :items="history"
        :total="historyTotal"
        :page="historyPage"
        :selected-id="displayTask?.id"
        :loading="historyLoading"
        :output-url="outputUrlOf"
        @refresh="refreshHistory"
        @view="openTask"
        @remove="removeItem"
        @update:page="historyPage = $event"
      />
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
/**
 * 中文模块说明：视频去字幕页面，集中协调文件、任务和历史状态，展示职责由子组件承担。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NAlert, NButton } from "naive-ui";
import { RouterLink } from "vue-router";
import type { VideoAiHealth, VideoAiMode, VideoAiRect, VideoAiSegment, VideoAiTask } from "@toolbox/shared";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { useTaskEvents } from "../../shared/composables/useTaskEvents";
import { videoAiApi } from "./api";
import VideoWorkspace from "./VideoWorkspace.vue";
import VideoProcessingPanel, { type VideoModeOption } from "./VideoProcessingPanel.vue";
import VideoHistoryPanel from "./VideoHistoryPanel.vue";

const modeOptions: VideoModeOption[] = [
  {
    value: "delogo",
    label: "极速",
    engine: "OpenCV",
    short: "像素修复",
    hint: "适合背景简单、字幕区域较小的画面；无需修复模型，但复杂纹理可能留下模糊痕迹。"
  },
  {
    value: "fast",
    label: "快速",
    engine: "Big-LaMa",
    short: "逐帧修复",
    hint: "适合静态背景；CPU 耗时较长，GPU 处理速度仍取决于视频分辨率与画面复杂度。"
  },
  {
    value: "balanced",
    label: "均衡",
    engine: "STTN",
    short: "时序修复",
    hint: "利用前后帧上下文减少闪烁，需要新版 GPU 扩展与可用的 NVIDIA CUDA。"
  },
  {
    value: "extreme",
    label: "极致",
    engine: "ProPainter",
    short: "光流修复",
    hint: "适合更复杂的动态画面；对显存、分辨率和修复区域大小有更严格要求。"
  }
];

const fileInput = ref<HTMLInputElement>();
const file = ref<File>();
const previewUrl = ref<string>();
const mediaMetadata = ref<{ width: number; height: number; duration: number }>();
const sourceKind = ref<"original" | "result">("original");
const mode = ref<VideoAiMode>("delogo");
const submitting = ref(false);
const detecting = ref(false);
const manualMode = ref(false);
const detectedSegments = ref<Array<VideoAiSegment & { confidence?: number }>>([]);
const draftRect = ref<VideoAiRect>();
const manualRanges = ref<import("@toolbox/shared").VideoAiTimedRegion[]>([]);
const detectionNotice = ref("");
const actionError = ref("");
const capabilityError = ref("");
const health = ref<VideoAiHealth>();
const healthLoading = ref(false);
const activeTaskId = ref<string>();
const activeTask = ref<VideoAiTask>();
const inspectedTask = ref<VideoAiTask>();
const history = ref<VideoAiTask[]>([]);
const historyPage = ref(1);
const historyTotal = ref(0);
const historyLoading = ref(false);
const scope = useRequestScope();
const confirm = useConfirmDialog();

const { task: liveTask } = useTaskEvents(activeTaskId);
const currentLiveTask = computed(() => (liveTask.value?.id === activeTaskId.value ? liveTask.value : undefined));
const busy = computed(
  () =>
    submitting.value ||
    detecting.value ||
    activeTask.value?.status === "pending" ||
    activeTask.value?.status === "running"
);
const displayTask = computed(() => inspectedTask.value ?? activeTask.value);
const displayTaskId = computed(() => displayTask.value?.id);
const displayOutputUrl = computed(() => (displayTaskId.value ? videoAiApi.outputUrl(displayTaskId.value) : ""));
const showSourceSwitch = computed(
  () => !!previewUrl.value && !!displayTask.value?.output && displayTask.value.status === "completed"
);
const displayPreviewUrl = computed(() => {
  if (sourceKind.value === "result" && displayTask.value?.output) return `${displayOutputUrl.value}?preview=1`;
  if (previewUrl.value && !inspectedTask.value) return previewUrl.value;
  if (displayTask.value?.output) return `${displayOutputUrl.value}?preview=1`;
  return undefined;
});
const displaySegments = computed(() => {
  if (sourceKind.value === "result") return [];
  return inspectedTask.value ? inspectedTask.value.segments : detectedSegments.value;
});
const displayWidth = computed(() =>
  sourceKind.value === "result" ? displayTask.value?.output?.width : mediaMetadata.value?.width
);
const displayHeight = computed(() =>
  sourceKind.value === "result" ? displayTask.value?.output?.height : mediaMetadata.value?.height
);
const regionCount = computed(() =>
  manualRanges.value.length
    ? manualRanges.value.reduce((sum, range) => sum + range.rects.length, 0)
    : draftRect.value
      ? 1
      : detectedSegments.value.length
);
const availableModes = computed(() =>
  modeOptions.filter((option) => engineAvailable(option.value)).map((option) => option.value)
);
const unavailableReasons = computed(
  () =>
    Object.fromEntries(
      modeOptions.map((option) => [
        option.value,
        health.value?.engines.find((engine) => engine.provider === option.value)?.reason || "当前能力未提供该引擎。"
      ])
    ) as Partial<Record<VideoAiMode, string>>
);
const canSubmit = computed(
  () =>
    !!file.value &&
    !busy.value &&
    !manualMode.value &&
    engineAvailable(mode.value) &&
    !inspectedTask.value &&
    manualRanges.value.every((range) => range.end > range.start && range.rects.length > 0)
);
const canCancelActiveTask = computed(
  () =>
    !inspectedTask.value &&
    !!activeTaskId.value &&
    (activeTask.value?.status === "pending" || activeTask.value?.status === "running")
);
const displayProgress = computed(() => {
  const progress = inspectedTask.value
    ? inspectedTask.value.progress
    : (currentLiveTask.value?.progress ?? activeTask.value?.progress ?? 0);
  return Math.min(100, Math.max(0, Number(progress.toFixed(1))));
});
const displayError = computed(
  () => actionError.value || (displayTask.value?.status === "failed" ? displayTask.value.error : "") || ""
);
const displayWarnings = computed(() => {
  const errorKey = normalizeMessage(displayError.value);
  return [...new Set(displayTask.value?.warnings ?? [])].filter((warning) => normalizeMessage(warning) !== errorKey);
});
const phaseLabel = computed(() => {
  const task = displayTask.value;
  const phase = !inspectedTask.value && currentLiveTask.value?.status === "pending" ? "queued" : task?.phase;
  const labels: Record<string, string> = {
    queued: "排队中",
    detecting: "检测字幕区域",
    loading: "正在加载修复模型",
    "estimating-flow": "估计连续帧光流",
    propagating: "补全光流与传播画面",
    repairing: "修复画面",
    muxing: "合成音视频",
    done: "已完成",
    failed: "已失败",
    canceled: "已取消"
  };
  return labels[phase || ""] || (task ? statusLabel(task.status) : "等待开始");
});
const healthState = computed(() =>
  capabilityError.value ? "warning" : health.value?.available ? "available" : "unknown"
);
const healthTitle = computed(() =>
  health.value?.available ? "处理服务可用" : capabilityError.value ? "能力需要处理" : "正在检查能力"
);
const healthSummary = computed(() => {
  if (!health.value) return "读取本机引擎状态";
  const count = health.value.engines.filter((engine) => engine.available).length;
  return `${count}/${modeOptions.length} 个修复档位可用`;
});

onMounted(async () => {
  await Promise.all([refreshHealth(), refreshHistory()]);
});

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

watch(
  () => [liveTask.value?.id, liveTask.value?.status, liveTask.value?.progress] as const,
  async () => {
    if (!activeTaskId.value || liveTask.value?.id !== activeTaskId.value) return;
    await loadActiveTask(activeTaskId.value);
  }
);

watch(historyPage, () => void refreshHistory());

async function refreshHealth() {
  healthLoading.value = true;
  capabilityError.value = "";
  try {
    const value = await videoAiApi.health(scope.signal);
    if (scope.aborted) return;
    health.value = value;
    if (!value.available) capabilityError.value = "视频去字幕能力尚未安装或未启用。";
  } catch (caught) {
    if (scope.aborted) return;
    capabilityError.value = caught instanceof Error ? caught.message : "无法读取视频处理能力状态";
  } finally {
    healthLoading.value = false;
  }
}

function engineAvailable(value: VideoAiMode) {
  return !!health.value?.engines.find((engine) => engine.provider === value)?.available;
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = "";
  if (!selected || busy.value) return;
  if (!/\.(mp4|mkv|avi|mov|webm)$/i.test(selected.name) || !selected.size || selected.size > 2 * 1024 ** 3) {
    actionError.value = "请选择非空视频，支持 MP4 / MKV / AVI / MOV / WebM，最大 2 GiB";
    return;
  }
  resetSelection();
  file.value = selected;
  previewUrl.value = URL.createObjectURL(selected);
  sourceKind.value = "original";
}

function onMetadata(value: { width: number; height: number; duration: number }) {
  if (sourceKind.value === "original") mediaMetadata.value = value;
}

async function detectSubtitle() {
  if (!file.value) return;
  detecting.value = true;
  actionError.value = "";
  detectionNotice.value = "";
  try {
    const detection = await videoAiApi.detect(file.value, scope.signal);
    if (scope.aborted) return;
    detectedSegments.value = detection.segments;
    manualRanges.value = [];
    draftRect.value = undefined;
    manualMode.value = false;
    detectionNotice.value = detection.warnings.length
      ? detection.warnings.join("；")
      : detection.segments.length
        ? `检测到 ${detection.segments.length} 处字幕区域（共 ${detection.frameCount} 帧，${detection.width}×${detection.height}）`
        : "未检测到字幕区域，可以改用手动框选";
    if (!detection.segments.length) manualMode.value = true;
  } catch (caught) {
    actionError.value = caught instanceof Error ? caught.message : "字幕区域检测失败";
  } finally {
    detecting.value = false;
  }
}

function toggleManualMode() {
  manualMode.value = !manualMode.value;
}

function clearRegions() {
  manualRanges.value = [];
  draftRect.value = undefined;
  detectedSegments.value = [];
  manualMode.value = false;
  detectionNotice.value = "";
}

async function submit() {
  if (!file.value || !canSubmit.value) return;
  submitting.value = true;
  actionError.value = "";
  inspectedTask.value = undefined;
  try {
    const created = await videoAiApi.create(
      {
        file: file.value,
        mode: mode.value,
        manualRanges: manualRanges.value.length ? manualRanges.value : undefined,
        manualArea: manualRanges.value.length ? undefined : draftRect.value,
        segments:
          manualRanges.value.length || draftRect.value
            ? undefined
            : detectedSegments.value.map(({ rect, startFrame, endFrame }) => ({ rect, startFrame, endFrame }))
      },
      scope.signal
    );
    if (scope.aborted) return;
    activeTaskId.value = created.id;
    activeTask.value = created;
    sourceKind.value = "original";
    await refreshHistory();
  } catch (caught) {
    actionError.value = caught instanceof Error ? caught.message : "提交任务失败";
  } finally {
    submitting.value = false;
  }
}

async function cancelTask() {
  if (!activeTaskId.value || inspectedTask.value) return;
  try {
    await videoAiApi.cancel(activeTaskId.value);
    await loadActiveTask(activeTaskId.value);
  } catch (caught) {
    actionError.value = caught instanceof Error ? caught.message : "取消任务失败";
  }
}

async function loadActiveTask(id: string) {
  const previousStatus = activeTask.value?.status;
  try {
    const task = await videoAiApi.get(id, scope.signal);
    if (scope.aborted || activeTaskId.value !== id) return;
    activeTask.value = task;
    if (task.status === "failed") actionError.value = task.error ?? "视频处理失败";
    if (task.status === "completed" && previousStatus !== "completed") sourceKind.value = "result";
    if (task.status !== previousStatus || ["completed", "failed", "canceled"].includes(task.status))
      await refreshHistory();
  } catch (caught) {
    actionError.value = caught instanceof Error ? caught.message : "读取任务状态失败";
  }
}

let historyRequest = 0;
async function refreshHistory() {
  const request = ++historyRequest;
  historyLoading.value = true;
  try {
    const page = await videoAiApi.history({ page: historyPage.value, pageSize: 20 }, scope.signal);
    if (scope.aborted || request !== historyRequest) return;
    history.value = page.items;
    historyTotal.value = page.total;
    if (!page.items.length && historyPage.value > 1) historyPage.value--;
  } catch {
    // 历史列表是辅助信息，不影响当前处理任务。
  } finally {
    if (request === historyRequest) historyLoading.value = false;
  }
}

async function removeItem(id: string) {
  if (!(await confirm("删除此处理记录和输出视频？原视频不受影响。", { title: "删除视频处理结果", danger: true })))
    return;
  try {
    await videoAiApi.remove(id);
    if (inspectedTask.value?.id === id) inspectedTask.value = undefined;
    if (activeTaskId.value === id) {
      activeTaskId.value = undefined;
      activeTask.value = undefined;
    }
    await refreshHistory();
  } catch (caught) {
    actionError.value = caught instanceof Error ? caught.message : "删除任务失败";
  }
}

async function openTask(id: string) {
  actionError.value = "";
  if (id === activeTaskId.value) {
    inspectedTask.value = undefined;
    sourceKind.value = activeTask.value?.output ? "result" : "original";
    if (activeTaskId.value) await loadActiveTask(activeTaskId.value);
    return;
  }
  try {
    const task = await videoAiApi.get(id, scope.signal);
    if (scope.aborted) return;
    inspectedTask.value = task;
    sourceKind.value = task.output ? "result" : "original";
  } catch (caught) {
    actionError.value = caught instanceof Error ? caught.message : "读取任务状态失败";
  }
}

function returnToActiveTask() {
  inspectedTask.value = undefined;
  sourceKind.value = activeTask.value?.output ? "result" : "original";
}

function outputUrlOf(id: string) {
  return videoAiApi.outputUrl(id);
}

function resetSelection() {
  manualRanges.value = [];
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = undefined;
  mediaMetadata.value = undefined;
  detectedSegments.value = [];
  draftRect.value = undefined;
  detectionNotice.value = "";
  activeTaskId.value = undefined;
  activeTask.value = undefined;
  inspectedTask.value = undefined;
  actionError.value = "";
  manualMode.value = false;
}

function normalizeMessage(message: string) {
  return message.trim().replace(/\s+/g, " ");
}

function statusLabel(status: VideoAiTask["status"]) {
  return { pending: "排队中", running: "处理中", completed: "已完成", failed: "已失败", canceled: "已取消" }[status];
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "时长未知";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
</script>

<style scoped>
.video-ai-page {
  grid-column: 1 / -1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.health-card {
  display: flex;
  min-width: 260px;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.health-card > div {
  display: flex;
  flex: 1;
  flex-direction: column;
}
.health-card strong {
  font-size: 13px;
}
.health-card span {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.health-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-text-tertiary);
}
.health-card.available {
  border-color: color-mix(in srgb, var(--color-success) 30%, var(--color-border));
}
.health-card.available .health-dot {
  background: var(--color-success);
}
.health-card.warning .health-dot {
  background: var(--color-warning);
}
.capability-alert {
  margin: 0;
}
.editor-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.file-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.file-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
  text-align: right;
}
.file-copy strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-copy span,
.inspection-banner {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.file-input {
  display: none;
}
.inspection-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-primary-50);
}
.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
  align-items: stretch;
  gap: var(--space-5);
}
@media (max-width: 980px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .health-card {
    min-width: 0;
    width: 100%;
  }
  .file-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .file-copy {
    align-items: flex-start;
    text-align: left;
  }
}
</style>
