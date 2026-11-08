<template>
  <section v-if="player.current || player.queue.length" class="library-player" aria-label="直播音频播放器">
    <div class="library-player-bar">
      <div class="library-player-heading">
        <img :src="libraryIcon" alt="" class="library-player-art" />
        <div class="library-player-copy">
          <strong :title="player.current?.title">{{ player.current?.title || "播放队列" }}</strong>
          <p>
            {{ player.preview ? "试听" : player.selectionOnly ? "单条播放" : "播放队列" }} ·
            {{ player.current ? purposeLabel(player.current) : `${player.queue.length} 条音频` }}
          </p>
        </div>
      </div>
      <div class="library-player-transport" role="group" aria-label="播放控制">
        <n-button circle class="transport-step" aria-label="上一条" title="上一条" @click="player.step(-1)"
          ><SkipBack :size="18"
        /></n-button>
        <n-button
          circle
          type="primary"
          class="transport-play"
          :aria-label="['playing', 'loading', 'waiting'].includes(player.phase) ? '暂停' : '播放'"
          @click="player.toggle()"
        >
          <Pause v-if="['playing', 'loading', 'waiting'].includes(player.phase)" :size="23" fill="currentColor" />
          <Play v-else :size="23" fill="currentColor" />
        </n-button>
        <n-button circle class="transport-step" aria-label="下一条" title="下一条" @click="player.step(1)"
          ><SkipForward :size="18"
        /></n-button>
      </div>
      <div class="library-player-timeline">
        <span class="library-player-time"
          >{{ formatDuration(player.position) }} / {{ formatDuration(player.current?.duration || 0) }}</span
        >
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
      </div>
      <div class="library-player-volume" role="group" aria-label="播放音量">
        <n-button
          circle
          quaternary
          class="library-mute-button"
          :aria-label="player.volume === 0 ? '取消静音' : '静音'"
          :title="player.volume === 0 ? '取消静音' : '静音'"
          :aria-pressed="player.volume === 0"
          @click="toggleMute"
        >
          <VolumeX v-if="player.volume === 0" :size="21" aria-hidden="true" />
          <Volume2 v-else :size="21" aria-hidden="true" />
        </n-button>
        <n-slider
          v-slider-label="{ label: '音量', text: volumeLabel(player.volume) }"
          :min="0"
          :max="1"
          :step="0.01"
          :value="player.volume"
          :format-tooltip="volumeLabel"
          @update:value="(value) => player.setVolume(value)"
        />
      </div>
      <div class="library-player-tools">
        <n-popover trigger="click" placement="top-end">
          <template #trigger
            ><n-button circle quaternary aria-label="播放设置" title="播放设置"
              ><SlidersHorizontal :size="20" /></n-button
          ></template>
          <div class="library-playback-options">
            <strong>播放设置</strong>
            <label
              ><span>播放方式</span
              ><n-select
                v-model:value="player.mode"
                size="small"
                :options="modeOptions"
                :input-props="{ 'aria-label': '播放方式' }"
            /></label>
            <label
              ><span>播放间隔（秒）</span
              ><n-input-number
                size="small"
                :value="player.gap"
                :min="0"
                :max="300"
                :input-props="{ 'aria-label': '播放间隔（秒）' }"
                @update:value="updateGap"
            /></label>
            <n-button
              v-if="(player.preview || player.selectionOnly) && player.queue.length"
              size="small"
              @click="player.resumeQueue()"
              >继续原队列</n-button
            >
            <n-button size="small" type="error" secondary @click="player.stop()"
              ><template #icon><Square :size="14" /></template>停止播放</n-button
            >
          </div>
        </n-popover>
        <n-button
          circle
          quaternary
          :type="queueOpen ? 'primary' : 'default'"
          :aria-label="`播放队列 ${player.queue.length} 条`"
          :title="`播放队列 · ${player.queue.length} 条`"
          @click="queueOpen = !queueOpen"
          ><ListMusic :size="22"
        /></n-button>
      </div>
    </div>
    <p v-if="player.phase === 'waiting'" class="library-player-waiting" role="status">
      <Clock3 :size="14" aria-hidden="true" />{{ Math.ceil(player.remaining) }}
      秒后播放下一条
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
import { ref, watch } from "vue";
import { NButton, NInputNumber, NSelect, NSlider, NPopover } from "naive-ui";
import {
  Clock3,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  SlidersHorizontal,
  ListMusic,
  Square
} from "lucide-vue-next";
import { audioLibraryPurpose, type AudioLibraryItemView } from "@toolbox/shared";
import libraryIcon from "../../assets/ui-v2/icons/audio-library.webp";
const purposeLabel = (item: AudioLibraryItemView) =>
  ({ music: "背景音乐", speech: "配音素材", general: "通用音频" })[audioLibraryPurpose(item)];
import { audioLibraryPlayer as player } from "./player";
import { formatDuration } from "./presentation";
import { vSliderLabel } from "./slider-label";
const queueOpen = ref(false);
const modeOptions = [
  { label: "顺序播放", value: "sequence" },
  { label: "列表循环", value: "list" },
  { label: "单曲循环", value: "single" }
];
const lastAudibleVolume = ref(player.volume > 0 ? player.volume : 1);
watch(
  () => player.volume,
  (volume) => {
    if (volume > 0) lastAudibleVolume.value = volume;
  }
);
function toggleMute() {
  if (player.volume > 0) {
    lastAudibleVolume.value = player.volume;
    player.setVolume(0);
  } else {
    player.setVolume(lastAudibleVolume.value);
  }
}
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
  padding: 16px 22px;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: linear-gradient(110deg, #fff, var(--color-surface-subtle));
  box-shadow: 0 4px 20px #6558ff0d;
}
.library-player-bar {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) auto minmax(200px, 1.5fr) 150px auto;
  align-items: center;
  gap: 24px;
  min-width: 0;
}
.library-player-heading {
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
  padding-right: 20px;
  border-right: 1px solid var(--color-border);
}
.library-player-art {
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  object-fit: contain;
}
.library-player-copy {
  min-width: 0;
}
.library-player-copy strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 700;
}
.library-player-copy p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.library-player-transport {
  display: flex;
  gap: 14px;
  align-items: center;
}
.transport-step {
  width: 36px;
  height: 36px;
  color: var(--color-text-secondary);
  background: var(--color-surface-subtle);
}
.transport-play {
  width: 46px;
  height: 46px;
  background: linear-gradient(145deg, #9588ff, var(--color-primary-600));
  box-shadow: 0 4px 10px #6558ff30;
}
.library-player-timeline {
  display: flex;
  gap: 18px;
  align-items: center;
  min-width: 0;
}
.library-player-time {
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.library-player-progress {
  flex: 1;
  min-width: 60px;
}
.library-player-volume {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-text-secondary);
  min-width: 0;
}
.library-mute-button {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}
.library-player-volume :deep(.n-slider) {
  flex: 1;
  min-width: 60px;
}
.library-player-tools {
  display: flex;
  align-items: center;
  gap: 2px;
  color: var(--color-text-secondary);
}
.library-playback-options {
  display: grid;
  gap: 14px;
  width: 240px;
  padding: 6px;
}
.library-playback-options > strong {
  color: var(--color-text);
}
.library-playback-options label {
  display: grid;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.library-player-waiting {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0;
  color: var(--color-primary-600);
  font-size: 12px;
}
.library-player-error {
  color: #dc2626;
  margin: 8px 0 0;
}
.library-queue {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  z-index: 20;
  margin-top: 0;
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
  border-bottom: 1px solid var(--color-border);
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
  color: var(--color-text);
}
.library-queue-foreign {
  color: var(--color-text-secondary);
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
@container (max-width: 1100px) {
  .library-player-bar {
    grid-template-columns: minmax(150px, 1fr) auto minmax(160px, 1.4fr) auto;
    gap: 16px;
  }
  .library-player-volume {
    grid-row: 2;
    grid-column: 3;
    justify-self: end;
    width: 140px;
  }
  .library-player-tools {
    grid-column: 4;
    grid-row: 1;
  }
}
@container (max-width: 700px) {
  .library-player-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
  }
  .library-player-heading {
    grid-column: 1;
    border: 0;
    padding: 0;
  }
  .library-player-tools {
    grid-column: 2;
    grid-row: 1;
  }
  .library-player-transport {
    grid-column: 1;
    grid-row: 2;
  }
  .library-player-volume {
    grid-column: 2;
    grid-row: 2;
    width: 120px;
  }
  .library-player-timeline {
    grid-column: 1/-1;
    grid-row: 3;
  }
}
@media (max-width: 700px) {
  .library-player {
    padding: 14px;
  }
}
</style>
