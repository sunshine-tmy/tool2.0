<template>
  <section class="edge-tts-workbench chatterbox-workbench">
    <div class="edge-tts-editor chatterbox-editor batch-editor">
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
        <label class="chatterbox-dropzone" :class="{ 'has-file': panel.referenceFile }">
          <input type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac" @change="panel.selectReference" />
          <template v-if="panel.referenceFile">
            <FileAudio :size="30" /><strong>{{ panel.referenceFile.name }}</strong>
            <span>{{ panel.formatBytes(panel.referenceFile.size) }} · 点击重新选择</span>
          </template>
          <template v-else>
            <UploadCloud :size="32" /><strong>上传参考音频</strong><span>整个批次共用同一份参考音色</span>
          </template>
        </label>
        <audio
          v-if="panel.referencePreview"
          class="edge-tts-player"
          controls
          preload="metadata"
          :src="panel.referencePreview"
        />
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
              ><small>{{ voice.durationSeconds.toFixed(1) }} 秒 · {{ panel.formatDate(voice.createdAt) }}</small></span
            >
          </div>
          <audio controls preload="metadata" :src="panel.mediaUrl(voice.audioUrl)" @click.stop />
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

      <div class="panel-heading batch-heading">
        <div>
          <h3>有序文案</h3>
          <p>每段生成一个独立 MP3；拖动卡片或使用箭头调整总 SRT 顺序。</p>
        </div>
        <span :class="{ 'is-limit': panel.totalCharacters > panel.maxBatchTextLength }">
          {{ panel.segments.length }} / {{ panel.maxBatchSegments }} 段 · {{ panel.totalCharacters }} /
          {{ panel.maxBatchTextLength }} 字符
        </span>
      </div>

      <div class="batch-toolbar">
        <n-input v-model:value="panel.batchName" maxlength="100" clearable placeholder="批次名称（可选）" />
        <n-button secondary @click="panel.openAutoSegment"><WandSparkles :size="16" />智能识别分段</n-button>
        <n-button secondary @click="panel.splitByBlankLines"><SplitSquareVertical :size="16" />按空行拆分</n-button>
        <n-button secondary :disabled="panel.segments.length >= panel.maxBatchSegments" @click="panel.addSegment">
          <Plus :size="16" />添加一段
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
            <n-input
              v-model:value="segment.text"
              type="textarea"
              :maxlength="panel.maxTextLength"
              show-count
              :autosize="{ minRows: 4, maxRows: 10 }"
              :placeholder="`输入第 ${index + 1} 段 ${panel.languageLabel(panel.language)} 文案…`"
            />
            <n-input
              v-model:value="segment.referenceTranslation"
              type="textarea"
              :maxlength="panel.maxReferenceTranslationLength"
              show-count
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="中文翻译（生成单独的中文 SRT，不参与配音）"
            />
            <n-input v-model:value="segment.fileName" maxlength="100" clearable placeholder="该段文件名（可选）" />
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
        <div class="control-label-row">
          <label>生成参数</label
          ><n-button text type="primary" size="tiny" @click="panel.resetParameters">恢复默认</n-button>
        </div>
        <label class="range-control"
          ><span
            >情绪强度 <strong>{{ panel.exaggeration.toFixed(2) }}</strong></span
          ><n-slider v-model:value="panel.exaggeration" :min="0.25" :max="1.5" :step="0.05" :tooltip="false"
        /></label>
        <label class="range-control"
          ><span
            >音色遵循 <strong>{{ panel.cfgWeight.toFixed(2) }}</strong></span
          ><n-slider v-model:value="panel.cfgWeight" :min="0" :max="1" :step="0.05" :tooltip="false"
        /></label>
        <label class="range-control"
          ><span
            >随机度 <strong>{{ panel.temperature.toFixed(2) }}</strong></span
          ><n-slider v-model:value="panel.temperature" :min="0.1" :max="1.5" :step="0.05" :tooltip="false"
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
        <n-checkbox v-model:checked="panel.referenceRetained">保留标准化参考音色 3 天，支持一键重新生成</n-checkbox>
      </div>

      <n-button
        type="primary"
        size="large"
        block
        :loading="panel.creating || panel.isCurrentRunning"
        :disabled="!panel.canCreate"
        @click="panel.createBatch"
      >
        <template #icon><Layers3 :size="18" /></template>
        {{
          panel.isCurrentRunning
            ? `批量生成中 ${panel.currentBatch?.progress || 0}%`
            : `批量生成 ${panel.validSegmentCount} 个音频`
        }}
      </n-button>
      <p v-if="!panel.referenceRetained" class="chatterbox-hint">
        批次结束后会删除参考音色；以后重新生成单段时需要再次上传。
      </p>
      <p v-if="!panel.health?.available" class="edge-tts-error">
        请运行 <code>scripts\setup-chatterbox.ps1 -DownloadModel</code>，然后重新一键启动。
      </p>
      <p v-if="panel.errorMessage" class="edge-tts-error">{{ panel.errorMessage }}</p>
    </aside>
  </section>

  <n-modal v-model:show="panel.autoSegmentVisible">
    <n-card class="auto-segment-card" title="智能识别分段" closable @close="panel.autoSegmentVisible = false">
      <p class="auto-segment-help">
        粘贴带编号的双语文案，系统会将每个编号识别为一段，并自动区分目标语言原文和中文翻译。
      </p>
      <n-input
        v-model:value="panel.autoSegmentText"
        type="textarea"
        :autosize="{ minRows: 12, maxRows: 20 }"
        placeholder="例如：&#10;1. **Malay / English / Português 原文**\&#10;   中文翻译\&#10;2. **下一段原文**\&#10;   下一段中文翻译"
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
import { NButton, NCard, NCheckbox, NEmpty, NInput, NInputNumber, NModal, NSelect, NSlider } from "naive-ui";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FileAudio,
  GripVertical,
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

const panel = useChatterboxPanelContext();
</script>
