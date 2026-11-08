<template>
  <section class="extract-panel">
    <div class="extract-setup-grid">
      <div class="extract-upload-section">
        <header class="module-section-heading">
          <h3>上传视频</h3>
          <n-button type="primary" :disabled="busy" @click="input?.click()">选择视频（最多 1000 个）</n-button>
        </header>
        <input ref="input" hidden type="file" multiple accept=".mp4,.mkv,.avi,.mov,.webm" @change="choose" />
        <div
          class="extract-drop file-upload-area"
          data-upload-area
          role="button"
          tabindex="0"
          :aria-disabled="busy"
          @click="!busy && input?.click()"
          @keydown.enter="!busy && input?.click()"
          @keydown.space.prevent="!busy && input?.click()"
          @dragover.prevent
          @drop.prevent="!busy && emit('choose', Array.from($event.dataTransfer?.files ?? []))"
        >
          <UploadCloud :size="32" aria-hidden="true" /><strong>点击或拖入视频</strong
          ><span>MP4 / MKV / AVI / MOV / WebM · 最多 1000 个</span>
        </div>
      </div>
      <div class="extract-configuration">
        <h3 class="module-section-title">提取设置</h3>
        <label class="module-setting"
          ><span>输出格式</span
          ><n-select
            aria-label="输出方式"
            :value="format"
            :disabled="busy"
            :options="[
              { label: 'MP3 · 兼容优先', value: 'mp3' },
              { label: '保留原音轨 · 不重新编码', value: 'original' }
            ]"
            @update:value="emit('update:format', $event)" /></label
        ><label class="module-setting"
          ><span>MP3 音质 / 码率</span
          ><n-select
            v-if="format === 'mp3'"
            aria-label="MP3 音质"
            :value="bitrate"
            :disabled="busy"
            :options="
              [128, 192, 256, 320].map((v) => ({
                value: v,
                label: `${v} kbps${v === 192 ? ' · 推荐' : ''}`
              }))
            "
            @update:value="emit('update:bitrate', $event)" /></label
        ><label class="module-setting"
          ><span>音轨选择</span
          ><n-select
            aria-label="音轨策略"
            :value="policy"
            :disabled="busy"
            :options="[
              { label: '默认音轨', value: 'default' },
              { label: '全部音轨（分别保存）', value: 'all' },
              { label: '多音轨时手动选择', value: 'manual' }
            ]"
            @update:value="emit('update:policy', $event)"
        /></label>
        <p class="module-muted">192 kbps 兼顾音质与体积；保留原音轨时不重新编码。</p>
        <div class="extract-submit">
          <n-button type="primary" :disabled="busy || !remaining" @click="emit('start')"
            >开始提取 {{ remaining }} 个视频</n-button
          ><n-button v-if="busy" @click="emit('stop')">停止后续上传</n-button>
        </div>
      </div>
    </div>
    <details class="module-help">
      <summary>文件限制与留档说明</summary>
      <p>
        单个视频最大 2 GiB、最长 6 小时。逐个上传、识别并提取，不改动原视频。192 kbps 表示每秒约 192
        千比特音频数据，提高码率不能恢复已丢失的细节。
      </p>
      <p>
        成功结果长期保留；临时视频任务结束后清理。已提交任务离开页面后继续，未上传文件需要重新选择。默认音轨优先使用视频的默认标记。
      </p>
    </details>
  </section>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { UploadCloud } from "lucide-vue-next";
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
  box-shadow: var(--shadow-card);
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.extract-drop {
  margin-top: 16px;
  padding: 32px;
  min-height: 160px;
  display: grid;
  place-content: center;
  text-align: center;
  border: 1px dashed var(--color-primary-200);
  border-radius: 10px;
  cursor: pointer;
  background: var(--color-surface-subtle);
}
.extract-panel p {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.extract-setup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
}
.extract-upload-section {
  min-width: 0;
}
.module-section-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.module-section-heading h3,
.module-section-title {
  margin: 0;
  font-size: 18px;
}
.extract-drop {
  min-height: 200px;
  margin-top: 16px;
  gap: 12px;
  color: var(--color-primary-700);
}
.extract-drop strong {
  font-size: 18px;
}
.extract-drop span {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.extract-configuration {
  display: grid;
  align-content: start;
  gap: 16px;
  border-left: 1px solid var(--color-border);
  padding-left: 24px;
}
.module-setting {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.module-setting > span {
  font-weight: 500;
}
.module-muted {
  margin: 0;
}
.extract-submit {
  display: grid;
  gap: 8px;
}
.module-help {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 13px;
}
.module-help summary {
  cursor: pointer;
}
@media (max-width: 900px) {
  .extract-setup-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .extract-configuration {
    border-left: 0;
    border-top: 1px solid var(--color-border);
    padding: 20px 0 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .extract-configuration h3,
  .extract-submit,
  .module-muted {
    grid-column: 1/-1;
  }
}
@media (max-width: 560px) {
  .extract-configuration {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
