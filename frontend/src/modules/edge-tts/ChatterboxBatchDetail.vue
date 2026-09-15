<template>
  <n-modal v-model:show="panel.detailVisible">
    <n-card
      class="batch-detail-card"
      :title="panel.detailBatch ? panel.batchTitle(panel.detailBatch) : '批次详情'"
      closable
      @close="panel.detailVisible = false"
    >
      <template v-if="panel.detailBatch">
        <div class="batch-detail-summary">
          <span>{{ panel.batchStatusLabel(panel.detailBatch.status) }}</span>
          <span>{{ panel.detailBatch.completedItems }}/{{ panel.detailBatch.items.length }} 完成</span>
          <span>总时长 {{ panel.formatDuration(panel.detailBatch.totalAudioDurationSeconds) }}</span>
          <span>参考音色：{{ panel.detailBatch.referenceAvailable ? "可用于重生成" : "已删除" }}</span>
        </div>
        <div class="edge-tts-result-actions detail-top-actions">
          <a
            v-if="panel.detailBatch.archiveUrl"
            class="download-button primary"
            :href="panel.mediaUrl(panel.detailBatch.archiveUrl)"
          >
            <Archive :size="17" />下载全部 ZIP
          </a>
          <a
            v-if="panel.detailBatch.combinedAudioUrl"
            class="download-button"
            :href="panel.mediaUrl(panel.detailBatch.combinedAudioUrl)"
          >
            <FileAudio :size="17" />下载总音频
          </a>
          <a
            v-if="panel.detailBatch.subtitleUrl"
            class="download-button"
            :href="panel.mediaUrl(panel.detailBatch.subtitleUrl)"
          >
            <Captions :size="17" />下载原文 SRT
          </a>
          <a
            v-if="panel.detailBatch.translationSubtitleUrl"
            class="download-button"
            :href="panel.mediaUrl(panel.detailBatch.translationSubtitleUrl)"
          >
            <Languages :size="17" />下载中文 SRT
          </a>
          <a
            v-if="panel.detailBatch.bilingualSubtitleUrl"
            class="download-button"
            :href="panel.mediaUrl(panel.detailBatch.bilingualSubtitleUrl)"
          >
            <Languages :size="17" />下载双语 SRT
          </a>
          <n-button
            v-if="panel.detailBatch.referenceAvailable && !panel.isBatchRunning(panel.detailBatch)"
            secondary
            @click="panel.removeReference(panel.detailBatch.id)"
          >
            提前删除参考音色
          </n-button>
        </div>
        <div class="retry-reference">
          <span>{{
            panel.detailBatch.referenceAvailable
              ? "重生成参考音色（不选则沿用）"
              : "原参考音色已删除，请选择永久音色或重新上传"
          }}</span>
          <n-select v-model:value="panel.retryVoiceId" :options="panel.retryVoiceOptions" />
          <input
            :ref="setRetryReferenceInput"
            hidden
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.flac"
            @change="panel.selectRetryReference"
          />
          <n-button secondary @click="panel.retryReferenceInput?.click()">
            <UploadCloud :size="16" />{{ panel.retryReference?.name || "上传新参考音色" }}
          </n-button>
        </div>
        <div class="batch-detail-items">
          <article v-for="(item, index) in panel.orderedDetailItems" :key="item.id" class="batch-detail-item">
            <header>
              <strong>{{ String(index + 1).padStart(2, "0") }} · {{ item.fileName || `segment-${index + 1}` }}</strong>
              <n-tag :type="panel.taskTagType(item.status)" size="small"
                >{{ panel.taskStatusLabel(item.status) }}
              </n-tag>
            </header>
            <n-input
              v-model:value="panel.itemDrafts[item.id].text"
              type="textarea"
              :maxlength="panel.maxTextLength"
              show-count
              :autosize="{ minRows: 3, maxRows: 8 }"
            />
            <n-input
              v-model:value="panel.itemDrafts[item.id].referenceTranslation"
              type="textarea"
              :maxlength="panel.maxReferenceTranslationLength"
              show-count
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="中文翻译（生成单独的中文 SRT，不参与配音）"
            />
            <div class="detail-item-fields">
              <n-input v-model:value="panel.itemDrafts[item.id].fileName" maxlength="100" placeholder="文件名" />
              <n-input-number
                v-model:value="panel.itemDrafts[item.id].seed"
                :min="0"
                :max="2147483647"
                :precision="0"
                placeholder="随机种子"
              />
            </div>
            <div class="detail-item-parameters">
              <label
                >情绪强度<n-input-number
                  v-model:value="panel.itemDrafts[item.id].exaggeration"
                  :min="0.25"
                  :max="1.5"
                  :step="0.05"
              /></label>
              <label
                >音色遵循<n-input-number
                  v-model:value="panel.itemDrafts[item.id].cfgWeight"
                  :min="0"
                  :max="1"
                  :step="0.05"
              /></label>
              <label
                >随机度<n-input-number
                  v-model:value="panel.itemDrafts[item.id].temperature"
                  :min="0.1"
                  :max="1.5"
                  :step="0.05"
              /></label>
            </div>
            <audio
              v-if="item.audioUrl"
              class="edge-tts-player"
              controls
              preload="metadata"
              :src="panel.mediaUrl(item.audioUrl)"
            />
            <p v-if="item.error" class="edge-tts-error">{{ item.error }}</p>
            <div class="detail-item-actions">
              <n-button
                size="small"
                :disabled="index === 0 || panel.isBatchRunning(panel.detailBatch)"
                @click="panel.moveDetailItem(index, -1)"
              >
                <ArrowUp :size="15" />上移
              </n-button>
              <n-button
                size="small"
                :disabled="index === panel.orderedDetailItems.length - 1 || panel.isBatchRunning(panel.detailBatch)"
                @click="panel.moveDetailItem(index, 1)"
              >
                <ArrowDown :size="15" />下移
              </n-button>
              <a v-if="item.downloadUrl" class="download-button compact" :href="panel.mediaUrl(item.downloadUrl)">
                <Download :size="15" />下载
              </a>
              <n-button
                size="small"
                type="primary"
                :loading="panel.regeneratingItemId === item.id"
                :disabled="item.status === 'queued' || item.status === 'processing'"
                @click="panel.regenerateItem(item.id)"
              >
                <RotateCcw :size="15" />重新生成
              </n-button>
              <n-button
                size="small"
                type="error"
                secondary
                :disabled="panel.orderedDetailItems.length <= 1 || item.status === 'processing'"
                @click="panel.removeBatchItem(item.id)"
              >
                <Trash2 :size="15" />删除
              </n-button>
            </div>
          </article>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { NButton, NCard, NInput, NInputNumber, NModal, NSelect, NTag } from "naive-ui";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Captions,
  Download,
  FileAudio,
  Languages,
  RotateCcw,
  Trash2,
  UploadCloud
} from "lucide-vue-next";
import { useChatterboxPanelContext } from "./chatterbox-panel-context";

const panel = useChatterboxPanelContext();

function setRetryReferenceInput(value: Element | ComponentPublicInstance | null) {
  panel.retryReferenceInput = value instanceof HTMLInputElement ? value : undefined;
}
</script>
