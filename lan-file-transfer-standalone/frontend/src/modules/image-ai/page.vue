<template>
  <ToolLayout>
    <section class="main-column image-ai-main">
      <div class="section-title image-ai-title">
        <div>
          <span class="eyebrow">Local AI · 图片不出网</span>
          <h2>AI 图片处理</h2>
          <p>去水印、变清晰和商品图抠图统一在本机完成，处理结果 24 小时后自动清理。</p>
        </div>
        <div
          class="image-ai-health"
          :class="{
            'is-ready': installation?.runtimeInstalled && health?.available,
            'is-installing': installation?.status === 'installing'
          }"
        >
          <span class="status-dot" />
          <div>
            <strong>{{ healthTitle }}</strong>
            <small>{{ healthLabel }}</small>
          </div>
          <n-button size="small" tertiary :loading="loadingHealth" @click="() => loadHealth()">刷新</n-button>
        </div>
      </div>

      <section v-if="health && !installation?.runtimeInstalled" class="workspace-panel image-ai-install-panel">
        <div class="image-ai-install-icon">
          <PackageOpen :size="30" />
        </div>
        <div class="image-ai-install-copy">
          <span class="eyebrow">按需安装 · 不影响其他模块</span>
          <h3>{{ installation?.status === "installing" ? "AI 环境正在安装" : "AI 图片处理尚未安装" }}</h3>
          <p>{{ installation?.message }}</p>
          <p class="image-ai-install-note">
            文件传输和图片压缩已经可以正常使用。只有点击下方按钮后，才会安装 Python 3.11、AI
            依赖和模型。
          </p>
          <div v-if="installation?.status === 'installing'" class="image-ai-install-progress">
            <div class="image-ai-install-progress-heading">
              <span>当前阶段：{{ installStageLabel }}</span>
              <strong>{{ installProgress }}%</strong>
            </div>
            <n-progress
              type="line"
              status="info"
              processing
              :percentage="installProgress"
              :show-indicator="false"
            />
            <small>
              整体百分比按安装阶段估算
              <template v-if="installActivityLabel"> · {{ installActivityLabel }}</template>
            </small>
          </div>
        </div>
        <div class="image-ai-install-actions">
          <n-button
            type="primary"
            :loading="installingAi"
            :disabled="
              installation?.status === 'installing' ||
              (!installation?.pythonInstalled && !installation?.installerAvailable)
            "
            @click="installImageAi"
          >
            <template #icon><Download :size="16" /></template>
            {{ installation?.pythonInstalled ? "一键安装 AI 环境" : "安装 Python 与 AI 环境" }}
          </n-button>
          <small v-if="!installation?.pythonInstalled && !installation?.installerAvailable">
            未找到随包附带的 Python 安装程序
          </small>
          <small v-else-if="installation?.pythonInstalled">将直接安装 AI 依赖和模型，不会重复安装 Python</small>
          <small v-else>安装时会弹出 Python 官方安装窗口，请按提示完成操作</small>
        </div>
      </section>

      <n-alert
        v-else-if="health && installation?.runtimeInstalled && !health.available"
        type="warning"
        :bordered="false"
        class="image-ai-worker-alert"
      >
        <div class="image-ai-worker-alert-content">
          <span>AI 环境已安装，但推理服务尚未就绪。</span>
          <n-button size="small" type="warning" secondary :loading="startingWorker" @click="startImageAiWorker">
            启动 AI 服务
          </n-button>
        </div>
      </n-alert>

      <n-alert type="warning" :bordered="false" class="rights-alert">
        仅处理你拥有合法使用权的图片。OCR 框选只是水印区域建议，必须由你确认后才会执行修复。
      </n-alert>

      <section v-if="installation?.runtimeInstalled" class="workspace-panel image-ai-workspace">
        <n-tabs v-model:value="activeTab" type="segment" animated>
          <n-tab-pane name="watermark" tab="去水印">
            <div class="image-ai-tab-grid">
              <div class="image-ai-stage">
                <label v-if="!watermarkFile" class="dropzone image-ai-dropzone">
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp" @change="selectWatermark" />
                  <ScanLine :size="34" />
                  <strong>选择一张需要去水印的图片</strong>
                  <span>支持 JPG、PNG、WebP，单张不超过 20MB</span>
                </label>

                <template v-else>
                  <div class="image-ai-filebar">
                    <div>
                      <strong>{{ watermarkFile.name }}</strong>
                      <span>{{ formatBytes(watermarkFile.size) }} · {{ watermarkDimensionsLabel }}</span>
                    </div>
                    <n-button size="small" secondary :disabled="isBusy" @click="clearWatermark">更换图片</n-button>
                  </div>

                  <MaskEditor
                    v-if="!watermarkResultUrl"
                    ref="maskEditor"
                    :image-url="watermarkPreviewUrl"
                    @ready="watermarkDimensions = $event"
                  />

                  <BeforeAfterCompare
                    v-else
                    class="watermark-result-compare"
                    :before-url="watermarkPreviewUrl"
                    :after-url="watermarkResultUrl"
                  />
                </template>
              </div>

              <aside class="image-ai-controls">
                <div class="panel-heading">
                  <div>
                    <h3>水印区域</h3>
                    <p>智能检测后仍可继续涂抹或擦除。</p>
                  </div>
                  <n-tag size="small" type="warning" :bordered="false">用户确认</n-tag>
                </div>
                <n-button
                  block
                  secondary
                  :disabled="!watermarkFile || Boolean(watermarkResultUrl)"
                  :loading="suggesting"
                  @click="suggestWatermark"
                >
                  <template #icon><ScanSearch :size="16" /></template>
                  OCR 智能框选
                </n-button>
                <n-button
                  v-if="!watermarkResultUrl"
                  block
                  type="primary"
                  :disabled="!watermarkFile || isBusy || !operationAvailable('watermark_remove')"
                  :loading="isBusy"
                  @click="submitWatermark"
                >
                  <template #icon><WandSparkles :size="16" /></template>
                  开始去水印
                </n-button>
                <n-button v-else block type="primary" @click="downloadWatermarkResult">
                  <template #icon><Download :size="16" /></template>
                  下载 PNG
                </n-button>
                <n-button v-if="watermarkResultUrl" block secondary @click="resetWatermarkResult"
                  >重新编辑蒙版</n-button
                >
                <TaskStatusCard :task="activeTask" @cancel="cancelActiveTask" />
              </aside>
            </div>
          </n-tab-pane>

          <n-tab-pane name="enhance" tab="变清晰">
            <div class="image-ai-tab-grid">
              <BatchPicker
                title="添加低清图片"
                hint="最多 10 张；系统会预检增强后的像素尺寸"
                :files="enhanceFiles"
                :disabled="isBusy"
                @change="enhanceFiles = $event"
              />
              <aside class="image-ai-controls">
                <div class="panel-heading">
                  <div>
                    <h3>增强倍率</h3>
                    <p>默认 2× 更自然，4× 适合较小原图。</p>
                  </div>
                  <n-tag size="small" :bordered="false">Real-ESRGAN</n-tag>
                </div>
                <n-radio-group v-model:value="enhanceScale" class="scale-options">
                  <n-radio-button :value="2">2× 均衡</n-radio-button>
                  <n-radio-button :value="4">4× 高倍率</n-radio-button>
                </n-radio-group>
                <n-button
                  block
                  type="primary"
                  :disabled="!enhanceFiles.length || isBusy || !operationAvailable('enhance')"
                  :loading="isBusy"
                  @click="submitBatch('enhance')"
                >
                  <template #icon><Sparkles :size="16" /></template>
                  开始变清晰
                </n-button>
                <TaskStatusCard :task="activeTask" @cancel="cancelActiveTask" />
              </aside>
            </div>
            <ResultGallery
              v-if="activeTask?.operation === 'enhance'"
              :task="activeTask"
              :source-files="activeTaskFiles"
            />
          </n-tab-pane>

          <n-tab-pane name="cutout" tab="抠图">
            <div class="image-ai-tab-grid">
              <BatchPicker
                title="添加商品图片"
                hint="最多 10 张，结果统一输出透明 PNG"
                :files="cutoutFiles"
                :disabled="isBusy"
                checkerboard
                @change="cutoutFiles = $event"
              />
              <aside class="image-ai-controls">
                <div class="panel-heading">
                  <div>
                    <h3>抠图模型</h3>
                    <p>内部模式优先 BRIA，失败自动回退 BiRefNet。</p>
                  </div>
                  <n-tag size="small" type="info" :bordered="false">自动选择</n-tag>
                </div>
                <div class="model-policy">
                  <ShieldCheck :size="18" />
                  <span>{{ modelPolicyLabel }}</span>
                </div>
                <n-button
                  block
                  type="primary"
                  :disabled="!cutoutFiles.length || isBusy || !operationAvailable('background_remove')"
                  :loading="isBusy"
                  @click="submitBatch('background_remove')"
                >
                  <template #icon><Scan :size="16" /></template>
                  开始抠图
                </n-button>
                <TaskStatusCard :task="activeTask" @cancel="cancelActiveTask" />
              </aside>
            </div>
            <ResultGallery
              v-if="activeTask?.operation === 'background_remove'"
              :task="activeTask"
              :source-files="activeTaskFiles"
              checkerboard
            />
          </n-tab-pane>
        </n-tabs>
      </section>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import {
  NAlert,
  NButton,
  NEmpty,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NTabPane,
  NTabs,
  NTag,
  useMessage
} from "naive-ui";
import type {
  ImageAiHealth,
  ImageAiInstallStage,
  ImageAiOperation,
  ImageAiTask,
  WatermarkSuggestion
} from "@toolbox/shared";
import {
  Download,
  Images,
  Scan,
  ScanLine,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  PackageOpen,
  Trash2,
  WandSparkles,
  X
} from "lucide-vue-next";
import ToolLayout from "../../layouts/ToolLayout.vue";
import BeforeAfterCompare from "./BeforeAfterCompare.vue";
import MaskEditor from "./MaskEditor.vue";
import { absoluteImageAiUrl, imageAiApi, resultDownloadUrl, triggerImageAiDownload } from "./api";

type MaskEditorExposed = {
  applySuggestions: (suggestions: WatermarkSuggestion[]) => void;
  toMaskBlob: () => Promise<Blob>;
};

const message = useMessage();
const activeTab = ref<"watermark" | "enhance" | "cutout">("watermark");
const health = ref<ImageAiHealth>();
const loadingHealth = ref(false);
const installingAi = ref(false);
const startingWorker = ref(false);
const watermarkFile = ref<File>();
const watermarkPreviewUrl = ref("");
const watermarkResultUrl = ref("");
const watermarkDimensions = ref<{ width: number; height: number }>();
const maskEditor = ref<MaskEditorExposed>();
const suggesting = ref(false);
const enhanceFiles = ref<File[]>([]);
const cutoutFiles = ref<File[]>([]);
const activeTaskFiles = ref<File[]>([]);
const enhanceScale = ref<2 | 4>(2);
const activeTask = ref<ImageAiTask>();
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let installPollTimer: ReturnType<typeof setTimeout> | undefined;

const isBusy = computed(() => activeTask.value?.status === "pending" || activeTask.value?.status === "running");
const installation = computed(() => health.value?.installation);
const installProgress = computed(() => Math.min(100, Math.max(0, installation.value?.progress ?? 0)));
const installStageLabels: Record<ImageAiInstallStage, string> = {
  preparing: "检查安装环境",
  python: "安装 Python 3.11",
  environment: "创建独立 Python 环境",
  pytorch: "安装 PyTorch",
  dependencies: "安装 AI 推理依赖",
  "model-weights": "下载清晰化模型",
  birefnet: "下载并预加载抠图模型",
  lama: "下载并预加载去水印模型",
  ocr: "下载并预加载 OCR 模型",
  finalizing: "完成环境校验",
  completed: "安装完成",
  failed: "安装失败"
};
const installStageLabel = computed(() => {
  const stage = installation.value?.stage;
  return stage ? installStageLabels[stage] : "准备安装";
});
const installActivityLabel = computed(() => {
  const startedAt = installation.value?.startedAt;
  const activityAt = installation.value?.activityAt;
  const parts: string[] = [];
  if (startedAt) parts.push(`已进行 ${formatDuration(Date.now() - new Date(startedAt).getTime())}`);
  if (activityAt) parts.push(`最近更新 ${formatRelativeTime(Date.now() - new Date(activityAt).getTime())}`);
  return parts.join(" · ");
});
const healthTitle = computed(() => {
  if (!health.value) return "正在读取状态";
  if (installation.value?.status === "installing") return "AI 环境安装中";
  if (!installation.value?.runtimeInstalled) {
    return installation.value?.status === "failed" ? "AI 安装未完成" : "AI 图片处理未安装";
  }
  return health.value.available ? "推理服务可用" : "推理服务未就绪";
});
const healthLabel = computed(() => {
  if (!health.value) return "正在连接本地服务";
  if (!installation.value?.runtimeInstalled) return installation.value?.message || "可按需安装";
  const ready = health.value.models.filter((model) => model.available).length;
  if (!health.value.models.length) return "AI 环境已安装，等待推理服务启动";
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

onMounted(async () => {
  await loadHealth();
  if (installation.value?.status === "installing") beginInstallPolling();
});
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer);
  stopInstallPolling();
  revokeWatermarkUrl();
});

watch(activeTab, () => {
  if (pollTimer && !isBusy.value) clearTimeout(pollTimer);
});

async function loadHealth(showWarning = true) {
  loadingHealth.value = true;
  try {
    health.value = await imageAiApi.health();
  } catch (error) {
    health.value = undefined;
    if (showWarning) message.warning(error instanceof Error ? error.message : "无法读取 AI 环境状态");
  } finally {
    loadingHealth.value = false;
  }
}

async function installImageAi() {
  installingAi.value = true;
  try {
    await imageAiApi.install();
    await loadHealth(false);
    message.info(
      installation.value?.pythonInstalled
        ? "AI 依赖和模型开始安装，请保持网络连接"
        : "请在弹出的 Python 官方安装窗口中完成安装，之后会自动继续"
    );
    beginInstallPolling();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "无法启动 AI 环境安装");
  } finally {
    installingAi.value = false;
  }
}

async function startImageAiWorker() {
  startingWorker.value = true;
  try {
    await imageAiApi.startWorker();
    message.info("AI 推理服务正在启动");
    beginWorkerPolling(0);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "无法启动 AI 推理服务");
  } finally {
    startingWorker.value = false;
  }
}

function beginInstallPolling() {
  stopInstallPolling();

  const poll = async () => {
    await loadHealth(false);
    if (installation.value?.status === "installing") {
      installPollTimer = setTimeout(poll, 5000);
      return;
    }
    stopInstallPolling();
    if (installation.value?.runtimeInstalled) {
      message.success("AI 环境安装完成，正在启动推理服务");
      beginWorkerPolling(0);
    } else if (installation.value?.status === "failed") {
      message.error(installation.value.message || "AI 环境安装未完成，请查看安装日志");
    }
  };
  installPollTimer = setTimeout(poll, 1200);
}

function stopInstallPolling() {
  if (installPollTimer) clearTimeout(installPollTimer);
  installPollTimer = undefined;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value < 0) return "片刻";
  const minutes = Math.floor(value / 60000);
  if (minutes < 1) return "不到 1 分钟";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`;
}

function formatRelativeTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "刚刚";
  const seconds = Math.floor(value / 1000);
  if (seconds < 10) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  return `${Math.floor(seconds / 60)} 分钟前`;
}

function beginWorkerPolling(attempt: number) {
  if (installPollTimer) clearTimeout(installPollTimer);
  installPollTimer = setTimeout(async () => {
    await loadHealth(false);
    if (health.value?.available) {
      message.success("AI 推理服务已就绪");
      return;
    }
    if (attempt < 60) beginWorkerPolling(attempt + 1);
    else message.warning("AI 服务启动时间较长，请稍后点击刷新");
  }, 1500);
}

function selectWatermark(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  (event.target as HTMLInputElement).value = "";
  if (!file || !validateClientFile(file)) return;
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

async function suggestWatermark() {
  if (!watermarkFile.value) return;
  suggesting.value = true;
  try {
    const response = await imageAiApi.suggestions(watermarkFile.value);
    maskEditor.value?.applySuggestions(response.suggestions);
    response.warnings.forEach((warning) => message.warning(warning));
    if (response.suggestions.length)
      message.success(`已标记 ${response.suggestions.length} 个疑似文字区域，请检查蒙版`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "智能框选失败");
  } finally {
    suggesting.value = false;
  }
}

async function submitWatermark() {
  if (!watermarkFile.value || !maskEditor.value) return;
  try {
    const mask = await maskEditor.value.toMaskBlob();
    const form = new FormData();
    form.append("operation", "watermark_remove");
    form.append("files", watermarkFile.value);
    form.append("mask", mask, "mask.png");
    activeTask.value = await imageAiApi.createTask(form);
    await pollTask(activeTask.value.id);
    const result = activeTask.value?.results[0];
    if (result) watermarkResultUrl.value = absoluteImageAiUrl(result.downloadUrl);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "去水印失败");
  }
}

async function submitBatch(operation: "enhance" | "background_remove") {
  const files = operation === "enhance" ? enhanceFiles.value : cutoutFiles.value;
  if (!files.length) return;
  const form = new FormData();
  form.append("operation", operation);
  if (operation === "enhance") form.append("scale", String(enhanceScale.value));
  files.forEach((file) => form.append("files", file));
  try {
    activeTask.value = await imageAiApi.createTask(form);
    activeTaskFiles.value = [...files];
    await pollTask(activeTask.value.id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "图片处理失败");
  }
}

function downloadWatermarkResult() {
  const result = activeTask.value?.results[0];
  if (result) triggerImageAiDownload(resultDownloadUrl(result.downloadUrl));
}

async function pollTask(taskId: string): Promise<void> {
  if (pollTimer) clearTimeout(pollTimer);
  const task = await imageAiApi.getTask(taskId);
  activeTask.value = task;
  if (task.status === "pending" || task.status === "running") {
    await new Promise<void>((resolve) => {
      pollTimer = setTimeout(() => resolve(), 900);
    });
    return pollTask(taskId);
  }
  if (task.status === "completed") message.success(`处理完成，共生成 ${task.results.length} 张图片`);
  else if (task.status === "canceled") message.info("任务已取消");
  else message.error(task.error || "任务处理失败");
}

async function cancelActiveTask() {
  if (!activeTask.value) return;
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

const BatchPicker = defineComponent({
  name: "BatchPicker",
  props: {
    title: { type: String, required: true },
    hint: { type: String, required: true },
    files: { type: Array as PropType<File[]>, required: true },
    disabled: Boolean,
    checkerboard: Boolean
  },
  emits: ["change"],
  setup(props, { emit }) {
    const previews = computed(() => props.files.map((file) => ({ file, url: URL.createObjectURL(file) })));
    watch(previews, (_next, previous) => previous?.forEach((item) => URL.revokeObjectURL(item.url)));
    onBeforeUnmount(() => previews.value.forEach((item) => URL.revokeObjectURL(item.url)));
    const select = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const next = Array.from(input.files ?? [])
        .filter(validateClientFile)
        .slice(0, 10);
      input.value = "";
      emit("change", next);
    };
    const remove = (index: number) =>
      emit(
        "change",
        props.files.filter((_file, current) => current !== index)
      );
    return () =>
      h("div", { class: "image-ai-stage" }, [
        h("label", { class: "dropzone image-ai-dropzone compact" }, [
          h("input", {
            hidden: true,
            multiple: true,
            type: "file",
            accept: "image/jpeg,image/png,image/webp",
            disabled: props.disabled,
            onChange: select
          }),
          h(Images, { size: 30 }),
          h("strong", props.title),
          h("span", props.hint)
        ]),
        previews.value.length
          ? h(
              "div",
              { class: "batch-preview-grid" },
              previews.value.map((item, index) =>
                h("article", { class: ["batch-preview-card", props.checkerboard && "checkerboard"] }, [
                  h("img", { src: item.url, alt: item.file.name }),
                  h("div", [h("strong", item.file.name), h("span", formatBytes(item.file.size))]),
                  h(
                    NButton,
                    {
                      circle: true,
                      size: "tiny",
                      tertiary: true,
                      disabled: props.disabled,
                      onClick: () => remove(index)
                    },
                    { icon: () => h(X, { size: 14 }) }
                  )
                ])
              )
            )
          : h(NEmpty, { description: "暂无待处理图片", class: "batch-empty" })
      ]);
  }
});

const TaskStatusCard = defineComponent({
  name: "TaskStatusCard",
  props: { task: Object as PropType<ImageAiTask> },
  emits: ["cancel"],
  setup(props, { emit }) {
    return () => {
      if (!props.task) return null;
      const running = props.task.status === "pending" || props.task.status === "running";
      return h("div", { class: "ai-task-card" }, [
        h("div", { class: "ai-task-heading" }, [
          h("strong", statusName(props.task.status)),
          props.task.queuePosition ? h("span", `队列第 ${props.task.queuePosition} 位`) : null
        ]),
        h(NProgress, {
          percentage: props.task.progress,
          status: props.task.status === "failed" ? "error" : props.task.status === "completed" ? "success" : "default"
        }),
        props.task.error ? h("p", { class: "status-error" }, props.task.error) : null,
        ...props.task.warnings.slice(-3).map((warning) => h("p", { class: "status-hint" }, warning)),
        running
          ? h(
              NButton,
              { block: true, size: "small", secondary: true, type: "error", onClick: () => emit("cancel") },
              { default: () => "取消任务", icon: () => h(Trash2, { size: 15 }) }
            )
          : null
      ]);
    };
  }
});

const ResultGallery = defineComponent({
  name: "ResultGallery",
  props: {
    task: { type: Object as PropType<ImageAiTask>, required: true },
    sourceFiles: { type: Array as PropType<File[]>, required: true },
    checkerboard: Boolean
  },
  setup(props) {
    const sourceUrls = ref<string[]>([]);

    function refreshSourceUrls(files: File[]) {
      sourceUrls.value.forEach((url) => URL.revokeObjectURL(url));
      sourceUrls.value = files.map((file) => URL.createObjectURL(file));
    }

    watch(() => props.sourceFiles, refreshSourceUrls, { immediate: true });
    onBeforeUnmount(() => sourceUrls.value.forEach((url) => URL.revokeObjectURL(url)));

    function sourceUrlForResult(resultId: string) {
      const rawIndex = resultId.slice(props.task.id.length + 1);
      const index = Number(rawIndex) - 1;
      return Number.isInteger(index) && index >= 0 ? sourceUrls.value[index] : undefined;
    }

    function downloadAll() {
      triggerImageAiDownload(`/api/tools/image-ai/tasks/${props.task.id}/download.zip`);
    }

    return () =>
      props.task.results.length
        ? h("section", { class: "result-panel image-ai-results" }, [
            h("div", { class: "panel-heading" }, [
              h("div", [h("h3", "处理结果"), h("p", `${props.task.results.length} 张图片将在 24 小时后自动清理`)]),
              props.task.results.length > 1
                ? h(
                    NButton,
                    { type: "primary", secondary: true, onClick: downloadAll },
                    { default: () => "下载 ZIP", icon: () => h(Download, { size: 15 }) }
                  )
                : null
            ]),
            h(
              "div",
              { class: "result-gallery-grid" },
              props.task.results.map((result) => {
                const sourceUrl = sourceUrlForResult(result.id);
                return h("article", { class: "result-gallery-card" }, [
                  sourceUrl
                    ? h(BeforeAfterCompare, {
                        beforeUrl: sourceUrl,
                        afterUrl: absoluteImageAiUrl(result.downloadUrl),
                        checkerboard: props.checkerboard,
                        compact: true
                      })
                    : h("img", { src: absoluteImageAiUrl(result.downloadUrl), alt: result.outputName }),
                  h("div", { class: "result-gallery-meta" }, [
                    h("strong", result.outputName),
                    h("span", `${result.width} × ${result.height} · ${result.model}`),
                    h(
                      NButton,
                      {
                        size: "small",
                        secondary: true,
                        onClick: () => triggerImageAiDownload(resultDownloadUrl(result.downloadUrl))
                      },
                      { default: () => "下载", icon: () => h(Download, { size: 14 }) }
                    )
                  ])
                ]);
              })
            )
          ])
        : null;
  }
});

function statusName(status: ImageAiTask["status"]) {
  return (
    {
      pending: "等待处理",
      running: "AI 处理中",
      completed: "处理完成",
      failed: "处理失败",
      canceled: "已取消"
    } as const
  )[status];
}
</script>

<style scoped>
.image-ai-install-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 20px;
  align-items: center;
  padding: 24px;
  margin-bottom: 16px;
  border: 1px solid #bfdbfe;
  background: linear-gradient(135deg, #eff6ff, #ffffff);
}

.image-ai-install-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  color: #1d4ed8;
  background: #dbeafe;
}

.image-ai-install-copy h3 {
  margin: 4px 0 6px;
  font-size: 18px;
}

.image-ai-install-copy p {
  margin: 0;
  color: #475569;
}

.image-ai-install-note {
  margin-top: 6px !important;
  font-size: 13px;
}

.image-ai-install-progress {
  margin-top: 14px;
}

.image-ai-install-progress-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
  color: #1e3a8a;
  font-size: 13px;
}

.image-ai-install-progress-heading strong {
  color: #0f766e;
  font-variant-numeric: tabular-nums;
}

.image-ai-install-progress small {
  display: block;
  margin-top: 6px;
  color: #64748b;
  line-height: 1.45;
}

.image-ai-install-actions {
  display: grid;
  gap: 8px;
  min-width: 210px;
}

.image-ai-install-actions small {
  max-width: 240px;
  color: #64748b;
  line-height: 1.45;
}

.image-ai-worker-alert {
  margin-bottom: 14px;
}

.image-ai-worker-alert-content {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 760px) {
  .image-ai-install-panel {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .image-ai-install-actions {
    grid-column: 1 / -1;
    min-width: 0;
  }
}
</style>
