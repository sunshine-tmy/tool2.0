<template>
  <ToolLayout>
    <section class="video-ai-page v2-tool-page">
      <ToolPageHeader
        title="视频去字幕"
        kicker="VIDEO / SUBTITLE"
        description="自动检测并修复烧录在画面中的硬字幕，保留原分辨率与原音轨，全程在本机完成。"
        compact-actions
      >
        <template #actions>
          <ServiceStatusPopover
            :status="healthIndicator"
            :title="healthTitle"
            :summary="healthSummary"
            :loading="healthLoading"
            @refresh="refreshHealth"
          />
        </template>
      </ToolPageHeader>

      <n-alert v-if="capabilityError" :type="healthRecovering ? 'info' : 'warning'" class="capability-alert">
        {{ capabilityError }}
        <RouterLink v-if="!healthRecovering" to="/settings?component=video-ai">前往能力管理</RouterLink>
      </n-alert>

      <section class="video-editor-workbench">
        <div v-if="editingTask" class="inspection-banner">
          正在编辑{{ editingSource === "original" ? "留档原视频" : "处理后的视频" }}：{{
            editingTask.inputName
          }}。已恢复编辑信息，可调整或清除后重新框选；处理后新增记录，原视频和旧结果均保留。
        </div>
        <div v-if="inspectedTask" class="inspection-banner">
          <span>正在查看历史任务：{{ inspectedTask.inputName }}</span>
          <n-button v-if="activeTaskId" text @click="returnToActiveTask">返回当前任务</n-button>
        </div>
        <div class="editor-grid">
          <section class="workspace-panel video-preview-panel">
            <div class="file-toolbar">
              <n-button type="primary" size="large" :disabled="busy" @click="fileInput?.click()"
                ><template #icon><Upload :size="18" /></template>上传视频</n-button
              >
              <div class="file-copy">
                <strong>{{ inputName || "选择需要去除硬字幕的视频" }}</strong>
                <span v-if="hasInput">
                  {{
                    formatBytes(
                      file?.size ??
                        (editingSource === "original" ? editingTask?.inputBytes : editingTask?.output?.bytes) ??
                        0
                    )
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
            <VideoWorkspace
              ref="workspace"
              :key="previewUrl"
              :src="displayPreviewUrl"
              :muted="sourceKind === 'original'"
              :source-kind="sourceKind"
              :show-source-switch="showSourceSwitch"
              :manual-mode="manualMode && !inspectedTask"
              :manual-area="inspectedTask ? inspectedTask.manualArea : draftRect"
              :segments="displaySegments"
              :manual-ranges="inspectedTask ? inspectedTask.manualRanges || [] : manualRanges"
              :duration="displayDuration"
              :editable="hasInput && !busy && !inspectedTask && sourceKind === 'original'"
              :width="displayWidth"
              :height="displayHeight"
              @update:manual-ranges="manualRanges = $event"
              @metadata="onMetadata"
              @update:manual-area="draftRect = $event"
              @change-source="sourceKind = $event"
            />
          </section>
          <VideoProcessingPanel
            v-model:mode="mode"
            :checking="healthRecovering || (healthLoading && !health)"
            :mode-options="modeOptions"
            :available-modes="availableModes"
            :unavailable-reasons="unavailableReasons"
            :has-file="hasInput && !inspectedTask"
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
        :selected-id="displayTask?.id || editingTask?.id"
        :loading="historyLoading"
        :output-url="outputUrlOf"
        :editing-disabled="busy"
        :editing-id="editingTask?.id"
        @refresh="refreshHistory"
        @view="openTask"
        @edit="editTask"
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
import { Upload } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NAlert, NButton } from "naive-ui";
import { RouterLink } from "vue-router";
import type { VideoAiMode, VideoAiRect, VideoAiSegment, VideoAiTask } from "@toolbox/shared";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import ServiceStatusPopover from "../../shared/ui/tool/ServiceStatusPopover.vue";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { useTaskEvents } from "../../shared/composables/useTaskEvents";
import { videoAiApi } from "./api";
import VideoWorkspace from "./VideoWorkspace.vue";
import VideoProcessingPanel, { type VideoModeOption } from "./VideoProcessingPanel.vue";
import VideoHistoryPanel from "./VideoHistoryPanel.vue";
import { segmentsToTimelineRanges } from "./timeline";
import { useVideoHealth } from "./useVideoHealth";

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
const workspace = ref<InstanceType<typeof VideoWorkspace>>();
const file = ref<File>();
const editingTask = ref<VideoAiTask>();
const editingSource = ref<"original" | "output">("output");
const editingLoading = ref(false);
const hasInput = computed(() => !!file.value || !!editingTask.value);
const inputName = computed(() => file.value?.name || editingTask.value?.inputName);
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
const { health, healthLoading, healthRecovering, capabilityError, refreshHealth } = useVideoHealth();
const activeTaskId = ref<string>();
const activeTask = ref<VideoAiTask>();
const inspectedTask = ref<VideoAiTask>();
const history = ref<VideoAiTask[]>([]);
const historyPage = ref(1);
const historyTotal = ref(0);
const historyLoading = ref(false);
const scope = useRequestScope();
const confirm = useConfirmDialog();
let editorRequest = 0;

const { task: liveTask } = useTaskEvents(activeTaskId);
const currentLiveTask = computed(() => (liveTask.value?.id === activeTaskId.value ? liveTask.value : undefined));
const busy = computed(
  () =>
    submitting.value ||
    editingLoading.value ||
    detecting.value ||
    activeTask.value?.status === "pending" ||
    activeTask.value?.status === "running"
);
const displayTask = computed(() => inspectedTask.value ?? activeTask.value);
const displayTaskId = computed(() => displayTask.value?.id);
const displayOutputUrl = computed(() => (displayTaskId.value ? videoAiApi.outputUrl(displayTaskId.value) : ""));
const showSourceSwitch = computed(
  () =>
    !!displayTask.value?.output &&
    displayTask.value.status === "completed" &&
    (inspectedTask.value ? !!inspectedTask.value.inputRetained : !!previewUrl.value)
);
const displayPreviewUrl = computed(() => {
  if (sourceKind.value === "result" && displayTask.value?.output) return `${displayOutputUrl.value}?preview=1`;
  if (sourceKind.value === "original" && inspectedTask.value?.inputRetained)
    return `${videoAiApi.inputUrl(inspectedTask.value.id)}?preview=1`;
  if (previewUrl.value && !inspectedTask.value) return previewUrl.value;
  if (displayTask.value?.output) return `${displayOutputUrl.value}?preview=1`;
  return undefined;
});
const displaySegments = computed(() => {
  if (sourceKind.value === "result") return [];
  return inspectedTask.value ? inspectedTask.value.segments : detectedSegments.value;
});
const displayWidth = computed(() =>
  sourceKind.value === "result"
    ? displayTask.value?.output?.width
    : (inspectedTask.value?.inputMetadata?.width ?? mediaMetadata.value?.width)
);
const displayHeight = computed(() =>
  sourceKind.value === "result"
    ? displayTask.value?.output?.height
    : (inspectedTask.value?.inputMetadata?.height ?? mediaMetadata.value?.height)
);
const displayDuration = computed(() =>
  inspectedTask.value
    ? (sourceKind.value === "original"
        ? (inspectedTask.value.inputMetadata?.durationMs ?? inspectedTask.value.output?.durationMs ?? 0)
        : (inspectedTask.value.output?.durationMs ?? 0)) / 1000
    : mediaMetadata.value?.duration || 0
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
    hasInput.value &&
    !busy.value &&
    !manualMode.value &&
    engineAvailable(mode.value) &&
    !inspectedTask.value &&
    regionCount.value <= 20 &&
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
  healthRecovering.value
    ? "starting"
    : capabilityError.value
      ? "warning"
      : health.value?.available
        ? "available"
        : "unknown"
);
const healthIndicator = computed(() => {
  if (healthLoading.value || healthState.value === "starting") return "loading";
  if (healthState.value === "warning") return "unavailable";
  if (healthState.value !== "available") return health.value ? "unavailable" : "unknown";
  return (health.value?.engines.filter((engine) => engine.available).length ?? 0) < modeOptions.length
    ? "partial"
    : "available";
});
const healthTitle = computed(() =>
  health.value?.available
    ? "处理服务可用"
    : healthRecovering.value
      ? "正在准备处理服务"
      : capabilityError.value
        ? "能力需要处理"
        : "正在检查能力"
);
const healthSummary = computed(() => {
  if (healthRecovering.value) return "就绪后自动启用，无需刷新";
  if (!health.value) return "读取本机引擎状态";
  const count = health.value.engines.filter((engine) => engine.available).length;
  return `${count}/${modeOptions.length} 个修复档位可用`;
});

onMounted(async () => {
  await Promise.all([refreshHealth(), refreshHistory()]);
});

onBeforeUnmount(() => {
  if (previewUrl.value?.startsWith("blob:")) URL.revokeObjectURL(previewUrl.value);
});

watch(
  () => [liveTask.value?.id, liveTask.value?.status, liveTask.value?.progress] as const,
  async () => {
    if (!activeTaskId.value || liveTask.value?.id !== activeTaskId.value) return;
    await loadActiveTask(activeTaskId.value);
  }
);

watch(historyPage, () => void refreshHistory());

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
  if (sourceKind.value === "original" && !inspectedTask.value) mediaMetadata.value = value;
}

async function detectSubtitle() {
  if (!hasInput.value || busy.value || inspectedTask.value) return;
  detecting.value = true;
  actionError.value = "";
  detectionNotice.value = "";
  const request = editorRequest;
  try {
    const detection = await videoAiApi.detect(
      file.value ?? { sourceTaskId: editingTask.value!.id, sourceVersion: editingSource.value },
      scope.signal
    );
    if (scope.aborted || request !== editorRequest) return;
    const duration = mediaMetadata.value?.duration || (detection.fps > 0 ? detection.frameCount / detection.fps : 0);
    const ranges = segmentsToTimelineRanges(detection.segments, detection.fps, duration);
    if (!mediaMetadata.value && duration > 0)
      mediaMetadata.value = { width: detection.width, height: detection.height, duration };
    detectedSegments.value = [];
    manualRanges.value = ranges;
    draftRect.value = undefined;
    manualMode.value = false;
    sourceKind.value = "original";
    detectionNotice.value = [
      detection.segments.length
        ? `检测到 ${detection.segments.length} 处字幕区域，已创建 ${ranges.length} 个区间；可拖动时间线调整区间，选中框后移动或缩放。`
        : "未检测到字幕区域，可以改用手动框选",
      ...detection.warnings,
      detection.segments.length > 20 ? "当前最多提交 20 处框选，识别结果已全部保留，请删除多余框选后再处理。" : ""
    ]
      .filter(Boolean)
      .join("；");
    if (!detection.segments.length) manualMode.value = true;
    else {
      // Let the preview's source watcher load the original before revealing a range.
      await nextTick();
      await nextTick();
      if (!scope.aborted && request === editorRequest) workspace.value?.revealRange(0);
    }
  } catch (caught) {
    if (scope.aborted || request !== editorRequest) return;
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
  if (!canSubmit.value) return;
  submitting.value = true;
  actionError.value = "";
  inspectedTask.value = undefined;
  try {
    const created = await videoAiApi.create(
      {
        file: file.value,
        sourceTaskId: editingTask.value?.id,
        sourceVersion: editingTask.value ? editingSource.value : undefined,
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
  if (
    !(await confirm("删除此处理记录、留档原视频、成品和编辑信息？您电脑上的原始文件及其他记录不受影响。", {
      title: "删除视频留档",
      danger: true
    }))
  )
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
  const request = ++editorRequest;
  actionError.value = "";
  if (id === activeTaskId.value) {
    inspectedTask.value = undefined;
    sourceKind.value = activeTask.value?.output ? "result" : "original";
    if (activeTaskId.value) await loadActiveTask(activeTaskId.value);
    return;
  }
  try {
    const task = await videoAiApi.get(id, scope.signal);
    if (scope.aborted || request !== editorRequest) return;
    inspectedTask.value = task;
    sourceKind.value = task.output ? "result" : "original";
  } catch (caught) {
    if (scope.aborted || request !== editorRequest) return;
    actionError.value = caught instanceof Error ? caught.message : "读取任务状态失败";
  }
}

async function editTask(id: string, version: "original" | "output" = "output") {
  if (busy.value) return;
  const request = ++editorRequest;
  editingLoading.value = true;
  actionError.value = "";
  try {
    const task = await videoAiApi.get(id, scope.signal);
    if (scope.aborted || request !== editorRequest) return;
    if (task.status !== "completed" || !task.output) throw new Error("该记录没有可重新编辑的已完成视频");
    if (version === "original" && !task.inputRetained)
      throw new Error("此记录的原视频已被旧版本清理，请编辑成品或重新上传原视频");
    resetSelection();
    file.value = undefined;
    editingTask.value = task;
    editingSource.value = version;
    previewUrl.value = `${version === "original" ? videoAiApi.inputUrl(task.id) : videoAiApi.outputUrl(task.id)}?preview=1`;
    mediaMetadata.value = {
      width: version === "original" ? (task.inputMetadata?.width ?? task.output.width) : task.output.width,
      height: version === "original" ? (task.inputMetadata?.height ?? task.output.height) : task.output.height,
      duration:
        (version === "original"
          ? (task.inputMetadata?.durationMs ?? task.output.durationMs ?? 0)
          : (task.output.durationMs ?? 0)) / 1000
    };
    mode.value = engineAvailable(task.mode) ? task.mode : (availableModes.value[0] ?? "delogo");
    manualRanges.value =
      task.manualRanges?.map((range) => ({ ...range, rects: range.rects.map((rect) => ({ ...rect })) })) ?? [];
    if (!manualRanges.value.length && task.manualArea) {
      manualRanges.value = [
        {
          start: 0,
          end: (task.inputMetadata?.durationMs ?? task.output.durationMs ?? 0) / 1000,
          rects: [{ ...task.manualArea }]
        }
      ];
      if (!manualRanges.value[0].end) {
        manualRanges.value = [];
        draftRect.value = { ...task.manualArea };
      }
    }
    if (!manualRanges.value.length && !task.manualArea) {
      if (task.inputMetadata?.fps && task.segments.length) {
        manualRanges.value = segmentsToTimelineRanges(
          task.segments,
          task.inputMetadata.fps,
          task.inputMetadata.durationMs / 1000
        );
      } else detectedSegments.value = task.segments.map((segment) => ({ ...segment, rect: { ...segment.rect } }));
    }
    sourceKind.value = "original";
  } catch (caught) {
    if (!scope.aborted && request === editorRequest)
      actionError.value = caught instanceof Error ? caught.message : "读取编辑视频失败";
  } finally {
    editingLoading.value = false;
  }
}

function returnToActiveTask() {
  editorRequest++;
  inspectedTask.value = undefined;
  sourceKind.value = activeTask.value?.output ? "result" : "original";
}

function outputUrlOf(id: string) {
  return videoAiApi.outputUrl(id);
}

function resetSelection() {
  editorRequest++;
  editingTask.value = undefined;
  manualRanges.value = [];
  if (previewUrl.value?.startsWith("blob:")) URL.revokeObjectURL(previewUrl.value);
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
.capability-alert {
  margin: 0;
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
@container tool-content (max-width: 980px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .file-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .file-copy {
    align-items: flex-start;
    text-align: left;
  }
}

.video-editor-workbench {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.video-preview-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.video-preview-panel .file-toolbar {
  padding-bottom: 12px;
}
.video-preview-panel .file-copy {
  align-items: flex-start;
  text-align: left;
}
.editor-grid {
  grid-template-columns: minmax(0, 1fr) 320px;
}
@container tool-content (max-width: 900px) {
  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.video-preview-panel {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  gap: 14px;
}
.video-preview-panel .file-toolbar {
  border: 0;
  padding: 0;
  gap: 16px;
}
.file-toolbar > .n-button {
  height: 38px;
  font-size: 14px;
  border-radius: 8px;
}
.file-copy strong {
  color: var(--color-text);
  font-size: 14px;
}
.editor-grid {
  grid-template-columns: minmax(0, 1fr) minmax(300px, 28%);
  gap: 16px;
}
@container tool-content (max-width: 980px) {
  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
