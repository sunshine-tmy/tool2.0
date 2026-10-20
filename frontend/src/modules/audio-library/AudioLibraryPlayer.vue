<template>
  <section v-if="player.current || player.queue.length" class="library-player" aria-label="直播音频播放器">
    <div class="library-player-heading">
      <div>
        <strong
          >{{ player.preview ? "试听 · " : player.selectionOnly ? "单条播放 · " : ""
          }}{{ player.current?.title || "播放队列" }}</strong
        >
        <p>{{ player.current?.chineseText || player.current?.foreignText || "暂无文案" }}</p>
      </div>
      <n-button
        v-if="(player.preview || player.selectionOnly) && player.queue.length"
        size="small"
        @click="player.resumeQueue()"
        >{{ player.preview ? "继续原队列" : "继续队列播放" }}</n-button
      ><n-button size="small" @click="queueOpen = !queueOpen">队列 {{ player.queue.length }}</n-button>
    </div>
    <div class="library-player-controls">
      <div class="library-player-transport" role="group" aria-label="播放控制">
        <n-button aria-label="上一条" size="small" @click="player.step(-1)">上一条</n-button>
        <n-button type="primary" size="small" @click="player.toggle()">{{
          ["playing", "loading", "waiting"].includes(player.phase) ? "暂停" : "播放"
        }}</n-button>
        <n-button type="error" secondary size="small" @click="player.stop()">停止</n-button>
        <n-button size="small" @click="player.step(1)">下一条</n-button>
      </div>
      <div class="library-player-timeline">
        <n-slider
          v-slider-label="{ label: '播放进度', text: formatDuration(player.position) }"
          class="library-player-progress"
          :min="0"
          :max="player.current?.duration || 0"
          :value="player.position"
          :step="0.1"
          :disabled="!player.current?.duration"
          :format-tooltip="formatDuration"
          @update:value="(value) => player.seek(value)"
        />
        <span class="library-player-time"
          >{{ formatDuration(player.position) }} / {{ formatDuration(player.current?.duration || 0) }}</span
        >
      </div>
      <div class="library-player-settings" role="group" aria-label="播放设置">
        <div class="library-player-setting library-player-mode" role="group" aria-label="播放方式">
          <span class="library-player-setting-label"><Repeat2 :size="14" aria-hidden="true" />模式</span>
          <n-select
            v-model:value="player.mode"
            class="library-player-select"
            size="small"
            :options="modeOptions"
            :input-props="{ 'aria-label': '播放方式' }"
          />
        </div>
        <div class="library-player-setting library-player-gap" role="group" aria-label="播放间隔">
          <span class="library-player-setting-label"><Clock3 :size="14" aria-hidden="true" />间隔</span>
          <n-input-number
            class="library-player-gap-input"
            size="small"
            :value="player.gap"
            :min="0"
            :max="300"
            :input-props="{ 'aria-label': '播放间隔（秒）' }"
            @update:value="updateGap"
          />
          <span class="library-player-unit">秒</span>
        </div>
        <div class="library-player-setting library-player-volume" role="group" aria-label="播放音量">
          <span class="library-player-setting-label"><Volume2 :size="14" aria-hidden="true" />音量</span>
          <n-slider
            v-slider-label="{ label: '音量', text: volumeLabel(player.volume) }"
            class="library-player-volume-slider"
            :min="0"
            :max="1"
            :step="0.01"
            :value="player.volume"
            :format-tooltip="volumeLabel"
            @update:value="(value) => player.setVolume(value)"
          />
          <span class="library-player-volume-value" aria-hidden="true">{{ Math.round(player.volume * 100) }}%</span>
        </div>
      </div>
    </div>
    <p v-if="player.phase === 'waiting'" class="library-player-waiting" role="status">
      <Clock3 :size="14" aria-hidden="true" />{{ Math.ceil(player.remaining) }} 秒后播放下一条
    </p>
    <p v-if="player.error" role="alert" class="library-player-error">
      {{ player.error }} <n-button text @click="player.play()">重试</n-button>
      <n-button text @click="player.step(1)">跳过</n-button>
    </p>
    <div v-if="queueOpen" class="library-queue">
      <header><strong>临时播放队列</strong><n-button size="tiny" @click="player.clear()">清空队列</n-button></header>
      <div
        v-for="(entry, index) in player.queue"
        :key="entry.entryId"
        draggable="true"
        @dragstart="dragged = index"
        @dragend="dragged = -1"
        @dragover.prevent
        @drop.prevent="player.reorder(dragged, index)"
      >
        <div class="library-queue-copy">
          <n-button
            text
            class="library-queue-title"
            :title="`${entry.item.title} · 定位到此条，保持暂停`"
            :aria-label="`定位到第 ${index + 1} 条：${entry.item.title}`"
            :type="player.currentId === entry.entryId ? 'primary' : 'default'"
            @click="player.select(entry.entryId)"
            >{{ index + 1 }}. {{ entry.item.title }}</n-button
          >
          <p class="library-queue-chinese"><span>中文：</span>{{ entry.item.chineseText.trim() || "暂无中文译文" }}</p>
          <p
            v-if="entry.item.foreignText.trim() && entry.item.foreignText.trim() !== entry.item.title.trim()"
            class="library-queue-foreign"
          >
            <span>外语：</span>{{ entry.item.foreignText }}
          </p>
        </div>
        <span class="library-queue-actions"
          ><n-button
            class="library-queue-play-once"
            size="tiny"
            type="primary"
            secondary
            :disabled="!entry.item.available"
            :aria-label="`单次播放第 ${index + 1} 条：${entry.item.title}`"
            title="仅播放一次，结束后停止"
            @click.stop="player.playOnce(entry.entryId)"
            >单次播放</n-button
          ><n-button size="tiny" :disabled="index === 0" @click="player.reorder(index, index - 1)">上移</n-button
          ><n-button size="tiny" :disabled="index === player.queue.length - 1" @click="player.reorder(index, index + 1)"
            >下移</n-button
          ><n-button size="tiny" @click="player.remove(entry.entryId)">移除</n-button></span
        >
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { NButton, NInputNumber, NSelect, NSlider } from "naive-ui";
import { Clock3, Repeat2, Volume2 } from "lucide-vue-next";
import { audioLibraryPlayer as player } from "./player";
import { formatDuration } from "./api";
import { vSliderLabel } from "./slider-label";
const queueOpen = ref(false);
const modeOptions = [
  { label: "顺序播放", value: "sequence" },
  { label: "列表循环", value: "list" },
  { label: "单曲循环", value: "single" }
];
const volumeLabel = (value: number) => `${Math.round(value * 100)}%`;
function updateGap(value: number | null) {
  player.gap = value !== null && Number.isFinite(value) ? Math.max(0, Math.min(300, value)) : 0;
}
let dragged = -1;
</script>
<style scoped>
.library-player {
  container-type: inline-size;
  position: relative;
  margin-top: 16px;
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #dce5f3;
  border-radius: 12px;
  padding: 16px 20px;
  color: #172033;
}
.library-player-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}
.library-player-heading > div {
  flex: 1;
  min-width: 0;
}
.library-player-heading p {
  margin: 4px 0 0;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.library-player-controls {
  display: grid;
  grid-template-columns: auto minmax(150px, 1fr) auto;
  gap: 16px;
  align-items: center;
  font-size: 12px;
}
.library-player-transport,
.library-player-timeline,
.library-player-settings,
.library-player-setting,
.library-player-setting-label {
  display: flex;
  align-items: center;
}
.library-player-transport {
  gap: 8px;
}
.library-player-timeline {
  gap: 12px;
  min-width: 0;
}
.library-player-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: #64748b;
}
.library-player-settings {
  gap: 8px;
  min-width: 0;
}
.library-player-setting {
  gap: 8px;
  min-width: 0;
  min-height: 36px;
  box-sizing: border-box;
  padding: 4px 10px;
  background: #f6f8fc;
  border: 1px solid #e5ebf5;
  border-radius: 8px;
}
.library-player-setting-label {
  gap: 5px;
  color: #64748b;
  white-space: nowrap;
}
.library-player-select {
  flex: 1;
  width: 110px;
  min-width: 100px;
}
.library-player-gap-input {
  flex: 1;
  width: 96px;
  min-width: 80px;
}
.library-player-unit {
  color: #64748b;
}
.library-player-volume-slider {
  width: 76px;
  min-width: 0;
}
.library-player-volume-value {
  min-width: 32px;
  text-align: right;
  color: #475569;
  font-variant-numeric: tabular-nums;
}
.library-player-progress {
  flex: 1;
  width: 100%;
  min-width: 0;
}
.library-player-waiting {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0;
  color: #2563eb;
  font-size: 12px;
}
.library-player-error {
  color: #dc2626;
  margin: 8px 0 0;
}
.library-queue {
  position: static;
  margin-top: 12px;
  width: 100%;
  box-sizing: border-box;
  max-height: 50vh;
  overflow: auto;
  background: white;
  border: 1px solid #dce5f3;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 -10px 30px #17203314;
}
.library-queue > div,
.library-queue > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 6px 0;
}
.library-queue > div {
  align-items: flex-start;
  border-bottom: 1px solid #edf1f7;
  padding: 10px 0;
}
.library-queue-copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.library-queue-copy .library-queue-title {
  height: auto;
  max-width: 100%;
  text-align: left;
}
.library-queue-title :deep(.n-button__content) {
  display: block;
  white-space: normal;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.library-queue-copy p {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.library-queue-chinese {
  color: #172033;
}
.library-queue-foreign {
  color: #64748b;
}
.library-queue-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
@media (max-width: 420px) {
  .library-queue > div {
    flex-wrap: wrap;
  }
  .library-queue-actions {
    justify-content: flex-end;
    width: 100%;
  }
}
@container (max-width: 1000px) {
  .library-player-controls {
    grid-template-columns: auto minmax(150px, 1fr);
    gap: 12px;
  }
  .library-player-settings {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr 1.3fr;
  }
  .library-player-volume-slider {
    flex: 1;
    width: 0;
  }
}
@container (max-width: 580px) {
  .library-player-controls {
    grid-template-columns: minmax(0, 1fr);
  }
  .library-player-settings {
    grid-template-columns: minmax(0, 1fr);
  }
  .library-player-volume {
    grid-column: 1 / -1;
  }
}
@media (max-width: 700px) {
  .library-player {
    padding: 14px 12px;
  }
}
</style>
