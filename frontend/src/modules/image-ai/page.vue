<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <ToolLayout>
    <section class="main-column image-ai-main">
      <ToolPageHeader
        title="AI 图片处理"
        description="去水印、变清晰和商品图抠图统一在本机完成，处理结果 24 小时后自动清理。"
        kicker="LOCAL AI · 图片不出网"
      >
        <template #actions>
          <div class="image-ai-health" :class="{ 'is-ready': health?.available }">
            <span class="status-dot" />
            <div>
              <strong>{{ health?.available ? "推理服务可用" : "推理服务未就绪" }}</strong>
              <small>{{ healthLabel }}</small>
            </div>
            <n-button size="small" tertiary :loading="loadingHealth" @click="loadHealth">刷新</n-button>
          </div>
        </template>
      </ToolPageHeader>

      <n-alert type="warning" :bordered="false" class="rights-alert">
        仅处理你拥有合法使用权的图片。OCR 框选只是水印区域建议，必须由你确认后才会执行修复。
      </n-alert>

      <section class="workspace-panel image-ai-workspace">
        <n-tabs v-model:value="activeTab" type="segment" animated>
          <n-tab-pane name="watermark" tab="去水印">
            <ImageAiWatermarkPanel
              :watermark-file="watermarkFile"
              :watermark-preview-url="watermarkPreviewUrl"
              :watermark-result-url="watermarkResultUrl"
              :watermark-dimensions-label="watermarkDimensionsLabel"
              :is-busy="isBusy"
              :suggesting="suggesting"
              :active-task="activeTask"
              :operation-available="operationAvailable"
              :select-watermark="selectWatermark"
              :clear-watermark="clearWatermark"
              :suggest-watermark="suggestWatermark"
              :submit-watermark="submitWatermark"
              :download-watermark-result="downloadWatermarkResult"
              :reset-watermark-result="resetWatermarkResult"
              :cancel-active-task="cancelActiveTask"
              :format-bytes="formatBytes"
              :on-dimensions="setWatermarkDimensions"
            />
          </n-tab-pane>
          <n-tab-pane name="enhance" tab="变清晰">
            <ImageAiOperationPanel
              v-model:files="enhanceFiles"
              operation="enhance"
              :scale="enhanceScale"
              :is-busy="isBusy"
              :active-task="activeTask"
              :active-task-files="activeTaskFiles"
              :model-policy-label="modelPolicyLabel"
              :operation-available="operationAvailable"
              :validate-file="validateClientFile"
              :format-bytes="formatBytes"
              :submit-batch="submitBatch"
              :cancel-active-task="cancelActiveTask"
              @update:scale="enhanceScale = $event"
            />
          </n-tab-pane>
          <n-tab-pane name="cutout" tab="抠图">
            <ImageAiOperationPanel
              v-model:files="cutoutFiles"
              operation="background_remove"
              :scale="enhanceScale"
              :is-busy="isBusy"
              :active-task="activeTask"
              :active-task-files="activeTaskFiles"
              :model-policy-label="modelPolicyLabel"
              :operation-available="operationAvailable"
              :validate-file="validateClientFile"
              :format-bytes="formatBytes"
              :submit-batch="submitBatch"
              :cancel-active-task="cancelActiveTask"
            />
          </n-tab-pane>
        </n-tabs>
      </section>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NAlert, NButton, NTabPane, NTabs, useMessage } from "naive-ui";
import type { ImageAiHealth, ImageAiOperation, ImageAiTask, WatermarkSuggestion } from "@toolbox/shared";

import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import ImageAiOperationPanel from "./ImageAiOperationPanel.vue";
import ImageAiWatermarkPanel from "./ImageAiWatermarkPanel.vue";
import { useRequestScope } from "../../composables/useRequestScope";
import { useTaskEvents } from "../../composables/useTaskEvents";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { absoluteImageAiUrl, imageAiApi, resultDownloadUrl, triggerImageAiDownload } from "./api";

const message = useMessage();
const activeTab = ref<"watermark" | "enhance" | "cutout">("watermark");
const health = ref<ImageAiHealth>();
const loadingHealth = ref(false);
const watermarkFile = ref<File>();
const watermarkPreviewUrl = ref("");
const watermarkResultUrl = ref("");
const watermarkDimensions = ref<{ width: number; height: number }>();
const suggesting = ref(false);
const enhanceFiles = ref<File[]>([]);
const cutoutFiles = ref<File[]>([]);
const activeTaskFiles = ref<File[]>([]);
const enhanceScale = ref<2 | 4>(2);
const activeTask = ref<ImageAiTask>();
const isBusy = computed(() => activeTask.value?.status === "pending" || activeTask.value?.status === "running");
const streamedTaskId = computed(() => (isBusy.value ? activeTask.value?.id : undefined));
const requestScope = useRequestScope();
const taskEvents = useTaskEvents(streamedTaskId, { signal: requestScope.signal });
const healthLabel = computed(() => {
  if (!health.value) return "请启动本地 Worker";
  const ready = health.value.models.filter((model) => model.available).length;
  return `${health.value.deploymentUsage === "internal-noncommercial" ? "内部非商用" : "商业安全"} · ${ready}/${health.value.models.length} 模型可用`;
});
const modelPolicyLabel = computed(() =>
  health.value?.deploymentUsage === "internal-noncommercial"
    ? "BRIA RMBG 2.0（非商用）→ BiRefNet"
    : "BiRefNet 商业安全模式"
);
const watermarkDimensionsLabel = computed(() =>
  watermarkDimensions.value ? `${watermarkDimensions.value.width} × ${watermarkDimensions.value.height}` : "读取尺寸中"
);
function setWatermarkDimensions(value: { width: number; height: number }) {
  watermarkDimensions.value = value;
}

// 页面进入时只读取一次 Worker 健康状态；任务进度由 useTaskEvents 负责订阅。
onMounted(loadHealth);
onBeforeUnmount(() => {
  // 页面卸载必须释放本地预览 URL，避免反复选择大图后累积 Blob 内存。
  revokeWatermarkUrl();
});

watch(taskEvents.task, (task) => {
  // 只接受当前 taskId 的事件，防止切换页面后旧任务覆盖新任务的进度。
  if (!task || task.id !== activeTask.value?.id) return;
  activeTask.value = {
    ...activeTask.value,
    status: task.error === "CANCELLED" ? "canceled" : task.status,
    progress: task.progress,
    error: task.error,
    updatedAt: task.updatedAt
  };
  if (task.status === "completed" || task.status === "failed") void finishStreamedTask(task.id);
});

watch(taskEvents.error, (error) => {
  if (error && !isApiErrorCancelled(error)) message.warning(formatApiError(error));
});

async function loadHealth() {
  loadingHealth.value = true;
  try {
    // 健康接口失败只影响能力提示，不阻止页面其它静态功能渲染。
    health.value = await imageAiApi.health();
  } catch (error) {
    health.value = undefined;
    if (!isApiErrorCancelled(error)) message.warning(formatApiError(error, "本地推理服务未启动"));
  } finally {
    loadingHealth.value = false;
  }
}

function selectWatermark(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  (event.target as HTMLInputElement).value = "";
  if (!file || !validateClientFile(file)) return;
  // 新文件替换旧预览并清空上一次结果，确保结果不会误对应到当前图片。
  revokeWatermarkUrl();
  watermarkFile.value = file;
  watermarkPreviewUrl.value = URL.createObjectURL(file);
  watermarkResultUrl.value = "";
  activeTask.value = undefined;
}

function clearWatermark() {
  revokeWatermarkUrl();
  watermarkFile.value = undefined;
  watermarkPreviewUrl.value = "";
  watermarkResultUrl.value = "";
  watermarkDimensions.value = undefined;
  activeTask.value = undefined;
}

function revokeWatermarkUrl() {
  if (watermarkPreviewUrl.value) URL.revokeObjectURL(watermarkPreviewUrl.value);
}

async function suggestWatermark(applySuggestions?: (suggestions: WatermarkSuggestion[]) => void) {
  if (!watermarkFile.value) return;
  suggesting.value = true;
  try {
    // 智能框选只生成蒙版建议，由用户确认后再提交去水印任务。
    const response = await imageAiApi.suggestions(watermarkFile.value);
    applySuggestions?.(response.suggestions);
    response.warnings.forEach((warning) => message.warning(warning));
    if (response.suggestions.length)
      message.success(`已标记 ${response.suggestions.length} 个疑似文字区域，请检查蒙版`);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "智能框选失败"));
  } finally {
    suggesting.value = false;
  }
}

async function submitWatermark(editor?: { toMaskBlob: () => Promise<Blob> }) {
  if (!watermarkFile.value || !editor) return;
  try {
    // 先把画布转换为 PNG Blob，再与原图一起提交；服务端负责尺寸和像素上限校验。
    const mask = await editor.toMaskBlob();
    const form = new FormData();
    form.append("operation", "watermark_remove");
    form.append("files", watermarkFile.value);
    form.append("mask", mask, "mask.png");
    activeTask.value = await imageAiApi.createTask(form);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "去水印失败"));
  }
}

async function submitBatch(operation: "enhance" | "background_remove") {
  const files = operation === "enhance" ? enhanceFiles.value : cutoutFiles.value;
  if (!files.length) return;
  // 批量任务只发送用户当前选中的文件快照，提交后页面可继续选择其它文件。
  const form = new FormData();
  form.append("operation", operation);
  if (operation === "enhance") form.append("scale", String(enhanceScale.value));
  files.forEach((file) => form.append("files", file));
  try {
    activeTask.value = await imageAiApi.createTask(form);
    activeTaskFiles.value = [...files];
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "图片处理失败"));
  }
}

function downloadWatermarkResult() {
  const result = activeTask.value?.results[0];
  if (result) triggerImageAiDownload(resultDownloadUrl(result.downloadUrl));
}

async function finishStreamedTask(taskId: string) {
  try {
    // 收到终态事件后重新获取完整结果，确保下载 URL 和警告列表来自服务端最终快照。
    const task = await imageAiApi.getTask(taskId);
    if (activeTask.value?.id !== taskId) return;
    activeTask.value = task;
    if (task.status === "completed") {
      const result = task.results[0];
      if (task.operation === "watermark_remove" && result) {
        watermarkResultUrl.value = absoluteImageAiUrl(result.downloadUrl);
      }
      message.success(`处理完成，共生成 ${task.results.length} 张图片`);
    } else if (task.status === "canceled") {
      message.info("任务已取消");
    } else {
      message.error(task.error || "任务处理失败");
    }
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "任务结果读取失败"));
  }
}

async function cancelActiveTask() {
  if (!activeTask.value) return;
  // 取消请求由服务端记录终态，前端随后继续通过事件流接收最终状态。
  activeTask.value = await imageAiApi.cancelTask(activeTask.value.id);
}

function resetWatermarkResult() {
  watermarkResultUrl.value = "";
  activeTask.value = undefined;
}

function validateClientFile(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    message.warning("仅支持 JPG、PNG、WebP 图片");
    return false;
  }
  if (file.size > 20 * 1024 * 1024) {
    message.warning("单张图片不能超过 20MB");
    return false;
  }
  return true;
}

function operationAvailable(operation: ImageAiOperation) {
  const readyProviders = new Set(
    health.value?.models.filter((model) => model.available).map((model) => model.provider)
  );
  if (operation === "watermark_remove") return readyProviders.has("lama");
  if (operation === "enhance") return readyProviders.has("real-esrgan");
  return readyProviders.has("bria-rmbg-2.0") || readyProviders.has("birefnet-general");
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>
