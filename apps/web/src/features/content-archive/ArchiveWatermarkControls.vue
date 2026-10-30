<template>
  <section class="watermark-controls" aria-label="水印设置">
    <button
      class="watermark-upload"
      type="button"
      :disabled="disabled"
      @click="fileInput?.click()"
      @dragover.prevent
      @drop.prevent="drop"
    >
      <img v-if="asset" :src="asset.url" alt="当前水印" />
      <span>{{ asset ? "更换水印图片" : "点击或拖入水印图片" }}</span>
      <small>PNG / JPG / WebP · 最大 20 MiB · 推荐透明 PNG</small>
    </button>
    <input
      ref="fileInput"
      hidden
      type="file"
      accept=".png,.jpg,.jpeg,.webp"
      aria-label="上传水印图片"
      @change="choose"
    />
    <ArchiveWatermarkLibrary :disabled="disabled" @select="emit('selectLibrary', $event)" />
    <template v-if="asset">
      <label
        >透明度 {{ settings.opacity }}%<n-slider
          :value="settings.opacity"
          :min="0"
          :max="100"
          :disabled="disabled"
          aria-label="水印透明度"
          @update:value="set('opacity', $event)"
      /></label>
      <label
        >水印宽度 {{ settings.widthPercent }}%<n-slider
          :value="settings.widthPercent"
          :min="1"
          :max="50"
          :disabled="disabled"
          aria-label="水印大小"
          @update:value="set('widthPercent', $event)"
      /></label>
      <div class="watermark-fields">
        <label
          >开始显示（秒）<n-input-number
            :value="settings.startSeconds"
            :min="0"
            :max="duration"
            :disabled="disabled"
            @update:value="set('startSeconds', $event ?? 0)"
        /></label>
        <label
          >结束显示（秒）<n-input-number
            :value="settings.endSeconds"
            :min="0"
            :max="duration"
            placeholder="视频结束"
            :disabled="disabled"
            @update:value="set('endSeconds', $event)"
        /></label>
      </div>
      <label
        >运动方式<n-select
          :value="settings.motion.type"
          :options="motions"
          :disabled="disabled"
          aria-label="水印运动方式"
          @update:value="motionType"
      /></label>
      <label v-if="settings.motion.type === 'bounce'"
        >反弹轨迹<n-select
          :value="settings.motion.bounceStyle ?? 'standard'"
          :options="bounceStyles"
          :disabled="disabled"
          aria-label="反弹轨迹样式"
          @update:value="bounceStyle"
      /></label>
      <n-button
        v-if="settings.motion.type === 'bounce' && settings.motion.bounceStyle === 'random'"
        :disabled="disabled"
        @click="setMotion('bounceSeed', Math.floor(Math.random() * 2147483647))"
        >换一条随机轨迹</n-button
      >
      <template v-if="settings.motion.type !== 'keyframes'">
        <n-select
          v-if="['linear', 'ping-pong'].includes(settings.motion.type)"
          :value="selectedPoint"
          :options="[
            { label: '编辑起点', value: 'from' },
            { label: '编辑终点', value: 'to' }
          ]"
          :disabled="disabled"
          @update:value="selectPoint"
        />
        <div class="watermark-positions" aria-label="水印九宫格定位">
          <n-button
            v-for="(point, index) in positions"
            :key="index"
            size="small"
            :disabled="disabled"
            @click="emit('move', point)"
            >{{ positionNames[index] }}</n-button
          >
        </div>
        <small>可拖动画面中的水印调整{{ selectedPoint === "to" ? "终点" : "位置" }}。</small>
      </template>
      <label v-if="settings.motion.type !== 'fixed' && settings.motion.type !== 'keyframes'">
        {{
          settings.motion.type === "ping-pong"
            ? "一次往返（秒）"
            : settings.motion.type === "bounce"
              ? settings.motion.bounceStyle && settings.motion.bounceStyle !== "standard"
                ? "一轮往返（秒）"
                : "横穿画面所需时间（秒）"
              : "移动时间（秒）"
        }}
        <n-input-number
          :value="settings.motion.periodSeconds"
          :min="0.25"
          :max="7200"
          :disabled="disabled"
          @update:value="setMotion('periodSeconds', $event ?? 10)"
        />
      </label>
      <div v-if="settings.motion.type === 'bounce'" class="watermark-fields">
        <n-select
          :value="settings.motion.directionX"
          :disabled="disabled"
          :options="[
            { label: '向左', value: -1 },
            { label: '向右', value: 1 }
          ]"
          @update:value="setDirection('directionX', $event)"
        />
        <n-select
          :value="settings.motion.directionY"
          :disabled="disabled"
          :options="[
            { label: '向上', value: -1 },
            { label: '向下', value: 1 }
          ]"
          @update:value="setDirection('directionY', $event)"
        />
      </div>
      <template v-if="settings.motion.type === 'keyframes'">
        <ArchiveWatermarkPresets :settings="settings" :duration="duration" :disabled="disabled" @apply="applyPreset" />
        <n-button :disabled="disabled || settings.motion.keyframes.length >= 20" @click="addFrame"
          >在当前播放位置添加关键帧</n-button
        >
        <div
          v-for="(frame, index) in settings.motion.keyframes"
          :key="index"
          class="watermark-frame"
          :class="{ selected: selectedFrame === index }"
        >
          <n-input-number
            :value="frame.timeSeconds"
            :min="settings.startSeconds"
            :max="settings.endSeconds ?? duration"
            :step="0.1"
            :disabled="disabled"
            :aria-label="`关键帧 ${index + 1} 时间`"
            @update:value="changeFrameTime(index, $event)"
          />
          <n-button size="small" :disabled="disabled" @click="selectFrame(index)"
            >{{ frame.timeSeconds.toFixed(2) }} 秒 · 定位</n-button
          >
          <n-button size="small" :disabled="disabled" @click="removeFrame(index)">删除</n-button>
        </div>
        <small>选择关键帧后拖动水印；按时间线性移动，最后一帧后保持位置，最多 20 帧。</small>
      </template>
      <p v-if="validation" role="alert">{{ validation }}</p>
      <n-button :disabled="disabled" @click="emit('remove')">移除水印</n-button>
    </template>
    <small>图片仅用于当前归档；未保存的上传草稿保留 24 小时，保存后的水印随归档长期保留。</small>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, toRaw } from "vue";
import { NButton, NInputNumber, NSelect, NSlider } from "naive-ui";
import {
  ARCHIVE_WATERMARK_BOUNCE_STYLES,
  archiveWatermarkPosition,
  watermarkTimingError,
  type ArchiveWatermarkSettings
} from "@toolbox/shared/archive";
import ArchiveWatermarkPresets from "./ArchiveWatermarkPresets.vue";
import ArchiveWatermarkLibrary from "./ArchiveWatermarkLibrary.vue";
const props = defineProps<{
  settings: ArchiveWatermarkSettings;
  asset?: { width: number; height: number; url: string };
  disabled: boolean;
  duration: number;
  time: number;
  selectedPoint: "from" | "to";
  selectedFrame: number;
}>();
const emit = defineEmits<{
  "update:settings": [ArchiveWatermarkSettings];
  "update:selectedPoint": ["from" | "to"];
  "update:selectedFrame": [number];
  upload: [File];
  selectLibrary: [id: string];
  remove: [];
  move: [{ x: number; y: number }];
  seek: [number];
}>();
const fileInput = ref<HTMLInputElement>();
const bounceStyles = ARCHIVE_WATERMARK_BOUNCE_STYLES.map((style) => ({ ...style }));
const motions = [
  { label: "固定位置", value: "fixed" },
  { label: "直线移动", value: "linear" },
  { label: "往返移动", value: "ping-pong" },
  { label: "碰边反弹", value: "bounce" },
  { label: "自定义关键帧", value: "keyframes" }
];
const positions = [0.03, 0.5, 0.97].flatMap((y) => [0.03, 0.5, 0.97].map((x) => ({ x, y })));
const positionNames = ["左上", "上中", "右上", "左中", "居中", "右中", "左下", "下中", "右下"];
const validation = computed(() => (props.asset ? watermarkTimingError(props.settings, props.duration) : undefined));
function set<K extends keyof ArchiveWatermarkSettings>(key: K, value: ArchiveWatermarkSettings[K]) {
  emit("update:settings", JSON.parse(JSON.stringify({ ...props.settings, [key]: value })) as ArchiveWatermarkSettings);
}
function setMotion<K extends keyof ArchiveWatermarkSettings["motion"]>(
  key: K,
  value: ArchiveWatermarkSettings["motion"][K]
) {
  set("motion", { ...props.settings.motion, [key]: value });
}
function motionType(type: string) {
  const next = structuredClone(toRaw(props.settings));
  next.motion.type = type;
  if (type === "keyframes" && next.motion.keyframes.length < 2)
    next.motion.keyframes = [
      { timeSeconds: next.startSeconds, ...next.motion.from },
      { timeSeconds: next.endSeconds ?? props.duration, ...next.motion.to }
    ];
  emit("update:settings", next);
  emit("update:selectedPoint", "from");
  emit("update:selectedFrame", 0);
  emit("seek", next.startSeconds);
}
function bounceStyle(style: NonNullable<ArchiveWatermarkSettings["motion"]["bounceStyle"]>) {
  set("motion", {
    ...props.settings.motion,
    bounceStyle: style,
    ...(style === "standard" ? {} : { from: { x: 0, y: 0 }, directionX: 1, directionY: 1 }),
    ...(style === "random" ? { bounceSeed: Math.floor(Math.random() * 2147483647) } : {})
  });
  emit("update:selectedPoint", "from");
  emit("seek", props.settings.startSeconds);
}
function setDirection(axis: "directionX" | "directionY", value: -1 | 1) {
  const motion = props.settings.motion;
  if (motion.bounceStyle && motion.bounceStyle !== "standard" && motion[axis] !== value) {
    set("motion", {
      ...motion,
      [axis]: value,
      from: {
        x: axis === "directionX" ? 1 - motion.from.x : motion.from.x,
        y: axis === "directionY" ? 1 - motion.from.y : motion.from.y
      }
    });
  } else setMotion(axis, value);
}
function applyPreset(settings: ArchiveWatermarkSettings) {
  emit("update:settings", settings);
  emit("update:selectedFrame", 0);
  emit("seek", settings.motion.keyframes[0]?.timeSeconds ?? settings.startSeconds);
}
function selectFrame(index: number) {
  emit("update:selectedFrame", index);
  emit("seek", props.settings.motion.keyframes[index].timeSeconds);
}
function selectPoint(point: "from" | "to") {
  emit("update:selectedPoint", point);
  emit(
    "seek",
    point === "from"
      ? props.settings.startSeconds
      : Math.min(
          props.duration,
          props.settings.startSeconds +
            props.settings.motion.periodSeconds / (props.settings.motion.type === "ping-pong" ? 2 : 1)
        )
  );
}
function addFrame() {
  if (props.disabled || props.settings.motion.keyframes.length >= 20) return;
  const timeSeconds = Math.round(Math.min(props.duration, Math.max(0, props.time)) * 100) / 100;
  if (props.settings.motion.keyframes.some((frame) => frame.timeSeconds === timeSeconds)) return;
  const { x, y } = archiveWatermarkPosition(props.settings, timeSeconds);
  const frames = [...props.settings.motion.keyframes, { timeSeconds, x, y }].sort(
    (a, b) => a.timeSeconds - b.timeSeconds
  );
  setMotion("keyframes", frames);
  emit(
    "update:selectedFrame",
    frames.findIndex((frame) => frame.timeSeconds === timeSeconds)
  );
}
function removeFrame(index: number) {
  setMotion(
    "keyframes",
    props.settings.motion.keyframes.filter((_, i) => i !== index)
  );
  emit("update:selectedFrame", 0);
}
function choose(event: Event) {
  const element = event.target as HTMLInputElement,
    file = element.files?.[0];
  element.value = "";
  if (file && !props.disabled) emit("upload", file);
}
function changeFrameTime(index: number, value: number | null) {
  if (
    value === null ||
    props.disabled ||
    props.settings.motion.keyframes.some((frame, i) => i !== index && frame.timeSeconds === value)
  )
    return;
  const frames = props.settings.motion.keyframes
    .map((frame, i) => ({ ...frame, timeSeconds: i === index ? value : frame.timeSeconds }))
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
  setMotion("keyframes", frames);
  emit(
    "update:selectedFrame",
    frames.findIndex((frame) => frame.timeSeconds === value)
  );
  emit("seek", value);
}
function drop(event: DragEvent) {
  const file = event.dataTransfer?.files[0];
  if (file && !props.disabled) emit("upload", file);
}
</script>
<style scoped>
.watermark-controls {
  display: grid;
  gap: 14px;
}
.watermark-controls label {
  display: grid;
  gap: 8px;
}
.watermark-upload {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-height: 125px;
  padding: 16px;
  border: 1px dashed var(--border-color, #cbd5e1);
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
}
.watermark-upload:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.watermark-upload img {
  max-width: 160px;
  max-height: 72px;
  background: repeating-conic-gradient(#e2e8f0 0% 25%, white 0% 50%) 50% / 12px 12px;
}
.watermark-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  min-width: 0;
}
.watermark-fields > * {
  min-width: 0;
}
.watermark-positions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.watermark-frame {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  justify-content: space-between;
  gap: 8px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
}
.watermark-frame.selected {
  border-color: #2563eb;
}
small {
  line-height: 1.6;
  color: var(--text-secondary, #64748b);
}
[role="alert"] {
  color: #dc2626;
  margin: 0;
}
</style>
