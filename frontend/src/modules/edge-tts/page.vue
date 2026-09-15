<!-- 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互 -->
<template>
  <ToolLayout>
    <section class="edge-tts-page">
      <ToolPageHeader
        title="多国语言配音"
        description="在线自然音色和参考音色克隆均支持马来语、英语和巴西葡萄牙语。"
        kicker="MULTILINGUAL SPEECH"
      >
        <template #actions>
          <n-tag v-if="engine === 'edge'" :type="health?.available ? 'success' : 'error'" round>
            {{ health?.available ? `Edge-TTS ${health.version || "已就绪"}` : "运行环境未安装" }}
          </n-tag>
          <n-tag v-else type="info" round>Chatterbox Multilingual V3</n-tag>
        </template>
      </ToolPageHeader>

      <div v-if="engine === 'edge'" class="edge-tts-privacy">
        <Cloud :size="18" />
        <span>此功能需要联网，输入文字会发送到微软在线语音服务；生成文件默认在本机保留 3 天。</span>
      </div>

      <div class="edge-tts-engine-tabs" role="tablist" aria-label="配音引擎">
        <button
          type="button"
          :class="{ active: engine === 'edge' }"
          role="tab"
          :aria-selected="engine === 'edge'"
          @click="engine = 'edge'"
        >
          <Cloud :size="18" /><span><strong>在线自然音色</strong><small>Edge-TTS · 免参考音频</small></span>
        </button>
        <button
          type="button"
          :class="{ active: engine === 'chatterbox' }"
          role="tab"
          :aria-selected="engine === 'chatterbox'"
          @click="engine = 'chatterbox'"
        >
          <Mic2 :size="18" /><span><strong>参考音色克隆</strong><small>Chatterbox V3 · 本机 GPU</small></span>
        </button>
      </div>

      <template v-if="engine === 'edge'">
        <section class="edge-tts-workbench">
          <div class="edge-tts-editor">
            <div class="panel-heading">
              <div>
                <h3>配音文案</h3>
                <p>建议使用完整标点，停顿和语气会更自然。</p>
              </div>
              <span :class="{ 'is-limit': text.length >= maxTextLength }">{{ text.length }} / {{ maxTextLength }}</span>
            </div>
            <n-input
              v-model:value="text"
              type="textarea"
              :maxlength="maxTextLength"
              show-count
              :autosize="{ minRows: 13, maxRows: 22 }"
              placeholder="例如：Selamat datang ke kedai kami. Hari ini kami ingin memperkenalkan produk terbaru…"
            />
            <div class="edge-tts-editor-footer">
              <n-input v-model:value="fileName" maxlength="100" clearable placeholder="导出文件名（可选）" />
              <span>预计约 {{ estimatedDuration }} 分钟</span>
            </div>
          </div>

          <aside class="edge-tts-controls">
            <div class="control-section">
              <label>语言与口音</label>
              <div class="edge-tts-language-grid">
                <button
                  v-for="item in languages"
                  :key="item.value"
                  type="button"
                  :class="{ active: language === item.value }"
                  @click="language = item.value"
                >
                  <strong>{{ item.title }}</strong
                  ><span>{{ item.description }}</span>
                </button>
              </div>
            </div>

            <div class="control-section">
              <div class="control-label-row">
                <label>音色</label><span>{{ loadingVoices ? "更新中…" : `${voices.length} 个可用` }}</span>
              </div>
              <div class="edge-tts-voices">
                <button
                  v-for="item in voices"
                  :key="item.shortName"
                  type="button"
                  :class="{ active: voice === item.shortName }"
                  @click="voice = item.shortName"
                >
                  <span class="voice-avatar"><UserRound :size="16" /></span>
                  <span
                    ><strong>{{ voiceDisplayName(item) }}</strong
                    ><small>{{ genderLabel(item.gender) }}</small></span
                  >
                  <Check v-if="voice === item.shortName" :size="17" />
                </button>
              </div>
            </div>

            <div class="control-section">
              <div class="control-label-row">
                <label>参数预设</label
                ><n-button text type="primary" size="tiny" @click="resetControls">恢复默认</n-button>
              </div>
              <div class="edge-tts-presets">
                <button v-for="preset in presets" :key="preset.name" type="button" @click="applyPreset(preset)">
                  {{ preset.name }}
                </button>
              </div>
              <label class="range-control">
                <span
                  >语速 <strong>{{ signed(rate) }}%</strong></span
                >
                <n-slider v-model:value="rate" :min="-50" :max="100" :step="5" :tooltip="false" />
              </label>
              <label class="range-control">
                <span
                  >音量 <strong>{{ signed(volume) }}%</strong></span
                >
                <n-slider v-model:value="volume" :min="-50" :max="50" :step="5" :tooltip="false" />
              </label>
              <label class="range-control">
                <span
                  >音调 <strong>{{ signed(pitch) }}Hz</strong></span
                >
                <n-slider v-model:value="pitch" :min="-50" :max="50" :step="5" :tooltip="false" />
              </label>
            </div>

            <n-checkbox v-model:checked="includeSubtitles">同时生成 SRT 字幕</n-checkbox>
            <n-button
              type="primary"
              size="large"
              block
              :loading="creating || isCurrentRunning"
              :disabled="!health?.available || !text.trim() || !voice"
              @click="createTask"
            >
              <template #icon><AudioLines :size="18" /></template>
              {{ isCurrentRunning ? `正在生成 ${currentTask?.progress || 0}%` : "生成语音" }}
            </n-button>
            <p v-if="!health?.available" class="edge-tts-error">
              请运行 <code>scripts\setup-edge-tts.ps1</code>，或重新执行一键启动。
            </p>
            <p v-if="errorMessage" class="edge-tts-error">{{ errorMessage }}</p>
          </aside>
        </section>

        <section v-if="currentTask" class="edge-tts-result" :class="`status-${currentTask.status}`">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">LATEST RESULT</p>
              <h3>{{ taskTitle(currentTask) }}</h3>
              <p>
                {{ statusLabel(currentTask.status) }} · {{ languageLabel(currentTask.language) }} ·
                {{ currentTask.voice }}
              </p>
            </div>
            <n-tag :type="taskTagType(currentTask.status)">{{ statusLabel(currentTask.status) }}</n-tag>
          </div>
          <div v-if="currentTask.status === 'processing' || currentTask.status === 'queued'" class="edge-tts-progress">
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
              <n-button secondary @click="reuseTask(currentTask)">再次编辑</n-button>
            </div>
          </template>
          <p v-if="currentTask.error" class="edge-tts-error">{{ currentTask.error }}</p>
        </section>

        <section class="edge-tts-history">
          <div class="panel-heading">
            <div>
              <h3>最近生成</h3>
              <p>生成文件默认保留 {{ health?.retentionDays || 3 }} 天，可随时删除或重新使用文案。</p>
            </div>
            <n-button secondary :loading="loadingHistory" @click="loadHistory"><RefreshCw :size="16" />刷新</n-button>
          </div>
          <div v-if="history.tasks.length" class="edge-tts-history-list">
            <article v-for="task in history.tasks" :key="task.id">
              <div class="history-main">
                <div class="voice-avatar"><AudioLines :size="18" /></div>
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
                <a v-if="task.downloadUrl" :href="mediaUrl(task.downloadUrl)" title="下载 MP3"
                  ><Download :size="17"
                /></a>
                <n-button circle quaternary size="small" title="重新使用文案" @click="loadTaskForReuse(task.id)">
                  <RotateCcw :size="17" />
                </n-button>
                <n-button circle quaternary size="small" type="error" title="删除" @click="removeTask(task.id)"
                  ><Trash2 :size="17"
                /></n-button>
              </div>
            </article>
          </div>
          <n-empty v-else-if="!loadingHistory" description="还没有生成记录" />
          <div v-if="history.pagination.totalPages > 1" class="pagination">
            <n-button
              size="small"
              :disabled="history.pagination.page <= 1"
              @click="changePage(history.pagination.page - 1)"
              >上一页</n-button
            >
            <span>{{ history.pagination.page }} / {{ history.pagination.totalPages }}</span>
            <n-button
              size="small"
              :disabled="history.pagination.page >= history.pagination.totalPages"
              @click="changePage(history.pagination.page + 1)"
              >下一页</n-button
            >
          </div>
        </section>
      </template>
      <ChatterboxPanel v-else />
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { NButton, NCheckbox, NEmpty, NInput, NSlider, NTag, useMessage } from "naive-ui";
import {
  AudioLines,
  Captions,
  Check,
  Cloud,
  Download,
  Mic2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserRound
} from "lucide-vue-next";
import {
  EDGE_TTS_MAX_TEXT_LENGTH,
  type EdgeTtsHealth,
  type EdgeTtsLanguage,
  type EdgeTtsTask,
  type EdgeTtsTaskList,
  type EdgeTtsTaskStatus,
  type EdgeTtsVoice
} from "@toolbox/shared";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { useRequestScope } from "../../composables/useRequestScope";
import { useTaskEvents } from "../../composables/useTaskEvents";
import { resolveBackendUrl } from "../../config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { edgeTtsApi } from "./api";
import ChatterboxPanel from "./ChatterboxPanel.vue";

const message = useMessage();
const confirmAction = useConfirmDialog();
const engine = ref<"edge" | "chatterbox">("edge");
const maxTextLength = EDGE_TTS_MAX_TEXT_LENGTH;
const health = ref<EdgeTtsHealth>();
const voices = ref<EdgeTtsVoice[]>([]);
const language = ref<EdgeTtsLanguage>("ms-MY");
const voice = ref("ms-MY-YasminNeural");
const text = ref("");
const fileName = ref("");
const rate = ref(0);
const volume = ref(0);
const pitch = ref(0);
const includeSubtitles = ref(true);
const creating = ref(false);
const loadingVoices = ref(false);
const loadingHistory = ref(false);
const currentTask = ref<EdgeTtsTask>();
const errorMessage = ref("");
const historyPage = ref(1);
const history = ref<EdgeTtsTaskList>({
  tasks: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
});

const languages: Array<{ value: EdgeTtsLanguage; title: string; description: string }> = [
  { value: "ms-MY", title: "Bahasa Melayu", description: "马来西亚马来语" },
  { value: "en-US", title: "English US", description: "美式英语" },
  { value: "en-GB", title: "English UK", description: "英式英语" },
  { value: "pt-BR", title: "Português BR", description: "巴西葡萄牙语" }
];
const presets = [
  { name: "自然讲解", rate: 0, volume: 0, pitch: 0 },
  { name: "商品介绍", rate: 10, volume: 5, pitch: 5 },
  { name: "短视频快节奏", rate: 25, volume: 10, pitch: 5 },
  { name: "稳重旁白", rate: -10, volume: 0, pitch: -5 }
];

const estimatedDuration = computed(() =>
  Math.max(0.1, text.value.length / (language.value === "ms-MY" ? 850 : 950)).toFixed(1)
);
const isCurrentRunning = computed(
  () => currentTask.value?.status === "queued" || currentTask.value?.status === "processing"
);
const streamedTaskId = computed(() => (isCurrentRunning.value ? currentTask.value?.id : undefined));
const requestScope = useRequestScope();
const taskEvents = useTaskEvents(streamedTaskId, { signal: requestScope.signal });

watch(language, async () => {
  // 语言变化后重新读取可用音色，并在 loadVoices 中修正已失效的选中值。
  await loadVoices();
});

onMounted(async () => {
  // 首屏并行加载健康状态、音色和历史记录，三者互不依赖。
  await Promise.all([loadHealth(), loadVoices(), loadHistory()]);
});

watch(taskEvents.task, (task) => {
  // 任务事件只更新当前任务；进入终态后补拉详情以获得最终媒体 URL 和错误信息。
  if (!task || task.id !== currentTask.value?.id) return;
  currentTask.value = {
    ...currentTask.value,
    status: task.status === "pending" ? "queued" : task.status === "running" ? "processing" : task.status,
    progress: task.progress,
    error: task.error,
    updatedAt: task.updatedAt
  };
  if (task.status === "completed" || task.status === "failed") void finishCurrentTask(task.id);
});

watch(taskEvents.error, (error) => {
  if (error && !isApiErrorCancelled(error)) errorMessage.value = formatApiError(error);
});

async function loadHealth() {
  try {
    health.value = await edgeTtsApi.health();
  } catch (error) {
    if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "无法读取语音服务状态");
  }
}

async function loadVoices() {
  loadingVoices.value = true;
  try {
    const result = await edgeTtsApi.voices(language.value);
    voices.value = result.voices;
    if (!voices.value.some((item) => item.shortName === voice.value)) {
      voice.value = voices.value.find((item) => item.suggested)?.shortName || voices.value[0]?.shortName || "";
    }
  } catch (error) {
    if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "音色读取失败");
  } finally {
    loadingVoices.value = false;
  }
}

async function createTask() {
  if (!text.value.trim() || !voice.value) return;
  // 提交前使用 trim 后的文本和当前语音参数，服务端返回的任务 ID 作为后续 SSE 订阅依据。
  creating.value = true;
  errorMessage.value = "";
  try {
    currentTask.value = await edgeTtsApi.create({
      text: text.value.trim(),
      language: language.value,
      voice: voice.value,
      rate: rate.value,
      volume: volume.value,
      pitch: pitch.value,
      includeSubtitles: includeSubtitles.value,
      fileName: fileName.value.trim() || undefined
    });
    await loadHistory();
  } catch (error) {
    if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "语音任务创建失败");
  } finally {
    creating.value = false;
  }
}

async function finishCurrentTask(taskId: string) {
  try {
    // 终态事件后的详情请求是幂等补偿，避免历史列表早于音频文件落盘完成。
    const task = await edgeTtsApi.task(taskId);
    if (currentTask.value?.id !== taskId) return;
    currentTask.value = task;
    if (task.status === "completed") message.success("语音生成完成");
    else errorMessage.value = task.error || "语音生成失败";
    await loadHistory();
  } catch (error) {
    if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "任务结果读取失败");
  }
}

async function loadHistory() {
  loadingHistory.value = true;
  try {
    history.value = await edgeTtsApi.list(historyPage.value, 10);
    historyPage.value = history.value.pagination.page;
  } finally {
    loadingHistory.value = false;
  }
}

async function changePage(page: number) {
  historyPage.value = page;
  await loadHistory();
}

async function loadTaskForReuse(id: string) {
  try {
    reuseTask(await edgeTtsApi.task(id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "任务读取失败"));
  }
}

function reuseTask(task: EdgeTtsTask) {
  text.value = task.text;
  language.value = task.language;
  voice.value = task.voice;
  rate.value = task.rate;
  volume.value = task.volume;
  pitch.value = task.pitch;
  includeSubtitles.value = task.includeSubtitles;
  fileName.value = task.fileName || "";
}

async function removeTask(id: string) {
  if (!(await confirmAction("删除这条语音记录和生成文件？", { title: "删除语音记录" }))) return;
  try {
    // 删除成功后同步清空当前任务引用并刷新分页，避免播放器继续指向已删除文件。
    await edgeTtsApi.remove(id);
    if (currentTask.value?.id === id) currentTask.value = undefined;
    await loadHistory();
    message.success("语音记录已删除");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "删除失败"));
  }
}

function resetControls() {
  rate.value = 0;
  volume.value = 0;
  pitch.value = 0;
}

function applyPreset(preset: (typeof presets)[number]) {
  rate.value = preset.rate;
  volume.value = preset.volume;
  pitch.value = preset.pitch;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function voiceDisplayName(item: EdgeTtsVoice) {
  return item.shortName.replace(/^.+?-/, "").replace(/Neural$/, "");
}

function genderLabel(gender: EdgeTtsVoice["gender"]) {
  return gender === "Female" ? "女声" : gender === "Male" ? "男声" : "中性";
}

function languageLabel(value: EdgeTtsLanguage) {
  return languages.find((item) => item.value === value)?.title || value;
}

function taskTitle(task: { fileName?: string; id: string }) {
  return task.fileName || `语音 ${task.id.slice(0, 6)}`;
}

function statusLabel(status: EdgeTtsTaskStatus) {
  return { queued: "排队中", processing: "生成中", completed: "已完成", failed: "失败", cancelled: "已取消" }[status];
}

function taskTagType(status: EdgeTtsTaskStatus): "success" | "warning" | "error" | "default" {
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "error";
  if (status === "processing" || status === "queued") return "warning";
  return "default";
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
</script>
