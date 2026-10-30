<template>
  <div class="online-tts-panel">
    <section class="edge-tts-workbench">
      <div class="edge-tts-editor">
        <OrderedSpeechEditor :submitting="panel.creating" :language-label="panel.languageLabel(panel.language)" />
      </div>
      <aside class="edge-tts-controls">
        <div class="control-section">
          <label>语言与口音</label>
          <div class="edge-tts-language-grid">
            <button
              v-for="item in onlineLanguages"
              :key="item.value"
              type="button"
              :class="{ active: panel.language === item.value }"
              @click="panel.language = item.value"
            >
              <strong>{{ item.title }}</strong
              ><span>{{ item.description }}</span>
            </button>
          </div>
        </div>
        <div class="control-section">
          <div class="control-label-row">
            <label>音色</label><span>{{ panel.loadingVoices ? "更新中…" : `${panel.voices.length} 个可用` }}</span>
          </div>
          <div class="edge-tts-voices">
            <button
              v-for="item in panel.voices"
              :key="item.shortName"
              type="button"
              :class="{ active: panel.voice === item.shortName }"
              @click="panel.voice = item.shortName"
            >
              <span class="voice-avatar"><UserRound :size="16" /></span
              ><span
                ><strong>{{ item.shortName.replace(/^.+?-/, "").replace(/Neural$/, "") }}</strong
                ><small>{{ { Female: "女声", Male: "男声", Neutral: "中性" }[item.gender] }}</small></span
              ><Check v-if="panel.voice === item.shortName" :size="17" />
            </button>
          </div>
        </div>
        <div class="control-section">
          <div class="control-label-row">
            <label>参数预设</label
            ><n-button text type="primary" size="tiny" @click="panel.preset(onlinePresets[0])">恢复默认</n-button>
          </div>
          <div class="edge-tts-presets">
            <button v-for="preset in onlinePresets" :key="preset.name" type="button" @click="panel.preset(preset)">
              {{ preset.name }}
            </button>
          </div>
          <label class="range-control"
            ><span
              >语速 <strong>{{ panel.rate }}%</strong></span
            ><n-slider v-model:value="panel.rate" :min="-50" :max="100" :step="5" :tooltip="false"
          /></label>
          <label class="range-control"
            ><span
              >音量 <strong>{{ panel.volume }}%</strong></span
            ><n-slider v-model:value="panel.volume" :min="-50" :max="50" :step="5" :tooltip="false"
          /></label>
          <label class="range-control"
            ><span
              >音调 <strong>{{ panel.pitch }}Hz</strong></span
            ><n-slider v-model:value="panel.pitch" :min="-50" :max="50" :step="5" :tooltip="false"
          /></label>
        </div>
        <div class="control-section">
          <label>字幕分段方式</label
          ><n-select
            v-model:value="panel.subtitleMode"
            :options="[
              { label: '段内按完整句子分段（推荐）', value: 'sentences' },
              { label: '每段文案一个字幕块', value: 'segments' }
            ]"
          />
          <n-checkbox v-model:checked="panel.includeSubtitles">生成总 SRT；填写中文时同时生成中文与双语 SRT</n-checkbox>
        </div>
        <n-button
          type="primary"
          size="large"
          block
          :loading="panel.creating"
          :disabled="!panel.canCreate"
          @click="panel.createBatch"
          >{{ panel.creating ? "正在加入队列…" : `添加 ${panel.editor.segments.length} 个音频到生成队列` }}</n-button
        >
        <p class="chatterbox-hint">
          运行中可继续提交新批次；队列容量
          {{ panel.health?.queue.limit || "—" }} 段，按入队顺序处理，输出顺序与文案一致。
        </p>
        <p v-if="!panel.health?.available" class="edge-tts-error">
          在线配音环境未就绪，请运行 scripts/setup-edge-tts.ps1 或在桌面能力管理中更新 Edge-TTS。
          <DiagnosticErrorLink error="在线配音服务不可用" module="edge-tts" />
        </p>
        <p v-if="panel.error" class="edge-tts-error">{{ panel.error }}</p>
        <DiagnosticErrorLink :error="panel.error" module="edge-tts" />
      </aside>
    </section>
    <section v-if="panel.current" class="edge-tts-result" :class="`status-${panel.current.status}`">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">LATEST BATCH</p>
          <h3>{{ panel.title(panel.current) }}</h3>
          <p>
            {{ panel.statusLabel(panel.current.status) }} · {{ panel.current.completedItems }}/{{
              panel.current.items.length
            }}
            完成 · {{ formatDuration(panel.current.totalAudioDurationSeconds) }}
          </p>
        </div>
        <span
          class="chatterbox-batch-status-badge"
          :class="`chatterbox-batch-status-badge--${batchTagType(panel.current.status)}`"
          >{{ panel.statusLabel(panel.current.status) }}</span
        >
      </div>
      <div v-if="batchRunning(panel.current)" class="edge-tts-progress">
        <span :style="{ width: `${Math.max(4, panel.current.progress)}%` }" />
      </div>
      <div class="edge-tts-result-actions">
        <n-button size="small" @click="panel.openBatch(panel.current.id)"
          ><template #icon><ListTree :size="15" /></template>查看详情</n-button
        >
        <SpeechBatchDownloads toolbar :batch="panel.current" />
        <SaveToAudioLibrary
          toolbar
          engine="edge-tts"
          :batch-id="panel.current.id"
          :items="panel.current.items"
          label="全部加入音频库"
        />
        <n-button
          v-if="batchRunning(panel.current)"
          size="small"
          :disabled="panel.busy"
          @click="panel.cancelBatch(panel.current.id)"
          >取消剩余</n-button
        >
      </div>
    </section>
    <section class="edge-tts-history">
      <div class="panel-heading">
        <div>
          <h3>在线配音批次</h3>
          <p>独立 MP3、总音频和字幕默认保留 {{ panel.health?.retentionDays || 3 }} 天；加入音频库后永久保存。</p>
        </div>
        <n-button secondary :loading="panel.loadingBatches" :disabled="panel.deletingBatches" @click="panel.loadBatches"
          ><RefreshCw :size="16" />刷新</n-button
        >
      </div>
      <SpeechBatchSelectionToolbar
        v-if="panel.history.batches.length"
        :selected-count="panel.selectedBatchIds.length"
        :checked="panel.allPageBatchesSelected"
        :indeterminate="panel.somePageBatchesSelected"
        :disabled="panel.loadingBatches || panel.busy"
        :loading="panel.deletingBatches"
        @select-all="panel.toggleAllPageBatches"
        @remove="panel.removeSelectedBatches"
      />
      <div class="edge-tts-history-list batch-history-list">
        <article v-for="batch in panel.history.batches" :key="batch.id">
          <div class="history-main">
            <n-checkbox
              :checked="panel.selectedBatchIds.includes(batch.id)"
              :disabled="panel.deletingBatches || panel.loadingBatches || panel.busy"
              :aria-label="`选择批次 ${panel.title(batch)}`"
              @update:checked="panel.toggleBatchSelection(batch.id, $event)"
            />
            <div class="voice-avatar"><Layers3 :size="18" /></div>
            <div>
              <strong>{{ panel.title(batch) }}</strong>
              <p
                :title="
                  batch.items
                    .slice(0, 2)
                    .map((item) => item.text)
                    .join(' / ')
                "
              >
                {{
                  batch.items
                    .slice(0, 2)
                    .map((item) => item.text)
                    .join(" / ")
                }}
              </p>
              <div class="batch-history-meta">
                <span class="batch-history-summary"
                  >{{ panel.languageLabel(batch.language) }} · {{ batch.completedItems }}/{{
                    batch.items.length
                  }}
                  段完成 · {{ formatDate(batch.createdAt) }}</span
                >
                <span
                  class="chatterbox-batch-status-badge"
                  :class="`chatterbox-batch-status-badge--${batchTagType(batch.status)}`"
                  >{{ panel.statusLabel(batch.status) }}</span
                >
              </div>
            </div>
          </div>
          <div class="history-actions">
            <n-button size="small" title="查看详情" @click="panel.openBatch(batch.id)">查看详情</n-button>
            <SpeechBatchDownloads toolbar :batch="batch" archive-only />
            <SaveToAudioLibrary
              toolbar
              engine="edge-tts"
              :batch-id="batch.id"
              :items="batch.items"
              label="加入音频库"
            />
            <n-button
              size="small"
              :loading="panel.reusingBatchId === batch.id"
              :disabled="panel.creating || !!panel.reusingBatchId || panel.deletingBatches"
              title="将文案和设置重新填入输入区，不会立即生成"
              @click="panel.reuseBatch(batch.id)"
              ><template #icon><RotateCcw :size="15" /></template>重新填入批次</n-button
            >
            <n-button
              v-if="batchRunning(batch)"
              circle
              quaternary
              size="small"
              title="取消剩余"
              :disabled="panel.busy || panel.deletingBatches"
              @click="panel.cancelBatch(batch.id)"
              ><X :size="17" /></n-button
            ><n-button
              circle
              quaternary
              type="error"
              size="small"
              title="删除批次"
              :disabled="panel.busy || panel.deletingBatches"
              @click="panel.removeBatch(batch.id)"
              ><Trash2 :size="17"
            /></n-button>
          </div>
        </article>
      </div>
      <n-empty v-if="!panel.history.batches.length && !panel.loadingBatches" description="还没有在线配音批次" />
      <div v-if="panel.history.pagination.total" class="chatterbox-batch-pagination">
        <span>共 {{ panel.history.pagination.total }} 个批次 · 每页 {{ panel.history.pagination.pageSize }} 个</span
        ><n-pagination
          :page="panel.history.pagination.page"
          :page-count="panel.history.pagination.totalPages"
          :page-slot="5"
          :disabled="panel.loadingBatches || panel.deletingBatches"
          @update:page="panel.changePage"
        />
      </div>
    </section>
    <details v-if="panel.legacy.tasks.length" class="legacy-clone-history">
      <summary>旧版单条生成记录（{{ panel.legacy.pagination.total }}）</summary>
      <div class="edge-tts-history-list">
        <article v-for="task in panel.legacy.tasks" :key="task.id">
          <div class="history-main">
            <div>
              <strong>{{ task.fileName || task.id }}</strong>
              <p>{{ task.textPreview }}</p>
              <span>{{ panel.statusLabel(task.status) }}</span>
            </div>
          </div>
          <div class="history-actions">
            <a v-if="task.downloadUrl" :href="panel.mediaUrl(task.downloadUrl)">下载 MP3</a
            ><a v-if="task.subtitleUrl" :href="panel.mediaUrl(task.subtitleUrl)">下载 SRT</a
            ><n-button size="small" @click="panel.reuseLegacy(task.id)">载入有序文案</n-button
            ><n-button type="error" secondary size="small" @click="panel.removeLegacy(task.id)">删除</n-button>
          </div>
        </article>
      </div>
      <n-pagination
        v-if="panel.legacy.pagination.totalPages > 1"
        class="pagination-with-total"
        :page="panel.legacy.pagination.page"
        :page-count="panel.legacy.pagination.totalPages"
        @update:page="panel.loadLegacy"
        ><template #prefix>共 {{ panel.legacy.pagination.total }} 条</template></n-pagination
      >
    </details>
    <EdgeTtsBatchDetail />
  </div>
</template>
<script setup lang="ts">
import DiagnosticErrorLink from "../../../shared/ui/DiagnosticErrorLink.vue";
import { provide, reactive, watch } from "vue";
import { NButton, NCheckbox, NSelect, NSlider, NEmpty, NPagination } from "naive-ui";
import { UserRound, Check, ListTree, Layers3, RefreshCw, Trash2, X, RotateCcw } from "lucide-vue-next";
import type { EdgeTtsHealth } from "@toolbox/shared";
import { useEdgeTtsPanel, onlineLanguages, onlinePresets, batchRunning } from "./useEdgeTtsPanel";
import { edgeTtsPanelKey } from "./edge-tts-panel-context";
import { orderedSpeechEditorKey } from "../shared/useOrderedSpeechEditor";
import OrderedSpeechEditor from "../shared/OrderedSpeechEditor.vue";
import EdgeTtsBatchDetail from "./EdgeTtsBatchDetail.vue";
import SpeechBatchDownloads from "../shared/SpeechBatchDownloads.vue";
import SpeechBatchSelectionToolbar from "../shared/SpeechBatchSelectionToolbar.vue";
import { SaveToAudioLibrary } from "../../audio-library/integrations/speech";
import { batchTagType, formatDuration, formatDate } from "../shared/speech-batch-display";
const emit = defineEmits<{ health: [value: EdgeTtsHealth | undefined] }>();
const panel = reactive(useEdgeTtsPanel());
provide(edgeTtsPanelKey, panel);
provide(orderedSpeechEditorKey, panel.editor);
watch(
  () => panel.health,
  (value) => emit("health", value)
);
</script>
<style src="../chatterbox/ChatterboxPanel.css"></style>
