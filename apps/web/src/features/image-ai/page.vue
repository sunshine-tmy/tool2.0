<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <ToolLayout class="image-ai-layout">
    <section class="main-column image-ai-main v2-tool-page">
      <ToolPageHeader
        title="AI 图片处理"
        description="去水印、变清晰和商品图抠图统一在本机完成，成功结果自动留档，支持回看与下载。"
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
            <DiagnosticErrorLink v-if="health && !health.available" error="AI 图片服务不可用" module="image-ai" />
          </div>
        </template>
      </ToolPageHeader>

      <p class="rights-alert" role="note">
        <Info :size="15" aria-hidden="true" />
        <span>仅处理你拥有合法使用权的图片。OCR 框选只是水印区域建议，必须由你确认后才会执行修复。</span>
      </p>

      <section class="image-ai-workspace">
        <ProductImageEditor
          v-if="editTarget"
          :task-id="editTarget.taskId"
          :result-id="editTarget.resultId"
          @close="editTarget = undefined"
          @saved="historyVersion++"
        />
        <n-tabs v-else v-model:value="activeTab" type="line" animated>
          <n-tab-pane name="watermark" tab="去水印">
            <ImageAiWatermarkPanel
              :watermark-file="watermarkFile"
              :watermark-preview-url="watermarkPreviewUrl"
              :watermark-result-url="watermarkResultUrl"
              :watermark-dimensions-label="watermarkDimensionsLabel"
              :is-busy="isBusy"
              :suggesting="suggesting"
              :active-task="activeTask?.operation === 'watermark_remove' ? activeTask : undefined"
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
              :unavailable-reason="operationUnavailableReason('enhance')"
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
              @edit="openEditor"
            />
          </n-tab-pane>
          <n-tab-pane name="cutout" tab="抠图">
            <ImageAiOperationPanel
              v-model:files="cutoutFiles"
              operation="background_remove"
              :unavailable-reason="operationUnavailableReason('background_remove')"
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
              @edit="openEditor"
            />
          </n-tab-pane>
          <n-tab-pane name="history" tab="处理记录">
            <ImageAiHistoryPanel :refresh-version="historyVersion" @deleted="onHistoryDeleted" @edit="openEditor" />
          </n-tab-pane>
        </n-tabs>
      </section>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import DiagnosticErrorLink from "../../shared/ui/DiagnosticErrorLink.vue";
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NButton, NTabPane, NTabs, useMessage } from "naive-ui";
import { Info } from "lucide-vue-next";
import type { ImageAiHealth, ImageAiOperation, ImageAiTask, WatermarkSuggestion } from "@toolbox/shared";

import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import ImageAiOperationPanel from "./processing/ImageAiOperationPanel.vue";
import ImageAiWatermarkPanel from "./processing/ImageAiWatermarkPanel.vue";
import ImageAiHistoryPanel from "./history/ImageAiHistoryPanel.vue";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useTaskEvents } from "../../shared/composables/useTaskEvents";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { imageAiApi } from "./api";
import { absoluteImageAiUrl, resultDownloadUrl, triggerImageAiDownload } from "./media-links";

const message = useMessage();
const ProductImageEditor = defineAsyncComponent(() => import("./product-image/ProductImageEditor.vue"));
const editTarget = ref<{ taskId: string; resultId: string }>();
function openEditor(taskId: string, resultId: string) {
  editTarget.value = { taskId, resultId };
}
const activeTab = ref<"watermark" | "enhance" | "cutout" | "history">("watermark");
const historyVersion = ref(0);
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
const submitting = ref(false);
const isBusy = computed(
  () => submitting.value || activeTask.value?.status === "pending" || activeTask.value?.status === "running"
);
const streamedTaskId = computed(() =>
  activeTask.value && ["pending", "running"].includes(activeTask.value.status) ? activeTask.value.id : undefined
);
const requestScope = useRequestScope();
const taskEvents = useTaskEvents(streamedTaskId, { signal: requestScope.signal });
watch(
  () => activeTask.value && `${activeTask.value.id}:${activeTask.value.status}`,
  () => {
    if (activeTask.value && !["pending", "running"].includes(activeTask.value.status)) historyVersion.value += 1;
  }
);

function onHistoryDeleted(taskId: string) {
  if (activeTask.value?.id !== taskId || isBusy.value) return;
  activeTask.value = undefined;
  activeTaskFiles.value = [];
  watermarkResultUrl.value = "";
}
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

// Selecting new input is not a completed task, even when the previous input has a result.
for (const [files, operation] of [
  [enhanceFiles, "enhance"],
  [cutoutFiles, "background_remove"]
] as const) {
  watch(files, () => {
    if (!isBusy.value && activeTask.value?.operation === operation) {
      activeTask.value = undefined;
      activeTaskFiles.value = [];
    }
  });
}

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
  if (!watermarkFile.value || !editor || isBusy.value || !operationAvailable("watermark_remove")) return;
  submitting.value = true;
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
  } finally {
    submitting.value = false;
  }
}

async function submitBatch(operation: "enhance" | "background_remove") {
  const files = operation === "enhance" ? enhanceFiles.value : cutoutFiles.value;
  if (!files.length || isBusy.value || !operationAvailable(operation)) return;
  submitting.value = true;
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
  } finally {
    submitting.value = false;
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

function operationUnavailableReason(operation: ImageAiOperation) {
  if (!health.value) return "无法读取模型状态，请刷新服务状态或查看启动与环境诊断。";
  const providers =
    operation === "enhance"
      ? ["real-esrgan"]
      : ["birefnet-general", ...(health.value.deploymentUsage === "internal-noncommercial" ? ["bria-rmbg-2.0"] : [])];
  const reasons = health.value.models
    .filter((model) => providers.includes(model.provider))
    .map((model) => `${model.model}：${model.reason || "未就绪"}`);
  return `${reasons.join("；") || "所需模型未就绪"}。请刷新状态或前往设置中的能力管理检查。上传图片不会自动开始处理。`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>

<style scoped>
.image-ai-workspace {
  min-width: 0;
  min-height: 0;
}
.image-ai-layout :deep(.content) {
  max-width: none;
  padding: 28px 32px 40px;
}
.image-ai-main :deep(.tool-page-header) {
  margin-bottom: 24px;
}
.image-ai-main :deep(.tool-page-icon) {
  width: 72px;
  height: 72px;
}
.image-ai-main :deep(.tool-page-header h2) {
  font-size: 30px;
  line-height: 1.3;
}
.image-ai-main > .rights-alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 12px;
  padding: 4px 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  color: var(--color-text-secondary);
  background: transparent;
  font-size: 12px;
  line-height: 1.7;
}
.rights-alert > svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--color-text-tertiary);
}
.image-ai-workspace :deep(.n-tabs-nav) {
  max-width: none;
  margin-bottom: 20px;
}
.image-ai-workspace :deep(.n-tabs-tab) {
  padding: 14px 20px;
  font-size: 17px;
  font-weight: 600;
}
.image-ai-workspace :deep(.n-tabs-tab.n-tabs-tab--active),
.image-ai-workspace :deep(.n-tabs-tab.n-tabs-tab--active .n-tabs-tab__label) {
  font-weight: 700;
}
.image-ai-workspace :deep(.n-tab-pane) {
  padding-top: 0;
}
.image-ai-workspace :deep(.image-ai-tab-grid) {
  align-items: stretch;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 32%);
}
.image-ai-workspace :deep(.image-ai-stage) {
  min-width: 0;
  min-height: 0;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.image-ai-workspace :deep(.image-ai-controls) {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.image-ai-workspace :deep(.image-ai-dropzone) {
  color: var(--color-primary-600);
  background: var(--color-surface-subtle);
  border-color: var(--color-primary-200);
}
.image-ai-workspace :deep(.image-ai-controls .panel-heading p) {
  color: var(--color-text-secondary);
}
.image-ai-workspace :deep(.image-ai-filebar) {
  border-color: var(--color-border);
  background: var(--color-surface-subtle);
}
.image-ai-workspace :deep(.image-ai-filebar strong) {
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .image-ai-workspace :deep(.image-ai-tab-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
  .image-ai-workspace :deep(.image-ai-controls) {
    padding: 20px;
  }
}
@media (max-width: 600px) {
  .image-ai-layout :deep(.content) {
    padding: 20px 16px 28px;
  }
  .image-ai-main :deep(.tool-page-icon) {
    width: 56px;
    height: 56px;
  }
  .image-ai-main :deep(.tool-page-header h2) {
    font-size: 26px;
  }
  .image-ai-workspace :deep(.n-tabs-tab) {
    padding: 12px 8px;
    font-size: 14px;
  }
  .image-ai-workspace :deep(.image-ai-stage) {
    padding: 16px;
  }
}
</style>
