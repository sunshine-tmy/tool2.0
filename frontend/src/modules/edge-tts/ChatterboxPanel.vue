<template>
  <div class="chatterbox-panel">
    <div class="chatterbox-notice">
      <ShieldCheck :size="19" />
      <div>
        <strong>仅克隆你本人或已获得明确授权的声音</strong>
        <span>参考音频仅在本机处理，生成结束后立即删除；结果包含 Chatterbox PerTh AI 音频水印。</span>
      </div>
      <n-tag :type="health?.available ? 'success' : 'error'" round>
        {{ healthLabel }}
      </n-tag>
    </div>

    <section class="edge-tts-workbench chatterbox-workbench">
      <div class="edge-tts-editor chatterbox-editor">
        <div class="panel-heading">
          <div>
            <h3>参考音色</h3>
            <p>推荐 10–20 秒、单人、无背景音乐且与目标语言一致的清晰录音。</p>
          </div>
          <span>5–30 秒 · 最大 20 MB</span>
        </div>

        <label class="chatterbox-dropzone" :class="{ 'has-file': referenceFile }">
          <input type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac" @change="selectReference" />
          <template v-if="referenceFile">
            <FileAudio :size="30" />
            <strong>{{ referenceFile.name }}</strong>
            <span>{{ formatBytes(referenceFile.size) }} · 点击重新选择</span>
          </template>
          <template v-else>
            <UploadCloud :size="32" />
            <strong>上传参考音频</strong>
            <span>支持 WAV、MP3、M4A、FLAC 等常见格式</span>
          </template>
        </label>
        <audio v-if="referencePreview" class="edge-tts-player" controls preload="metadata" :src="referencePreview" />

        <div class="panel-heading chatterbox-copy-heading">
          <div>
            <h3>生成文案</h3>
            <p>长文会自动分段生成并合并为一个 MP3。</p>
          </div>
          <span :class="{ 'is-limit': text.length >= maxTextLength }">{{ text.length }} / {{ maxTextLength }}</span>
        </div>
        <n-input
          v-model:value="text"
          type="textarea"
          :maxlength="maxTextLength"
          show-count
          :autosize="{ minRows: 8, maxRows: 16 }"
          placeholder="输入要用参考音色生成的马来语或英语文案…"
        />
        <div class="edge-tts-editor-footer">
          <n-input v-model:value="fileName" maxlength="100" clearable placeholder="导出文件名（可选）" />
          <span>本机 GPU 生成</span>
        </div>
      </div>

      <aside class="edge-tts-controls chatterbox-controls">
        <div class="control-section">
          <label>目标语言</label>
          <div class="edge-tts-language-grid chatterbox-language-grid">
            <button type="button" :class="{ active: language === 'ms' }" @click="language = 'ms'">
              <strong>Bahasa Melayu</strong><span>马来语</span>
            </button>
            <button type="button" :class="{ active: language === 'en' }" @click="language = 'en'">
              <strong>English</strong><span>英语</span>
            </button>
          </div>
        </div>

        <div class="control-section">
          <div class="control-label-row">
            <label>生成参数</label><button type="button" @click="resetParameters">恢复默认</button>
          </div>
          <label class="range-control">
            <span
              >情绪强度 <strong>{{ exaggeration.toFixed(2) }}</strong></span
            >
            <input v-model.number="exaggeration" type="range" min="0.25" max="1.5" step="0.05" />
          </label>
          <label class="range-control">
            <span
              >音色遵循 <strong>{{ cfgWeight.toFixed(2) }}</strong></span
            >
            <input v-model.number="cfgWeight" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="range-control">
            <span
              >随机度 <strong>{{ temperature.toFixed(2) }}</strong></span
            >
            <input v-model.number="temperature" type="range" min="0.1" max="1.5" step="0.05" />
          </label>
          <label class="chatterbox-seed">
            <span>随机种子</span>
            <n-input-number v-model:value="seed" :min="0" :max="2147483647" :precision="0" />
          </label>
        </div>

        <div class="control-section chatterbox-consent">
          <label>声音来源</label>
          <select v-model="authorization">
            <option value="self">这是我本人的声音</option>
            <option value="authorized">已取得声音所有者明确授权</option>
          </select>
          <label class="edge-tts-checkbox">
            <input v-model="consentConfirmed" type="checkbox" />
            我确认拥有合法使用与克隆该声音的权利，不用于冒充、欺诈或误导。
          </label>
        </div>

        <label class="edge-tts-checkbox">
          <input v-model="includeSubtitles" type="checkbox" /> 同时生成整句分段、按音频对齐的 SRT 字幕
        </label>
        <n-button
          type="primary"
          size="large"
          block
          :loading="creating || isCurrentRunning"
          :disabled="!canCreate"
          @click="createTask"
        >
          <template #icon><Mic2 :size="18" /></template>
          {{ isCurrentRunning ? `本机生成中 ${currentTask?.progress || 0}%` : "克隆音色并生成" }}
        </n-button>
        <p v-if="health?.available && !health.modelLoaded" class="chatterbox-hint">
          首次生成需下载并加载约数 GB 模型，耗时会明显长于后续任务。
        </p>
        <p v-if="!health?.available" class="edge-tts-error">
          请运行 <code>scripts\setup-chatterbox.ps1 -DownloadModel</code>，然后重新一键启动。
        </p>
        <p v-if="errorMessage" class="edge-tts-error">{{ errorMessage }}</p>
      </aside>
    </section>

    <section v-if="currentTask" class="edge-tts-result" :class="`status-${currentTask.status}`">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">LATEST CLONE</p>
          <h3>{{ taskTitle(currentTask) }}</h3>
          <p>
            {{ statusLabel(currentTask.status) }} · {{ languageLabel(currentTask.language) }} · 参考
            {{ currentTask.referenceDurationSeconds }} 秒
          </p>
        </div>
        <n-tag :type="taskTagType(currentTask.status)">{{ statusLabel(currentTask.status) }}</n-tag>
      </div>
      <div v-if="isCurrentRunning" class="edge-tts-progress">
        <span :style="{ width: `${Math.max(4, currentTask.progress)}%` }" />
      </div>
      <template v-if="currentTask.status === 'completed'">
        <audio class="edge-tts-player" controls preload="metadata" :src="mediaUrl(currentTask.audioUrl)" />
        <div class="edge-tts-result-actions">
          <a class="download-button primary" :href="mediaUrl(currentTask.downloadUrl)"
            ><Download :size="17" />下载 MP3</a
          >
          <a v-if="currentTask.subtitleUrl" class="download-button" :href="mediaUrl(currentTask.subtitleUrl)"
            ><Captions :size="17" />下载 SRT</a
          >
          <n-button secondary @click="reuseTask(currentTask)">复用文案与参数</n-button>
        </div>
      </template>
      <p v-if="currentTask.error" class="edge-tts-error">{{ currentTask.error }}</p>
    </section>

    <section class="edge-tts-history">
      <div class="panel-heading">
        <div>
          <h3>声音克隆记录</h3>
          <p>结果保留 {{ health?.retentionDays || 3 }} 天；参考音频不会保留。</p>
        </div>
        <n-button secondary :loading="loadingHistory" @click="loadHistory"><RefreshCw :size="16" />刷新</n-button>
      </div>
      <div v-if="history.tasks.length" class="edge-tts-history-list">
        <article v-for="task in history.tasks" :key="task.id">
          <div class="history-main">
            <div class="voice-avatar"><Mic2 :size="18" /></div>
            <div>
              <strong>{{ taskTitle(task) }}</strong>
              <p>{{ task.textPreview }}</p>
              <span
                >{{ languageLabel(task.language) }} · {{ formatDate(task.createdAt) }} ·
                {{ statusLabel(task.status) }}</span
              >
            </div>
          </div>
          <div class="history-actions">
            <button
              v-if="task.audioUrl"
              type="button"
              :title="previewTaskId === task.id ? '收起试听' : '试听音频'"
              @click="togglePreview(task.id)"
            >
              <ChevronUp v-if="previewTaskId === task.id" :size="17" />
              <Play v-else :size="17" />
            </button>
            <a v-if="task.downloadUrl" :href="mediaUrl(task.downloadUrl)" title="下载 MP3"><Download :size="17" /></a>
            <a v-if="task.subtitleUrl" :href="mediaUrl(task.subtitleUrl)" title="下载 SRT 字幕">
              <Captions :size="17" />
            </a>
            <button type="button" title="复用文案与参数" @click="loadTaskForReuse(task.id)">
              <RotateCcw :size="17" />
            </button>
            <button type="button" title="删除" @click="removeTask(task.id)"><Trash2 :size="17" /></button>
          </div>
          <audio
            v-if="previewTaskId === task.id && task.audioUrl"
            class="chatterbox-history-player"
            controls
            autoplay
            preload="metadata"
            :src="mediaUrl(task.audioUrl)"
            @ended="previewTaskId = undefined"
          />
        </article>
      </div>
      <n-empty v-else-if="!loadingHistory" description="还没有声音克隆记录" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { NButton, NEmpty, NInput, NInputNumber, NTag, useMessage } from "naive-ui";
import {
  Captions,
  ChevronUp,
  Download,
  FileAudio,
  Mic2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud
} from "lucide-vue-next";
import {
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_TEXT_LENGTH,
  type ChatterboxHealth,
  type ChatterboxLanguage,
  type ChatterboxTask,
  type ChatterboxTaskList,
  type ChatterboxTaskStatus,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import { resolveBackendUrl } from "../../config/runtime";
import { chatterboxApi } from "./chatterbox-api";

const message = useMessage();
const maxTextLength = CHATTERBOX_MAX_TEXT_LENGTH;
const health = ref<ChatterboxHealth>();
const referenceFile = ref<File>();
const referencePreview = ref("");
const text = ref("");
const fileName = ref("");
const language = ref<ChatterboxLanguage>("ms");
const authorization = ref<ChatterboxVoiceAuthorization>("self");
const consentConfirmed = ref(false);
const exaggeration = ref(0.5);
const cfgWeight = ref(0.5);
const temperature = ref(0.8);
const seed = ref(0);
const includeSubtitles = ref(true);
const creating = ref(false);
const loadingHistory = ref(false);
const currentTask = ref<ChatterboxTask>();
const previewTaskId = ref<string>();
const errorMessage = ref("");
const history = ref<ChatterboxTaskList>({ tasks: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
let pollTimer: ReturnType<typeof setTimeout> | undefined;

const isCurrentRunning = computed(
  () => currentTask.value?.status === "queued" || currentTask.value?.status === "processing"
);
const canCreate = computed(() =>
  Boolean(
    health.value?.available &&
    referenceFile.value &&
    text.value.trim() &&
    consentConfirmed.value &&
    !isCurrentRunning.value
  )
);
const healthLabel = computed(() => {
  if (!health.value?.available) return "克隆环境未就绪";
  const device = health.value.gpuName || health.value.device?.toUpperCase() || "本机";
  return health.value.modelLoaded ? `V3 已加载 · ${device}` : `V3 待加载 · ${device}`;
});

onMounted(() => void Promise.all([loadHealth(), loadHistory()]));
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer);
  revokePreview();
});

function selectReference(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > CHATTERBOX_MAX_REFERENCE_BYTES) {
    message.error("参考音频不能超过 20 MB");
    input.value = "";
    return;
  }
  revokePreview();
  referenceFile.value = file;
  referencePreview.value = URL.createObjectURL(file);
}

async function loadHealth() {
  try {
    health.value = await chatterboxApi.health();
  } catch (error) {
    errorMessage.value = readableError(error, "无法读取声音克隆服务状态");
  }
}

async function createTask() {
  if (!referenceFile.value || !canCreate.value) return;
  creating.value = true;
  errorMessage.value = "";
  try {
    currentTask.value = await chatterboxApi.create({
      reference: referenceFile.value,
      text: text.value.trim(),
      language: language.value,
      authorization: authorization.value,
      consentConfirmed: consentConfirmed.value,
      exaggeration: exaggeration.value,
      cfgWeight: cfgWeight.value,
      temperature: temperature.value,
      seed: seed.value ?? 0,
      includeSubtitles: includeSubtitles.value,
      fileName: fileName.value.trim() || undefined
    });
    schedulePoll();
    await loadHistory();
  } catch (error) {
    errorMessage.value = readableError(error, "声音克隆任务创建失败");
  } finally {
    creating.value = false;
  }
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  if (!currentTask.value || !["queued", "processing"].includes(currentTask.value.status)) return;
  pollTimer = setTimeout(async () => {
    try {
      if (!currentTask.value) return;
      currentTask.value = await chatterboxApi.task(currentTask.value.id);
      if (currentTask.value.status === "completed") {
        message.success("声音克隆生成完成");
        await loadHistory();
      }
      if (currentTask.value.status === "failed") {
        errorMessage.value = currentTask.value.error || "声音克隆失败";
        await loadHistory();
      }
    } catch (error) {
      errorMessage.value = readableError(error, "任务状态读取失败");
    } finally {
      schedulePoll();
    }
  }, 1500);
}

async function loadHistory() {
  loadingHistory.value = true;
  try {
    history.value = await chatterboxApi.list(1, 10);
  } catch (error) {
    errorMessage.value = readableError(error, "记录读取失败");
  } finally {
    loadingHistory.value = false;
  }
}

async function loadTaskForReuse(id: string) {
  try {
    reuseTask(await chatterboxApi.task(id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    message.error(readableError(error, "任务读取失败"));
  }
}

function reuseTask(task: ChatterboxTask) {
  text.value = task.text;
  language.value = task.language;
  authorization.value = task.authorization;
  exaggeration.value = task.exaggeration;
  cfgWeight.value = task.cfgWeight;
  temperature.value = task.temperature;
  seed.value = task.seed;
  includeSubtitles.value = task.includeSubtitles;
  fileName.value = task.fileName || "";
  consentConfirmed.value = false;
  message.info("文案与参数已复用，请重新上传参考音频并确认授权");
}

async function removeTask(id: string) {
  if (!window.confirm("删除这条声音克隆记录和生成文件？")) return;
  try {
    await chatterboxApi.remove(id);
    if (currentTask.value?.id === id) currentTask.value = undefined;
    if (previewTaskId.value === id) previewTaskId.value = undefined;
    await loadHistory();
    message.success("记录已删除");
  } catch (error) {
    message.error(readableError(error, "删除失败"));
  }
}

function togglePreview(taskId: string) {
  previewTaskId.value = previewTaskId.value === taskId ? undefined : taskId;
}

function resetParameters() {
  exaggeration.value = 0.5;
  cfgWeight.value = 0.5;
  temperature.value = 0.8;
  seed.value = 0;
}
function revokePreview() {
  if (referencePreview.value) URL.revokeObjectURL(referencePreview.value);
  referencePreview.value = "";
}
function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}
function languageLabel(value: ChatterboxLanguage) {
  return value === "ms" ? "Bahasa Melayu" : "English";
}
function taskTitle(task: { fileName?: string; id: string }) {
  return task.fileName || `克隆语音 ${task.id.slice(0, 6)}`;
}
function statusLabel(status: ChatterboxTaskStatus) {
  return { queued: "排队中", processing: "生成中", completed: "已完成", failed: "失败", cancelled: "已取消" }[status];
}
function taskTagType(status: ChatterboxTaskStatus): "success" | "warning" | "error" | "default" {
  return status === "completed" ? "success" : status === "failed" || status === "cancelled" ? "error" : "warning";
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
function mediaUrl(value: string | undefined) {
  return value ? resolveBackendUrl(value) : undefined;
}
function readableError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
</script>
