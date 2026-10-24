<template>
  <n-modal v-model:show="panel.detailVisible"
    ><n-card
      class="batch-detail-card"
      :title="panel.detail ? panel.title(panel.detail) : '在线配音批次'"
      closable
      @close="panel.detailVisible = false"
    >
      <template v-if="panel.detail">
        <div class="batch-detail-summary">
          <span>{{ panel.statusLabel(panel.detail.status) }}</span
          ><span>{{ panel.detail.voice }}</span
          ><span>{{ panel.detail.completedItems }}/{{ panel.detail.items.length }} 完成</span>
        </div>
        <div class="edge-tts-result-actions detail-top-actions">
          <SaveToAudioLibrary
            toolbar
            engine="edge-tts"
            :batch-id="panel.detail.id"
            :items="
              panel.selectedItems.length
                ? panel.detail.items.filter((item) => panel.selectedItems.includes(item.id))
                : panel.detail.items
            "
            :label="panel.selectedItems.length ? '所选加入音频库' : '全部加入音频库'"
          />
          <SpeechBatchDownloads toolbar :batch="panel.detail" />
        </div>
        <p>修改草稿不会改变已保存的音频，点击该段“重新生成”后才提交更新。</p>
        <div class="batch-detail-items">
          <article v-for="(item, index) in panel.detail.items" :key="item.id" class="batch-detail-item">
            <header>
              <n-checkbox
                :checked="panel.selectedItems.includes(item.id)"
                :disabled="item.status !== 'completed'"
                :aria-label="`选择段落 ${index + 1}`"
                @update:checked="
                  (checked) =>
                    (panel.selectedItems = checked
                      ? [...panel.selectedItems, item.id]
                      : panel.selectedItems.filter((id) => id !== item.id))
                "
              />
              <strong>{{ String(index + 1).padStart(2, "0") }} · {{ item.fileName || `segment-${index + 1}` }}</strong
              ><n-tag :type="taskTagType(item.status)" size="small">{{ panel.statusLabel(item.status) }}</n-tag>
            </header>
            <div class="detail-item-form">
              <n-input
                v-model:value="panel.drafts[item.id].text"
                :disabled="batchRunning(panel.detail) || panel.busy"
                type="textarea"
                :maxlength="20000"
                show-count
                :autosize="{ minRows: 3, maxRows: 8 }"
                placeholder="外语文案"
              />
              <n-input
                v-model:value="panel.drafts[item.id].referenceTranslation"
                :disabled="batchRunning(panel.detail) || panel.busy"
                type="textarea"
                :maxlength="2000"
                show-count
                :autosize="{ minRows: 2, maxRows: 6 }"
                placeholder="中文翻译（不参与配音）"
              />
              <n-input
                v-model:value="panel.drafts[item.id].fileName"
                :disabled="batchRunning(panel.detail) || panel.busy"
                maxlength="100"
                placeholder="文件名（可选）"
              />
              <div class="detail-item-parameters">
                <label
                  ><span>语速 %</span
                  ><n-input-number
                    v-model:value="panel.drafts[item.id].rate"
                    :disabled="batchRunning(panel.detail) || panel.busy"
                    :min="-50"
                    :max="100"
                    :precision="0"
                /></label>
                <label
                  ><span>音量 %</span
                  ><n-input-number
                    v-model:value="panel.drafts[item.id].volume"
                    :disabled="batchRunning(panel.detail) || panel.busy"
                    :min="-50"
                    :max="50"
                    :precision="0"
                /></label>
                <label
                  ><span>音调 Hz</span
                  ><n-input-number
                    v-model:value="panel.drafts[item.id].pitch"
                    :disabled="batchRunning(panel.detail) || panel.busy"
                    :min="-50"
                    :max="50"
                    :precision="0"
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
              engine="edge-tts"
              :batch-id="panel.detail.id"
              :item="item"
              :disable-move-up="index === 0 || batchRunning(panel.detail) || panel.busy"
              :disable-move-down="index === panel.detail.items.length - 1 || batchRunning(panel.detail) || panel.busy"
              :regenerating="panel.busy"
              :disable-regenerate="batchRunning(panel.detail) || !panel.drafts[item.id].text.trim()"
              :disable-remove="batchRunning(panel.detail) || panel.busy || panel.detail.items.length <= 1"
              @move="panel.moveItem(index, $event)"
              @regenerate="panel.regenerate(item)"
              @remove="panel.removeItem(item.id)"
            />
          </article>
        </div>
      </template> </n-card
  ></n-modal>
</template>
<script setup lang="ts">
import { NModal, NCard, NCheckbox, NInput, NInputNumber, NTag } from "naive-ui";
import { useEdgeTtsPanelContext } from "./edge-tts-panel-context";
import { batchRunning } from "./useEdgeTtsPanel";
import { taskTagType } from "../shared/speech-batch-display";
import SpeechBatchDownloads from "../shared/SpeechBatchDownloads.vue";
import SpeechDetailItemActions from "../shared/SpeechDetailItemActions.vue";
import { SaveToAudioLibrary } from "../../audio-library/integrations/speech";
const panel = useEdgeTtsPanelContext();
</script>
