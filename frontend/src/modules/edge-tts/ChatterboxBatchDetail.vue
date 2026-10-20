<!-- 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互 -->
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
          <span>运行设备：{{ panel.detailBatch.device === "cuda" ? "GPU" : "CPU" }}</span>
          <span>{{ panel.detailBatch.completedItems }}/{{ panel.detailBatch.items.length }} 完成</span>
          <span>总时长 {{ formatAudioDuration(panel.detailBatch.totalAudioDurationSeconds) }}</span>
          <span>参考音色：{{ panel.detailBatch.referenceAvailable ? "可用于重生成" : "已删除" }}</span>
        </div>
        <div class="edge-tts-result-actions detail-top-actions">
          <SaveToAudioLibrary
            toolbar
            :batch-id="panel.detailBatch.id"
            :items="
              selectedIds.length
                ? panel.orderedDetailItems.filter((x) => selectedIds.includes(x.id))
                : panel.orderedDetailItems
            "
            :label="selectedIds.length ? '所选加入音频库' : '全部加入音频库'"
          />
          <SpeechBatchDownloads toolbar :batch="panel.detailBatch" />
          <n-button
            v-if="panel.detailBatch.referenceAvailable && !panel.isBatchRunning(panel.detailBatch)"
            size="small"
            type="error"
            secondary
            @click="panel.removeReference(panel.detailBatch.id)"
          >
            <template #icon><Trash2 :size="15" /></template>提前删除参考音色
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
              <n-checkbox
                :checked="selectedIds.includes(item.id)"
                :disabled="item.status !== 'completed'"
                :aria-label="`选择段落 ${index + 1}`"
                @update:checked="
                  (checked) =>
                    (selectedIds = checked ? [...selectedIds, item.id] : selectedIds.filter((id) => id !== item.id))
                "
              />
              <strong>{{ String(index + 1).padStart(2, "0") }} · {{ item.fileName || `segment-${index + 1}` }}</strong>
              <n-tag :type="panel.taskTagType(item.status)" size="small"
                >{{ panel.taskStatusLabel(item.status) }}
              </n-tag>
            </header>
            <div class="detail-item-form">
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
              <n-input v-model:value="panel.itemDrafts[item.id].fileName" maxlength="100" placeholder="文件名" />
              <div class="detail-item-parameters detail-item-parameters--clone">
                <label
                  ><span>情绪强度</span
                  ><n-input-number
                    v-model:value="panel.itemDrafts[item.id].exaggeration"
                    :min="0.25"
                    :max="1.5"
                    :step="0.05"
                /></label>
                <label class="detail-item-parameter--seed">
                  <span>随机种子</span>
                  <n-input-number
                    v-model:value="panel.itemDrafts[item.id].seed"
                    :min="0"
                    :max="2147483647"
                    :precision="0"
                    placeholder="随机种子"
                  />
                </label>
                <label
                  ><span>音色遵循</span
                  ><n-input-number v-model:value="panel.itemDrafts[item.id].cfgWeight" :min="0" :max="1" :step="0.05"
                /></label>
                <label
                  ><span>随机度</span
                  ><n-input-number
                    v-model:value="panel.itemDrafts[item.id].temperature"
                    :min="0.1"
                    :max="1.5"
                    :step="0.05"
                /></label>
              </div>
            </div>
            <audio
              v-if="item.audioUrl"
              class="edge-tts-player"
              controls
              preload="metadata"
              :src="panel.mediaUrl(item.audioUrl)"
            />
            <p v-if="item.error" class="edge-tts-error">{{ item.error }}</p>
            <SpeechDetailItemActions
              :batch-id="panel.detailBatch.id"
              :item="item"
              :disable-move-up="index === 0 || panel.isBatchRunning(panel.detailBatch)"
              :disable-move-down="
                index === panel.orderedDetailItems.length - 1 || panel.isBatchRunning(panel.detailBatch)
              "
              :regenerating="panel.regeneratingItemId === item.id"
              :disable-regenerate="item.status === 'queued' || item.status === 'processing'"
              :disable-remove="panel.orderedDetailItems.length <= 1 || item.status === 'processing'"
              @move="panel.moveDetailItem(index, $event)"
              @regenerate="panel.regenerateItem(item.id)"
              @remove="panel.removeBatchItem(item.id)"
            />
          </article>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { NButton, NCard, NInput, NInputNumber, NModal, NSelect, NTag, NCheckbox } from "naive-ui";
import { ref, watch } from "vue";
import SaveToAudioLibrary from "../audio-library/SaveToAudioLibrary.vue";
import SpeechDetailItemActions from "./SpeechDetailItemActions.vue";
import SpeechBatchDownloads from "./SpeechBatchDownloads.vue";
import { Trash2, UploadCloud } from "lucide-vue-next";
import { useChatterboxPanelContext } from "./chatterbox-panel-context";
import { formatAudioDuration } from "./speech-batch-display";

const panel = useChatterboxPanelContext();
const selectedIds = ref<string[]>([]);
watch(
  () => panel.detailBatch?.id,
  () => {
    selectedIds.value = [];
  }
);

function setRetryReferenceInput(value: Element | ComponentPublicInstance | null) {
  panel.retryReferenceInput = value instanceof HTMLInputElement ? value : undefined;
}
</script>
