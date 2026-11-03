<template>
  <section class="extract-panel">
    <div class="extract-actions">
      <n-button :disabled="busy" @click="input?.click()">选择视频（最多 1000 个）</n-button>
      <n-select
        aria-label="输出方式"
        :value="format"
        :disabled="busy"
        :options="[
          { label: 'MP3 · 兼容优先', value: 'mp3' },
          { label: '保留原音轨 · 不重新编码', value: 'original' }
        ]"
        @update:value="emit('update:format', $event)"
      />
      <n-select
        v-if="format === 'mp3'"
        aria-label="MP3 音质"
        :value="bitrate"
        :disabled="busy"
        :options="[128, 192, 256, 320].map((v) => ({ value: v, label: `${v} kbps${v === 192 ? ' · 推荐' : ''}` }))"
        @update:value="emit('update:bitrate', $event)"
      />
      <n-select
        aria-label="音轨策略"
        :value="policy"
        :disabled="busy"
        :options="[
          { label: '默认音轨', value: 'default' },
          { label: '全部音轨（分别保存）', value: 'all' },
          { label: '多音轨时手动选择', value: 'manual' }
        ]"
        @update:value="emit('update:policy', $event)"
      />
      <n-button type="primary" :disabled="busy || !remaining" @click="emit('start')"
        >开始提取 {{ remaining }} 个视频</n-button
      >
      <n-button v-if="busy" @click="emit('stop')">停止后续上传</n-button>
    </div>
    <input ref="input" hidden type="file" multiple accept=".mp4,.mkv,.avi,.mov,.webm" @change="choose" />
    <div
      class="extract-drop"
      role="button"
      tabindex="0"
      :aria-disabled="busy"
      @click="!busy && input?.click()"
      @keydown.enter="!busy && input?.click()"
      @keydown.space.prevent="!busy && input?.click()"
      @dragover.prevent
      @drop.prevent="!busy && emit('choose', Array.from($event.dataTransfer?.files ?? []))"
    >
      点击或拖入视频 · MP4／MKV／AVI／MOV／WebM
    </div>
    <p>
      单个视频最大 2 GiB、最长 6 小时。逐个上传、识别并提取，不改动原视频。192 kbps 表示每秒约 192
      千比特音频数据，提高码率不能恢复已丢失的细节。
    </p>
    <p>
      成功结果长期保留；临时视频任务结束后清理。已提交任务离开页面后继续，未上传文件需要重新选择。默认音轨优先使用视频的默认标记。
    </p>
  </section>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { NButton, NSelect } from "naive-ui";
defineProps<{
  busy: boolean;
  remaining: number;
  format: "mp3" | "original";
  bitrate: number;
  policy: "default" | "all" | "manual";
}>();
const emit = defineEmits<{
  choose: [File[]];
  start: [];
  stop: [];
  "update:format": ["mp3" | "original"];
  "update:bitrate": [128 | 192 | 256 | 320];
  "update:policy": ["default" | "all" | "manual"];
}>();
const input = ref<HTMLInputElement>();
function choose(e: Event) {
  const el = e.target as HTMLInputElement;
  emit("choose", Array.from(el.files ?? []));
  el.value = "";
}
</script>
<style scoped>
.extract-panel {
  padding: 20px;
  border: 1px solid var(--border-color, #dce5f2);
  border-radius: 12px;
  background: #fff;
}
.extract-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.extract-actions .n-select {
  width: 210px;
}
.extract-drop {
  margin-top: 16px;
  padding: 26px;
  text-align: center;
  border: 1px dashed #9bbcff;
  border-radius: 10px;
  cursor: pointer;
  background: #f8fbff;
}
.extract-panel p {
  color: #60718d;
  font-size: 13px;
  line-height: 1.7;
}
</style>
