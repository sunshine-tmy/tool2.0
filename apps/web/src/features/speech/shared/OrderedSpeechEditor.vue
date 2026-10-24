<template>
  <div class="batch-editor">
    <div class="panel-heading">
      <div>
        <h3>有序文案</h3>
        <p>每段生成独立 MP3，中文仅用于字幕与归档，不参与配音。</p>
      </div>
      <span
        >{{ editor.segments.length }} / {{ maxSegments }} 段 · {{ editor.totalCharacters }} /
        {{ maxCharacters }} 字符</span
      >
    </div>
    <div class="batch-toolbar">
      <n-input v-model:value="editor.batchName" maxlength="100" clearable placeholder="批次名称（可选）" />
      <n-button secondary @click="editor.autoVisible = true"><WandSparkles :size="16" />智能识别分段</n-button>
      <n-button secondary @click="editor.split"><SplitSquareVertical :size="16" />按空行拆分</n-button>
      <n-button secondary :disabled="editor.segments.length >= maxSegments" @click="editor.add"
        ><Plus :size="16" />添加一段</n-button
      >
      <n-button secondary type="error" :disabled="submitting || !editor.hasDraft" @click="editor.clear"
        ><Trash2 :size="16" />清空当前批次内容</n-button
      >
    </div>
    <div class="segment-editor-list">
      <article
        v-for="(item, index) in editor.segments"
        :key="item.id"
        class="segment-editor-card"
        @dragover.prevent
        @drop.prevent="editor.drop(item.id)"
      >
        <div
          class="segment-order"
          draggable="true"
          title="拖动调整顺序"
          @dragstart="editor.startDrag($event, item.id)"
          @dragend="editor.dragId = ''"
        >
          <GripVertical :size="17" /><strong>{{ String(index + 1).padStart(2, "0") }}</strong>
        </div>
        <div class="segment-fields">
          <n-input
            v-model:value="item.text"
            type="textarea"
            :maxlength="maxCharacters"
            show-count
            :autosize="{ minRows: 4, maxRows: 10 }"
            :placeholder="`第 ${index + 1} 段 ${languageLabel} 文案`"
          />
          <n-input
            v-model:value="item.referenceTranslation"
            type="textarea"
            :maxlength="maxTranslation"
            show-count
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="中文翻译（选填，不参与配音）"
          />
          <n-input v-model:value="item.fileName" maxlength="100" clearable placeholder="该段文件名（可选）" />
        </div>
        <div class="segment-actions">
          <n-button circle quaternary size="small" title="上移" :disabled="index === 0" @click="editor.move(index, -1)"
            ><ArrowUp :size="16"
          /></n-button>
          <n-button
            circle
            quaternary
            size="small"
            title="下移"
            :disabled="index === editor.segments.length - 1"
            @click="editor.move(index, 1)"
            ><ArrowDown :size="16"
          /></n-button>
          <n-button
            circle
            quaternary
            size="small"
            title="复制"
            :disabled="editor.segments.length >= maxSegments"
            @click="editor.duplicate(index)"
            ><Copy :size="16"
          /></n-button>
          <n-button
            circle
            quaternary
            size="small"
            title="删除"
            type="error"
            :disabled="editor.segments.length <= 1"
            @click="editor.remove(index)"
            ><Trash2 :size="16"
          /></n-button>
        </div>
      </article>
    </div>
    <n-modal v-model:show="editor.autoVisible"
      ><n-card class="auto-segment-card" title="智能识别分段" closable @close="editor.autoVisible = false">
        <p>粘贴带编号或空行分段的双语文案，自动区分外语与中文。</p>
        <n-input
          v-model:value="editor.autoText"
          type="textarea"
          :autosize="{ minRows: 10, maxRows: 20 }"
          placeholder="1. Hello there.&#10;你好。&#10;&#10;2. Thank you.&#10;谢谢。"
        />
        <p>已识别 {{ editor.parsed.length }} 段</p>
        <ol class="auto-segment-preview">
          <li v-for="(item, index) in editor.parsed" :key="index">
            <strong class="auto-segment-index">{{ index + 1 }}.</strong>
            <div>
              <span>{{ item.text }}</span>
              <small>{{ item.referenceTranslation || "未填写中文" }}</small>
            </div>
          </li>
        </ol>
        <template #footer
          ><div class="auto-segment-actions">
            <n-button @click="editor.autoVisible = false">取消</n-button
            ><n-button type="primary" :disabled="!editor.parsed.length" @click="editor.apply">识别并填入</n-button>
          </div></template
        >
      </n-card></n-modal
    >
  </div>
</template>
<script setup lang="ts">
import { inject } from "vue";
import { NButton, NInput, NModal, NCard } from "naive-ui";
import {
  ArrowUp,
  ArrowDown,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  WandSparkles,
  SplitSquareVertical
} from "lucide-vue-next";
import {
  EDGE_TTS_MAX_BATCH_SEGMENTS as maxSegments,
  EDGE_TTS_MAX_BATCH_TEXT_LENGTH as maxCharacters,
  EDGE_TTS_MAX_TRANSLATION_LENGTH as maxTranslation
} from "@toolbox/shared";
import { orderedSpeechEditorKey } from "./useOrderedSpeechEditor";
defineProps<{ submitting: boolean; languageLabel: string }>();
const editor = inject(orderedSpeechEditorKey);
if (!editor) throw new Error("Ordered speech editor context is missing");
</script>
