<template>
  <section class="edge-tts-history">
    <div class="panel-heading">
      <div>
        <h3>声音克隆批次</h3>
        <p>音频、总字幕和可选参考音色保留 {{ panel.health?.retentionDays || 3 }} 天。</p>
      </div>
      <n-button secondary :loading="panel.loadingBatches" @click="panel.loadBatches"
        ><RefreshCw :size="16" />刷新</n-button
      >
    </div>
    <div v-if="panel.batchHistory.batches.length" class="edge-tts-history-list batch-history-list">
      <article v-for="batch in panel.batchHistory.batches" :key="batch.id">
        <div class="history-main">
          <div class="voice-avatar"><Layers3 :size="18" /></div>
          <div>
            <strong>{{ panel.batchTitle(batch) }}</strong>
            <p>
              {{
                batch.itemPreviews
                  .map((item) => item.textPreview)
                  .slice(0, 2)
                  .join(" / ")
              }}
            </p>
            <span
              >{{ panel.languageLabel(batch.language) }} · {{ batch.completedItems }}/{{
                batch.itemPreviews.length
              }}
              完成 · {{ panel.formatDate(batch.createdAt) }}</span
            >
          </div>
        </div>
        <div class="history-actions">
          <n-button circle quaternary size="small" title="查看详情" @click="panel.openBatch(batch.id)"
            ><ListTree :size="17"
          /></n-button>
          <a v-if="batch.archiveUrl" :href="panel.mediaUrl(batch.archiveUrl)" title="下载全部"
            ><Archive :size="17"
          /></a>
          <a v-if="batch.combinedAudioUrl" :href="panel.mediaUrl(batch.combinedAudioUrl)" title="下载总音频"
            ><FileAudio :size="17"
          /></a>
          <a v-if="batch.subtitleUrl" :href="panel.mediaUrl(batch.subtitleUrl)" title="下载原文 SRT"
            ><Captions :size="17"
          /></a>
          <a
            v-if="batch.translationSubtitleUrl"
            :href="panel.mediaUrl(batch.translationSubtitleUrl)"
            title="下载中文 SRT"
            ><Languages :size="17"
          /></a>
          <a v-if="batch.bilingualSubtitleUrl" :href="panel.mediaUrl(batch.bilingualSubtitleUrl)" title="下载双语 SRT"
            ><Languages :size="17"
          /></a>
          <n-button circle quaternary size="small" type="error" title="删除批次" @click="panel.removeBatch(batch.id)"
            ><Trash2 :size="17"
          /></n-button>
        </div>
      </article>
    </div>
    <n-empty v-else-if="!panel.loadingBatches" description="还没有批量声音克隆记录" />
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
import { NButton, NEmpty } from "naive-ui";
import {
  Archive,
  Captions,
  Download,
  FileAudio,
  Languages,
  Layers3,
  ListTree,
  Mic2,
  RefreshCw,
  RotateCcw,
  Trash2
} from "lucide-vue-next";
import { useChatterboxPanelContext } from "./chatterbox-panel-context";

const panel = useChatterboxPanelContext();
</script>
