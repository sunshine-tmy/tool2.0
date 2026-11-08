<!-- 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互 -->
<template>
  <section class="edge-tts-workbench chatterbox-workbench">
    <div class="edge-tts-editor chatterbox-editor batch-editor">
      <details class="speech-reference-picker" :open="referencePickerOpen" @toggle="syncReferencePickerOpen">
        <summary>
          <span class="speech-reference-label">参考音色</span>
          <span class="speech-reference-current">
            <button
              type="button"
              class="reference-quick-play"
              :disabled="!referenceAudioUrl"
              :aria-label="referencePlaying ? '暂停参考音色' : '试听参考音色'"
              @click.stop.prevent="toggleReferencePreview"
            >
              <Pause v-if="referencePlaying" :size="16" fill="currentColor" /><Play
                v-else
                :size="16"
                fill="currentColor"
              />
            </button>
            <AudioLines class="reference-wave-icon" :size="38" aria-hidden="true" />
            <span class="reference-current-copy">
              <span class="reference-name-row"
                ><strong>{{
                  panel.referenceSource === "upload"
                    ? panel.referenceFile?.name || "上传参考音频"
                    : currentVoice?.name || "选择参考音色"
                }}</strong
                ><span class="reference-kind">参考音色</span></span
              >
              <small>{{ referencePreviewError ? "试听加载失败，请展开后重试" : referenceDurationLabel }}</small>
            </span>
            <ChevronDown class="reference-chevron" :size="18" />
          </span>
        </summary>
        <audio
          ref="quickReferenceAudio"
          hidden
          :src="referenceAudioUrl || undefined"
          preload="metadata"
          @loadedmetadata="referenceDuration = quickReferenceAudio?.duration || 0"
          @playing="referencePlaying = true"
          @pause="referencePlaying = false"
          @ended="referencePlaying = false"
          @error="
            referencePlaying = false;
            referencePreviewError = true;
          "
        />
        <div class="speech-reference-body">
          <div class="panel-heading">
            <div>
              <h3>参考音色</h3>
              <p>推荐 10–20 秒、单人、无背景音乐且与目标语言一致的清晰录音。</p>
            </div>
            <span>5–30 秒 · 最大 20 MB</span>
          </div>
          <div class="voice-source-tabs">
            <button
              type="button"
              :class="{ active: panel.referenceSource === 'upload' }"
              @click="panel.referenceSource = 'upload'"
            >
              <UploadCloud :size="16" />上传新音色
            </button>
            <button
              type="button"
              :class="{ active: panel.referenceSource === 'saved' }"
              @click="panel.referenceSource = 'saved'"
            >
              <Library :size="16" />永久音色库（{{ panel.savedVoices.length }}）
            </button>
          </div>
          <template v-if="panel.referenceSource === 'upload'">
            <label
              class="chatterbox-dropzone file-upload-area"
              data-upload-area
              :class="{ 'has-file': panel.referenceFile }"
            >
              <input type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac" @change="panel.selectReference" />
              <template v-if="panel.referenceFile">
                <FileAudio :size="30" /><strong>{{ panel.referenceFile.name }}</strong>
                <span>{{ panel.formatBytes(panel.referenceFile.size) }} · 点击重新选择</span>
              </template>
              <template v-else>
                <UploadCloud :size="32" /><strong>上传参考音频</strong><span>整个批次共用同一份参考音色</span>
              </template>
            </label>
            <div v-if="panel.referencePreview" class="speech-reference-audio" @click.stop>
              <span class="speech-reference-audio-label"><Headphones :size="16" />试听音色</span>
              <audio
                class="reference-audio-player"
                controls
                preload="metadata"
                aria-label="试听上传的参考音色"
                :src="panel.referencePreview"
              />
            </div>
            <div v-if="panel.referenceFile" class="save-voice-row">
              <n-input
                v-model:value="panel.voiceName"
                maxlength="100"
                clearable
                placeholder="输入音色名称，永久保存后可重复使用"
              />
              <n-button
                :loading="panel.savingVoice"
                :disabled="!panel.voiceName.trim() || !panel.consentConfirmed"
                @click="panel.saveCurrentVoice"
              >
                <Save :size="16" />永久保存音色
              </n-button>
            </div>
          </template>
          <div v-else class="saved-voice-list">
            <article
              v-for="voice in panel.languageSavedVoices"
              :key="voice.id"
              :class="{ selected: panel.selectedVoiceId === voice.id }"
              @click="panel.selectedVoiceId = voice.id"
            >
              <div class="saved-voice-main">
                <FileAudio :size="20" />
                <span
                  ><strong>{{ voice.name }}</strong
                  ><small
                    >{{ voice.durationSeconds.toFixed(1) }} 秒 · {{ panel.formatDate(voice.createdAt) }}</small
                  ></span
                >
              </div>
              <div class="speech-reference-audio" @click.stop>
                <span class="speech-reference-audio-label"><Headphones :size="16" />试听音色</span>
                <audio
                  class="reference-audio-player"
                  controls
                  preload="metadata"
                  :aria-label="`试听音色 ${voice.name}`"
                  :src="panel.mediaUrl(voice.audioUrl)"
                />
              </div>
              <n-button
                class="saved-voice-select"
                size="small"
                :type="panel.selectedVoiceId === voice.id ? 'primary' : 'default'"
                :secondary="panel.selectedVoiceId !== voice.id"
                :aria-pressed="panel.selectedVoiceId === voice.id"
                @click.stop="panel.selectedVoiceId = voice.id"
              >
                <Check v-if="panel.selectedVoiceId === voice.id" :size="16" />
                {{ panel.selectedVoiceId === voice.id ? "已选择" : "选择音色" }}
              </n-button>
              <n-button
                circle
                quaternary
                size="small"
                type="error"
                title="永久删除该音色"
                @click.stop="panel.removeSavedVoice(voice.id)"
              >
                <Trash2 :size="16" />
              </n-button>
            </article>
            <n-empty v-if="!panel.languageSavedVoices.length" description="当前语言还没有永久保存的参考音色" />
          </div>
        </div>
      </details>
      <div class="speech-batch-name">
        <label>批量名称</label>
        <n-input
          v-model:value="panel.batchName"
          maxlength="100"
          clearable
          placeholder="批次名称（可选）"
          aria-label="批次名称"
        />
      </div>

      <div class="panel-heading batch-heading">
        <div>
          <h3>文本分段与翻译</h3>
          <p>每段生成一个独立 MP3；拖动卡片或使用箭头调整总 SRT 顺序。</p>
        </div>
        <span :class="{ 'is-limit': panel.totalCharacters > panel.maxBatchTextLength }">
          {{ panel.segments.length }} / {{ panel.maxBatchSegments }} 段 · {{ panel.totalCharacters }} /
          {{ panel.maxBatchTextLength }} 字符
        </span>
      </div>

      <div class="batch-toolbar">
        <n-button size="small" type="primary" @click="panel.openAutoSegment"
          ><WandSparkles :size="16" />智能识别分段</n-button
        >
        <n-button size="small" @click="panel.splitByBlankLines"><SplitSquareVertical :size="16" />按空行拆分</n-button>
        <n-button size="small" :disabled="panel.segments.length >= panel.maxBatchSegments" @click="panel.addSegment">
          <Plus :size="16" />添加一段
        </n-button>
        <n-button
          class="batch-clear"
          size="small"
          quaternary
          type="error"
          :disabled="panel.creating || !panel.hasBatchDraft"
          @click="panel.clearBatchDraft"
        >
          <Trash2 :size="16" />清空批次
        </n-button>
      </div>

      <div class="segment-editor-list">
        <article
          v-for="(segment, index) in panel.segments"
          :key="segment.id"
          class="segment-editor-card"
          @dragover="panel.allowSegmentDrop"
          @drop="panel.dropSegment($event, segment.id)"
        >
          <div
            class="segment-order"
            draggable="true"
            title="按住拖动调整顺序"
            @dragstart="panel.startSegmentDrag($event, segment.id)"
            @dragend="panel.dragItemId = undefined"
          >
            <GripVertical :size="17" /><strong>{{ String(index + 1).padStart(2, "0") }}</strong>
          </div>
          <div class="segment-fields">
            <div class="speech-segment-field">
              <label>原文 <span>*</span></label>
              <n-input
                v-model:value="segment.text"
                type="textarea"
                :maxlength="panel.maxTextLength"
                show-count
                :autosize="{ minRows: 2, maxRows: 10 }"
                :aria-label="`第 ${index + 1} 段原文`"
                :placeholder="`输入第 ${index + 1} 段 ${panel.languageLabel(panel.language)} 文案…`"
              />
            </div>
            <div class="speech-segment-field">
              <label>中文翻译 <small>（可选）</small></label>
              <n-input
                v-model:value="segment.referenceTranslation"
                type="textarea"
                :maxlength="panel.maxReferenceTranslationLength"
                show-count
                :autosize="{ minRows: 2, maxRows: 6 }"
                placeholder="中文翻译（生成单独的中文 SRT，不参与配音）"
                :aria-label="`第 ${index + 1} 段中文翻译`"
              />
            </div>
            <div class="speech-segment-field speech-segment-filename">
              <label>文件名称 <small>（可选）</small></label
              ><n-input
                v-model:value="segment.fileName"
                maxlength="100"
                clearable
                placeholder="该段文件名（可选）"
                :aria-label="`第 ${index + 1} 段文件名`"
              />
            </div>
          </div>
          <div class="segment-actions">
            <n-button
              circle
              quaternary
              size="small"
              title="上移"
              :disabled="index === 0"
              @click="panel.moveSegment(index, -1)"
            >
              <ArrowUp :size="16" />
            </n-button>
            <n-button
              circle
              quaternary
              size="small"
              title="下移"
              :disabled="index === panel.segments.length - 1"
              @click="panel.moveSegment(index, 1)"
            >
              <ArrowDown :size="16" />
            </n-button>
            <n-button
              circle
              quaternary
              size="small"
              title="复制"
              :disabled="panel.segments.length >= panel.maxBatchSegments"
              @click="panel.duplicateSegment(index)"
            >
              <Copy :size="16" />
            </n-button>
            <n-button
              circle
              quaternary
              size="small"
              type="error"
              title="删除"
              :disabled="panel.segments.length === 1"
              @click="panel.removeEditorSegment(index)"
            >
              <Trash2 :size="16" />
            </n-button>
          </div>
        </article>
      </div>
    </div>

    <aside class="edge-tts-controls chatterbox-controls">
      <h3 class="speech-settings-title">配音配置</h3>
      <div class="control-section">
        <label>目标语言</label>
        <div class="edge-tts-language-grid chatterbox-language-grid">
          <button type="button" :class="{ active: panel.language === 'ms' }" @click="panel.language = 'ms'">
            <strong>Bahasa Melayu</strong><span>马来语</span>
          </button>
          <button type="button" :class="{ active: panel.language === 'en' }" @click="panel.language = 'en'">
            <strong>English</strong><span>英语</span>
          </button>
          <button type="button" :class="{ active: panel.language === 'pt-BR' }" @click="panel.language = 'pt-BR'">
            <strong>Português BR</strong><span>巴西葡萄牙语</span>
          </button>
        </div>
        <p v-if="panel.language === 'pt-BR'" class="chatterbox-language-hint">
          请使用已获授权的巴西葡语参考录音并输入葡语文案。模型使用通用葡萄牙语，口音由参考录音引导，不会自动翻译。
        </p>
      </div>

      <div class="control-section">
        <label>本批次运行设备</label>
        <div class="chatterbox-device-options" role="radiogroup" aria-label="本批次运行设备">
          <label
            v-if="!isMacOSDesktop"
            class="chatterbox-device-option"
            :class="{ active: panel.device === 'cuda', disabled: !panel.cudaAvailable }"
            :title="
              panel.cudaAvailable
                ? panel.health?.gpuName || 'CUDA 加速'
                : panel.health?.cudaUnavailableReason || 'CUDA 加速组件未就绪'
            "
          >
            <input
              v-model="panel.device"
              type="radio"
              name="chatterbox-device"
              value="cuda"
              :disabled="!panel.cudaAvailable"
            />
            <span class="chatterbox-device-option-copy">
              <strong>GPU</strong>
              <small>{{ panel.cudaAvailable ? panel.health?.gpuName || "CUDA 加速" : "CUDA 未就绪" }}</small>
            </span>
          </label>
          <label class="chatterbox-device-option" :class="{ active: panel.device === 'cpu' }">
            <input v-model="panel.device" type="radio" name="chatterbox-device" value="cpu" />
            <span class="chatterbox-device-option-copy">
              <strong>CPU</strong>
              <small>兼容优先</small>
            </span>
          </label>
        </div>
        <p class="chatterbox-device-hint">
          {{
            isMacOSDesktop
              ? "此版本的 macOS 桌面端使用 Chatterbox CPU 推理。"
              : panel.cudaAvailable
                ? "GPU 使用 CUDA 加速；显存不足时本批次会报错，不会暗中切回 CPU。"
                : panel.health?.cudaUnavailableReason || "正在检测 GPU 与 CUDA 运行环境。"
          }}
        </p>
      </div>

      <div class="control-section">
        <div class="control-label-row">
          <label>生成参数</label
          ><n-button text type="primary" size="tiny" @click="panel.resetParameters">恢复默认</n-button>
        </div>
        <label class="range-control"
          ><span
            >情绪强度 <strong>{{ panel.exaggeration.toFixed(2) }}</strong></span
          ><n-slider
            v-model:value="panel.exaggeration"
            v-slider-label="{ label: '情绪强度', text: panel.exaggeration.toFixed(2) }"
            :min="0.25"
            :max="1.5"
            :step="0.05"
            :tooltip="false"
        /></label>
        <label class="range-control"
          ><span
            >音色遵循 <strong>{{ panel.cfgWeight.toFixed(2) }}</strong></span
          ><n-slider
            v-model:value="panel.cfgWeight"
            v-slider-label="{ label: '音色遵循', text: panel.cfgWeight.toFixed(2) }"
            :min="0"
            :max="1"
            :step="0.05"
            :tooltip="false"
        /></label>
        <label class="range-control"
          ><span
            >随机度 <strong>{{ panel.temperature.toFixed(2) }}</strong></span
          ><n-slider
            v-model:value="panel.temperature"
            v-slider-label="{ label: '随机度', text: panel.temperature.toFixed(2) }"
            :min="0.1"
            :max="1.5"
            :step="0.05"
            :tooltip="false"
        /></label>
        <label class="chatterbox-seed"
          ><span>随机种子</span><n-input-number v-model:value="panel.seed" :min="0" :max="2147483647" :precision="0"
        /></label>
      </div>

      <div class="control-section chatterbox-consent">
        <label>声音来源</label>
        <n-select v-model:value="panel.authorization" :options="panel.authorizationOptions" />
        <n-checkbox v-model:checked="panel.consentConfirmed" class="chatterbox-consent-checkbox">
          我确认拥有合法使用与克隆该声音的权利，不用于冒充、欺诈或误导。
        </n-checkbox>
      </div>

      <div class="control-section">
        <label>字幕分段方式</label>
        <n-select v-model:value="panel.subtitleMode" :options="panel.subtitleModeOptions" />
        <n-checkbox v-model:checked="panel.includeSubtitles">生成总 SRT；填写中文时同时生成中文与双语 SRT</n-checkbox>
      </div>

      <n-button
        type="primary"
        size="large"
        block
        :loading="panel.creating"
        :disabled="!panel.canCreate"
        @click="panel.createBatch"
      >
        <template #icon><Layers3 :size="18" /></template>
        {{ panel.creating ? "正在加入队列…" : `添加 ${panel.validSegmentCount} 个音频到生成队列` }}
      </n-button>
      <p class="chatterbox-hint">任务按入队顺序依次生成；执行期间可继续编辑并添加新批次，不影响已提交的内容。</p>
      <p class="chatterbox-hint">
        参考音色随批次保留
        {{ panel.health?.retentionDays || 3 }} 天，批次结束后可直接重新生成；也可在详情中手动删除参考音色。
      </p>
      <p v-if="!panel.health?.available" class="edge-tts-error">
        克隆服务正在准备或启动失败。首次一键启动会自动安装环境和下载模型；请保持启动窗口开启并查看其中的错误提示。
      </p>
      <p v-if="panel.errorMessage" class="edge-tts-error">{{ panel.errorMessage }}</p>
      <DiagnosticErrorLink :error="panel.errorMessage" module="edge-tts" />
    </aside>
  </section>

  <n-modal v-model:show="panel.autoSegmentVisible">
    <n-card class="auto-segment-card" title="智能识别分段" closable @close="panel.autoSegmentVisible = false">
      <p class="auto-segment-help">
        粘贴时自动清理格式标记，保留编号和段落换行。系统会将每个编号识别为一段，并自动区分目标语言原文和中文翻译。
      </p>
      <n-input
        v-model:value="panel.autoSegmentText"
        type="textarea"
        :autosize="{ minRows: 12, maxRows: 20 }"
        placeholder="例如：&#10;1. Malay / English / Português 原文&#10;   中文翻译&#10;2. 下一段原文&#10;   下一段中文翻译"
        @paste="pasteSpeechText($event, (value) => (panel.autoSegmentText = value))"
      />
      <div v-if="panel.autoSegmentText.trim()" class="auto-segment-summary">
        <strong v-if="panel.parsedAutoSegments.length"
          >已识别 {{ panel.parsedAutoSegments.length }} 段 ·
          {{ panel.translatedAutoSegmentCount }} 段包含中文翻译</strong
        >
        <strong v-else class="is-error">暂未识别到有效文案</strong>
        <ol v-if="panel.parsedAutoSegments.length" class="auto-segment-preview">
          <li v-for="(segment, index) in panel.parsedAutoSegments" :key="`${index}-${segment.text}`">
            <strong class="auto-segment-index">{{ index + 1 }}.</strong>
            <div>
              <span>{{ segment.text }}</span
              ><small>{{ segment.referenceTranslation || "未识别到中文翻译" }}</small>
            </div>
          </li>
        </ol>
      </div>
      <template #footer>
        <div class="auto-segment-actions">
          <n-button @click="panel.autoSegmentVisible = false">取消</n-button>
          <n-button type="primary" :disabled="!panel.parsedAutoSegments.length" @click="panel.applyAutoSegments">
            识别并填入 {{ panel.parsedAutoSegments.length || "" }} 段
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { vSliderLabel } from "../../../shared/ui/slider-label";
import { computed, ref, watch } from "vue";
import DiagnosticErrorLink from "../../../shared/ui/DiagnosticErrorLink.vue";
import { NButton, NCard, NCheckbox, NEmpty, NInput, NInputNumber, NModal, NSelect, NSlider } from "naive-ui";
import {
  AudioLines,
  ChevronDown,
  Play,
  Pause,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FileAudio,
  GripVertical,
  Headphones,
  Layers3,
  Library,
  Plus,
  Save,
  SplitSquareVertical,
  Trash2,
  UploadCloud,
  WandSparkles
} from "lucide-vue-next";
import { useChatterboxPanelContext } from "./chatterbox-panel-context";
import { pasteSpeechText } from "../shared/paste-speech-text";

const panel = useChatterboxPanelContext();
const referencePickerOpen = ref(false);
const currentVoice = computed(() => panel.savedVoices.find((voice) => voice.id === panel.selectedVoiceId));
const referenceAudioUrl = computed(() =>
  panel.referenceSource === "upload"
    ? panel.referencePreview || ""
    : currentVoice.value
      ? panel.mediaUrl(currentVoice.value.audioUrl)
      : ""
);
const quickReferenceAudio = ref<HTMLAudioElement>();
const referencePlaying = ref(false);
const referenceDuration = ref(0);
const referencePreviewError = ref(false);
const referenceDurationLabel = computed(() => {
  const duration =
    referenceDuration.value || (panel.referenceSource === "saved" ? currentVoice.value?.durationSeconds : 0) || 0;
  if (!duration) return referenceAudioUrl.value ? "点击左侧试听" : "选择或上传参考音色";
  const seconds = Math.floor(duration);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
watch(referenceAudioUrl, () => {
  quickReferenceAudio.value?.pause();
  referencePlaying.value = false;
  referenceDuration.value = 0;
  referencePreviewError.value = false;
});
async function toggleReferencePreview() {
  const audio = quickReferenceAudio.value;
  if (!audio || !referenceAudioUrl.value) return;
  if (!audio.paused) {
    audio.pause();
    return;
  }
  referencePreviewError.value = false;
  try {
    await audio.play();
  } catch {
    referencePlaying.value = false;
    referencePreviewError.value = true;
  }
}
function syncReferencePickerOpen(event: Event) {
  referencePickerOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}
const isMacOSDesktop = Boolean(window.toolboxDesktop) && navigator.platform.toLowerCase().includes("mac");
if (isMacOSDesktop && panel.device === "cuda") panel.device = "cpu";
</script>

<style scoped>
.speech-reference-audio {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-top: 10px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}
.saved-voice-list .speech-reference-audio {
  grid-column: 1 / -1;
  grid-row: 2;
  margin-top: 2px;
}
.speech-reference-audio-label {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  color: var(--color-primary-700);
  font-size: 12px;
  font-weight: 500;
}
.speech-reference-audio .reference-audio-player {
  display: block;
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 42px;
  border-radius: 10px;
  background: var(--color-surface-subtle);
  accent-color: var(--color-primary-600);
  color-scheme: light;
}
.reference-audio-player::-webkit-media-controls-panel {
  background: var(--color-surface-subtle);
}
.reference-audio-player::-webkit-media-controls-play-button {
  border-radius: 50%;
  background-color: var(--color-primary-100);
}
.reference-audio-player::-webkit-media-controls-current-time-display,
.reference-audio-player::-webkit-media-controls-time-remaining-display {
  color: var(--color-text-secondary);
  text-shadow: none;
}
@media (max-width: 640px) {
  .speech-reference-audio {
    gap: 6px;
    padding: 6px;
  }
  .speech-reference-audio-label {
    font-size: 0;
  }
}

.reference-quick-play {
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: white;
  background: linear-gradient(135deg, #a49aff, var(--color-primary-600));
  box-shadow: 0 3px 8px #6554ff24;
  cursor: pointer;
}
.reference-quick-play:disabled {
  opacity: 0.45;
  cursor: default;
}
.reference-quick-play:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 3px;
}
.reference-wave-icon {
  flex-shrink: 0;
  color: var(--color-primary-500);
}
.reference-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.reference-kind {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 5px;
  color: var(--color-primary-600);
  background: var(--color-primary-100);
  font-size: 10px;
  line-height: 1.5;
}
.reference-chevron {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--color-text-secondary);
  transition: transform 0.15s;
}
.speech-reference-picker[open] .reference-chevron {
  transform: rotate(180deg);
}
@media (max-width: 600px) {
  .reference-wave-icon,
  .reference-kind {
    display: none;
  }
}
</style>
