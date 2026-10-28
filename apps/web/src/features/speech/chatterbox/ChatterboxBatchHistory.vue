<!-- 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互 -->
<template>
  <section class="edge-tts-history">
    <div class="panel-heading">
      <div>
        <h3>声音克隆批次</h3>
        <p>音频、总字幕和参考音色随批次保留 {{ panel.health?.retentionDays || 3 }} 天，支持直接重新生成。</p>
      </div>
      <n-button secondary :loading="panel.loadingBatches" :disabled="panel.deletingBatches" @click="panel.loadBatches"
        ><RefreshCw :size="16" />刷新</n-button
      >
    </div>
    <SpeechBatchSelectionToolbar
      v-if="panel.batchHistory.batches.length"
      :selected-count="panel.selectedBatchIds.length"
      :checked="panel.allPageBatchesSelected"
      :indeterminate="panel.somePageBatchesSelected"
      :disabled="panel.loadingBatches"
      :loading="panel.deletingBatches"
      @select-all="panel.toggleAllPageBatches"
      @remove="panel.removeSelectedBatches"
    />
    <div v-if="panel.batchHistory.batches.length" class="edge-tts-history-list batch-history-list">
      <article v-for="batch in panel.batchHistory.batches" :key="batch.id">
        <div class="history-main">
          <n-checkbox
            :checked="panel.selectedBatchIds.includes(batch.id)"
            :disabled="panel.deletingBatches || panel.loadingBatches"
            :aria-label="`选择批次 ${panel.batchTitle(batch)}`"
            @update:checked="panel.toggleBatchSelection(batch.id, $event)"
          />
          <div class="voice-avatar"><Layers3 :size="18" /></div>
          <div>
            <strong>{{ panel.batchTitle(batch) }}</strong>
            <p
              :title="
                batch.itemPreviews
                  .map((item) => item.textPreview)
                  .slice(0, 2)
                  .join(' / ')
              "
            >
              {{
                batch.itemPreviews
                  .map((item) => item.textPreview)
                  .slice(0, 2)
                  .join(" / ")
              }}
            </p>
            <div class="batch-history-meta">
              <span class="batch-history-summary"
                >{{ panel.languageLabel(batch.language) }} · {{ batch.completedItems }}/{{
                  batch.itemPreviews.length
                }}
                段完成 · {{ panel.formatDate(batch.createdAt) }}</span
              >
              <span class="chatterbox-batch-device-badge">{{ batch.device === "cuda" ? "GPU" : "CPU" }}</span>
              <span
                class="chatterbox-batch-status-badge"
                :class="`chatterbox-batch-status-badge--${panel.batchTagType(batch.status)}`"
                >{{ panel.batchStatusLabel(batch.status) }}</span
              >
            </div>
          </div>
        </div>
        <div class="history-actions">
          <n-button size="small" title="查看详情" @click="panel.openBatch(batch.id)">查看详情</n-button>
          <SpeechBatchDownloads toolbar :batch="batch" archive-only />
          <SaveToAudioLibrary toolbar :batch-id="batch.id" :items="batch.itemPreviews" label="加入音频库" />
          <n-button
            size="small"
            :loading="panel.reusingBatchId === batch.id"
            :disabled="panel.creating || !!panel.reusingBatchId || panel.deletingBatches"
            title="将文案和设置重新填入输入区，不会立即生成"
            @click="panel.reuseBatch(batch.id)"
            ><template #icon><RotateCcw :size="15" /></template>重新填入批次</n-button
          >
          <n-button
            circle
            quaternary
            size="small"
            type="error"
            title="删除批次"
            :disabled="panel.deletingBatches"
            @click="panel.removeBatch(batch.id)"
            ><Trash2 :size="17"
          /></n-button>
        </div>
      </article>
    </div>
    <n-empty v-else-if="!panel.loadingBatches" description="还没有批量声音克隆记录" />
    <div v-if="panel.batchHistory.pagination.total" class="chatterbox-batch-pagination">
      <span
        >共 {{ panel.batchHistory.pagination.total }} 个批次 · 每页
        {{ panel.batchHistory.pagination.pageSize }} 个</span
      >
      <n-pagination
        :page="panel.batchHistory.pagination.page"
        :page-count="panel.batchHistory.pagination.totalPages"
        :page-slot="5"
        :disabled="panel.loadingBatches || panel.deletingBatches"
        @update:page="panel.changeBatchPage"
      />
    </div>
  </section>

  <details v-if="panel.legacyHistory.tasks.length" class="legacy-clone-history">
    <summary>旧版单段声音克隆记录（{{ panel.legacyHistory.tasks.length }}）</summary>
    <div class="edge-tts-history-list">
      <article v-for="task in panel.legacyHistory.tasks" :key="task.id">
        <div class="history-main">
          <div class="voice-avatar"><Mic2 :size="18" /></div>
          <div>
            <strong>{{ task.fileName || `克隆语音 ${task.id.slice(0, 6)}` }}</strong>
            <p>{{ task.textPreview }}</p>
            <span>{{ panel.formatDate(task.createdAt) }} · {{ panel.taskStatusLabel(task.status) }}</span>
          </div>
        </div>
        <div class="history-actions">
          <a v-if="task.downloadUrl" :href="panel.mediaUrl(task.downloadUrl)" title="下载 MP3"
            ><Download :size="17"
          /></a>
          <a v-if="task.subtitleUrl" :href="panel.mediaUrl(task.subtitleUrl)" title="下载 SRT"
            ><Captions :size="17"
          /></a>
          <n-button circle quaternary size="small" title="转为新批次编辑" @click="panel.reuseLegacy(task.id)"
            ><RotateCcw :size="17"
          /></n-button>
          <n-button circle quaternary size="small" type="error" title="删除" @click="panel.removeLegacy(task.id)"
            ><Trash2 :size="17"
          /></n-button>
        </div>
      </article>
    </div>
  </details>
</template>

<script setup lang="ts">
import { NButton, NCheckbox, NEmpty, NPagination } from "naive-ui";
import { Captions, Download, Layers3, Mic2, RefreshCw, RotateCcw, Trash2 } from "lucide-vue-next";
import { useChatterboxPanelContext } from "./chatterbox-panel-context";
import { SaveToAudioLibrary } from "../../audio-library/integrations/speech";
import SpeechBatchDownloads from "../shared/SpeechBatchDownloads.vue";
import SpeechBatchSelectionToolbar from "../shared/SpeechBatchSelectionToolbar.vue";

const panel = useChatterboxPanelContext();
</script>
