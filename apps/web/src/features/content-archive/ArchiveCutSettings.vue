<template>
  <section class="cut-settings">
    <div class="cut-settings-header">
      <strong>片段设置</strong
      ><n-button size="small" :disabled="disabled || !selected.length" @click="$emit('duplicate')"
        >复制选中元素</n-button
      >
    </div>
    <template v-if="clip">
      <div class="cut-setting-grid">
        <label
          >原片起点（秒）<n-input-number
            v-model:value="start"
            :min="0"
            :max="sourceDuration"
            :step="1 / fps"
            :precision="3"
            :disabled="disabled"
        /></label>
        <label
          >原片终点（秒）<n-input-number
            v-model:value="end"
            :min="0"
            :max="sourceDuration"
            :step="1 / fps"
            :precision="3"
            :disabled="disabled"
        /></label>
      </div>
      <label>播放速度<n-select v-model:value="speed" :options="speedOptions" :disabled="disabled" /></label>
      <label
        >片段原声音量 {{ volume ?? 100 }}%<n-slider
          v-model:value="volume"
          :min="0"
          :max="100"
          :disabled="disabled"
          aria-label="片段原声音量"
      /></label>
      <n-button size="small" :disabled="disabled" @click="volume = volume ? 0 : 100">{{
        volume ? "片段静音" : "恢复片段原声"
      }}</n-button>
      <div class="cut-setting-grid">
        <label
          >声音淡入（秒）<n-input-number v-model:value="fadeIn" :min="0" :max="5" :step="0.1" :disabled="disabled"
        /></label>
        <label
          >声音淡出（秒）<n-input-number v-model:value="fadeOut" :min="0" :max="5" :step="0.1" :disabled="disabled"
        /></label>
      </div>
      <div class="cut-setting-grid">
        <label
          >与下一片段的转场<n-select
            v-model:value="transitionType"
            :options="transitionOptions"
            :disabled="disabled" /></label
        ><label
          >转场时长（秒）<n-input-number
            v-model:value="transitionDuration"
            :min="0.1"
            :max="2"
            :step="0.1"
            :disabled="disabled || transitionType === 'none'"
        /></label>
      </div>
      <small>同轨视频重叠时应用转场，时长按重叠范围与片段长度自动限制。</small>
      <small>倍速保持音高。淡入淡出按变速后的时长计算，最长为片段的一半。</small>
      <n-button
        type="primary"
        secondary
        :disabled="disabled || start === null || end === null || end <= start"
        @click="applyClip"
        >应用到选中片段</n-button
      >
    </template>
    <p v-else class="cut-settings-empty">选择一个片段可调整时间、倍速与声音。</p>
    <div class="cut-settings-header frame-header">
      <strong>成片画幅</strong
      ><n-button size="small" :disabled="disabled" @click="Object.assign(frameDraft, defaultArchiveFrame())"
        >重置画幅</n-button
      >
    </div>
    <label>画幅比例<n-select v-model:value="frameDraft.aspect" :options="aspectOptions" :disabled="disabled" /></label>
    <label>旋转<n-select v-model:value="frameDraft.rotation" :options="rotationOptions" :disabled="disabled" /></label>
    <div class="cut-setting-grid">
      <n-checkbox v-model:checked="frameDraft.flipX" :disabled="disabled">水平镜像</n-checkbox
      ><n-checkbox v-model:checked="frameDraft.flipY" :disabled="disabled">垂直镜像</n-checkbox>
    </div>
    <template v-if="frameDraft.aspect !== 'source'">
      <label
        >裁切位置 · 水平<n-slider
          v-model:value="frameDraft.x"
          :min="0"
          :max="1"
          :step="0.01"
          :disabled="disabled"
          aria-label="画幅水平裁切位置"
      /></label>
      <label
        >裁切位置 · 垂直<n-slider
          v-model:value="frameDraft.y"
          :min="0"
          :max="1"
          :step="0.01"
          :disabled="disabled"
          aria-label="画幅垂直裁切位置"
      /></label>
    </template>
    <small>按所选比例裁切画面，应用于整段成片。预计输出 {{ size.width }} × {{ size.height }}。</small>
    <n-button type="primary" secondary :disabled="disabled" @click="$emit('frame', { ...frameDraft })"
      >应用成片画幅</n-button
    >
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { NButton, NCheckbox, NInputNumber, NSelect, NSlider } from "naive-ui";
import {
  defaultArchiveFrame,
  archiveFrameGeometry,
  type ArchiveFrame,
  type ArchiveCutClip
} from "@toolbox/shared/archive";
const props = defineProps<{
  clips: ArchiveCutClip[];
  selected: string[];
  frame: ArchiveFrame;
  sourceDuration: number;
  sourceWidth: number;
  sourceHeight: number;
  fps: number;
  disabled: boolean;
}>();
const emit = defineEmits<{
  clip: [id: string, changes: Partial<ArchiveCutClip>];
  frame: [value: ArchiveFrame];
  duplicate: [];
}>();
const clip = computed(() =>
  props.selected.length === 1 ? props.clips.find((entry) => entry.id === props.selected[0]) : undefined
);
const transitionType = ref<"none" | "fade" | "dissolve" | "slideleft" | "slideright">("none"),
  transitionDuration = ref<number | null>(0.5);
const transitionOptions = [
  { label: "无转场", value: "none" },
  { label: "淡化", value: "fade" },
  { label: "溶解", value: "dissolve" },
  { label: "向左滑动", value: "slideleft" },
  { label: "向右滑动", value: "slideright" }
];
const start = ref<number | null>(0),
  end = ref<number | null>(0),
  speed = ref(1),
  volume = ref(100),
  fadeIn = ref<number | null>(0),
  fadeOut = ref<number | null>(0);
watch(
  clip,
  (value) => {
    transitionType.value = value?.transition?.type ?? "none";
    transitionDuration.value = value?.transition?.duration ?? 0.5;
    start.value = value?.start ?? 0;
    end.value = value?.end ?? 0;
    speed.value = value?.speed ?? 1;
    volume.value = value?.volume ?? 100;
    fadeIn.value = value?.fadeIn ?? 0;
    fadeOut.value = value?.fadeOut ?? 0;
  },
  { immediate: true, deep: true }
);
const frameDraft = reactive<ArchiveFrame>(defaultArchiveFrame());
watch(
  () => props.frame,
  (value) => Object.assign(frameDraft, value),
  { immediate: true, deep: true }
);
const size = computed(() => archiveFrameGeometry(props.sourceWidth || 2, props.sourceHeight || 2, frameDraft));
const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((value) => ({
  label: `${value} 倍${value === 1 ? "（正常）" : ""}`,
  value
}));
const aspectOptions = [
  { label: "保持原画幅", value: "source" },
  ...["9:16", "3:4", "16:9", "1:1"].map((value) => ({ label: value, value }))
];
const rotationOptions = [0, 90, 180, 270].map((value) => ({ label: value ? `顺时针 ${value}°` : "不旋转", value }));
function applyClip() {
  if (clip.value && start.value !== null && end.value !== null)
    emit("clip", clip.value.id, {
      start: start.value,
      end: end.value,
      speed: speed.value,
      volume: volume.value,
      fadeIn: fadeIn.value ?? 0,
      fadeOut: fadeOut.value ?? 0,
      transition:
        transitionType.value === "none"
          ? undefined
          : { type: transitionType.value, duration: transitionDuration.value ?? 0.5 }
    });
}
</script>
<style scoped>
.cut-settings {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.cut-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cut-setting-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cut-settings label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.cut-settings small,
.cut-settings-empty {
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.frame-header {
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
  padding-top: 16px;
}
</style>
