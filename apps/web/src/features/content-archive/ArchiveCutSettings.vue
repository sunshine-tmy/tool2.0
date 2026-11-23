<template>
  <section class="cut-settings editor-properties">
    <div class="property-tabs" role="tablist" :aria-label="music ? '音频属性类型' : '视频属性类型'">
      <n-button
        v-for="entry in propertyTabs"
        :key="entry.value"
        quaternary
        :type="activeTab === entry.value ? 'primary' : 'default'"
        role="tab"
        :aria-selected="activeTab === entry.value"
        @click="activeTab = entry.value"
        >{{ entry.label }}</n-button
      >
    </div>
    <template v-if="clip">
      <details v-show="activeTab === 'speed'" open>
        <summary>变速</summary>
        <div class="property-row">
          <span>倍数</span>
          <div ref="speedSliderHost" class="speed-slider-host" @pointerdown.capture="speedSnap = undefined">
            <n-slider
              class="speed-slider"
              :format-tooltip="speedTooltip"
              :value="speedPosition(clip.speed ?? 1)"
              :min="0"
              :max="5"
              :step="0.00001"
              :marks="speedMarks"
              :aria-valuetext="`${editorNumber(clip.speed ?? 1, 2).toFixed(2)}×`"
              :disabled="disabled"
              aria-label="播放倍数"
              @keydown.capture="speedKeydown"
              @update:value="updateSpeedPosition"
            />
          </div>
          <n-input-number
            :value="editorNumber(clip.speed ?? 1, 2)"
            :min="0.1"
            :max="100"
            :step="0.01"
            :precision="2"
            :disabled="disabled"
            @update:value="(value) => value !== null && setClip({ speed: value })"
            ><template #suffix>×</template></n-input-number
          >
        </div>
        <div class="duration-row">
          <span>时长</span><span>{{ (clip.end - clip.start).toFixed(2) }}s</span><span class="duration-arrow">→</span
          ><n-input-number
            :value="editorNumber(archiveClipDuration(clip), 2)"
            :min="(clip.end - clip.start) / 100"
            :max="(clip.end - clip.start) / 0.1"
            :step="0.1"
            :precision="2"
            :disabled="disabled"
            @update:value="
              (value) =>
                value !== null &&
                value > 0 &&
                setClip({ speed: Math.min(100, Math.max(0.1, (clip!.end - clip!.start) / value)) })
            "
            ><template #suffix>s</template></n-input-number
          >
        </div>
      </details>
      <details v-show="activeTab === 'audio'" open>
        <summary class="property-summary">
          基础声音<n-button
            quaternary
            size="tiny"
            title="重置声音"
            :disabled="disabled"
            @click.stop="setClip({ volume: 100, fadeIn: 0, fadeOut: 0 })"
            ><RotateCcw :size="14"
          /></n-button>
        </summary>
        <div class="property-row">
          <span>音量</span>
          <div ref="volumeHost" class="volume-slider-host" @pointerdown.capture="resetVolumeSnap">
            <n-slider
              :format-tooltip="volumeTip"
              :marks="VOLUME_MARKS"
              :value="decibels"
              :min="-61"
              :max="20"
              :step="0.1"
              :disabled="disabled"
              aria-label="片段音量分贝"
              @update:value="updateVolume"
            />
          </div>
          <n-input-number
            :format="formatVolume"
            :parse="parseVolume"
            :value="decibels"
            :min="-61"
            :max="20"
            :step="0.1"
            :precision="1"
            :disabled="disabled"
            @update:value="(value) => value !== null && setDb(value)"
            ><template #suffix>dB</template></n-input-number
          >
        </div>
        <div v-for="field in fades" :key="field.key" class="property-row">
          <span>{{ field.label }}</span
          ><n-slider
            :format-tooltip="editorTooltip(1)"
            :value="editorNumber(clip[field.key] ?? 0, 1)"
            :min="0"
            :max="fadeMax"
            :step="0.1"
            :disabled="disabled"
            :aria-label="field.label"
            @update:value="setClip({ [field.key]: $event })"
          /><n-input-number
            :value="editorNumber(clip[field.key] ?? 0, 1)"
            :min="0"
            :max="fadeMax"
            :step="0.1"
            :precision="1"
            :disabled="disabled"
            @update:value="(value) => value !== null && setClip({ [field.key]: value })"
            ><template #suffix>s</template></n-input-number
          >
        </div>
      </details>
    </template>
    <p v-else class="empty">选择单个片段调整变速、声音与画面。</p>
    <details v-if="!music" v-show="activeTab === 'picture'" open>
      <summary class="property-summary">
        位置大小<n-button
          quaternary
          size="tiny"
          title="重置位置大小"
          :disabled="disabled"
          @click.stop="
            setFrame({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, angle: 0, cornerRadius: 0, linkedScale: true })
          "
          ><RotateCcw :size="14"
        /></n-button>
      </summary>
      <div class="property-row">
        <span>缩放</span
        ><n-slider
          :format-tooltip="editorTooltip(0)"
          :value="editorNumber((visual.scaleX ?? 1) * 100)"
          :min="1"
          :max="500"
          :step="1"
          :disabled="disabled"
          aria-label="画面缩放"
          @update:value="scale($event)"
        /><n-input-number
          :precision="0"
          :value="editorNumber((visual.scaleX ?? 1) * 100)"
          :min="1"
          :max="500"
          :disabled="disabled"
          @update:value="(value) => value !== null && scale(value)"
          ><template #suffix>%</template></n-input-number
        >
      </div>
      <label class="switch-row"
        >等比缩放<n-switch
          :value="visual.linkedScale !== false"
          :disabled="disabled"
          @update:value="setFrame({ linkedScale: $event, ...($event ? { scaleY: visual.scaleX ?? 1 } : {}) })"
      /></label>
      <div v-if="visual.linkedScale === false" class="property-row">
        <span>纵向缩放</span
        ><n-slider
          :step="1"
          :format-tooltip="editorTooltip(0)"
          :value="editorNumber((visual.scaleY ?? 1) * 100)"
          :min="1"
          :max="500"
          :disabled="disabled"
          aria-label="纵向缩放"
          @update:value="setFrame({ scaleY: editorNumber($event) / 100 })"
        /><n-input-number
          :precision="0"
          :value="editorNumber((visual.scaleY ?? 1) * 100)"
          :min="1"
          :max="500"
          :disabled="disabled"
          @update:value="(value) => value !== null && setFrame({ scaleY: editorNumber(value) / 100 })"
        />
      </div>
      <div class="position-row">
        <span>位置</span
        ><n-input-number
          :value="editorNumber((visual.offsetX ?? 0) * size.width)"
          :min="-size.width * 10"
          :max="size.width * 10"
          :precision="0"
          :disabled="disabled"
          @update:value="(value) => value !== null && setFrame({ offsetX: Math.round(value) / size.width })"
          ><template #prefix>X</template></n-input-number
        ><n-input-number
          :value="editorNumber((visual.offsetY ?? 0) * size.height)"
          :min="-size.height * 10"
          :max="size.height * 10"
          :precision="0"
          :disabled="disabled"
          @update:value="(value) => value !== null && setFrame({ offsetY: Math.round(value) / size.height })"
          ><template #prefix>Y</template></n-input-number
        >
      </div>
      <div class="property-row">
        <span>旋转</span
        ><n-slider
          :format-tooltip="editorTooltip(1)"
          :value="editorNumber(visual.angle ?? 0, 1)"
          :min="-180"
          :max="180"
          :step="0.5"
          :disabled="disabled"
          aria-label="画面旋转"
          @update:value="setFrame({ angle: Math.round($event * 10) / 10 })"
        /><n-input-number
          :value="editorNumber(visual.angle ?? 0, 1)"
          :min="-180"
          :max="180"
          :step="0.5"
          :precision="1"
          :disabled="disabled"
          @update:value="(value) => value !== null && setFrame({ angle: Math.round(value * 10) / 10 })"
          ><template #suffix>°</template></n-input-number
        >
      </div>
      <div class="property-row">
        <span>圆角</span
        ><n-slider
          :format-tooltip="editorTooltip(0)"
          :value="Math.round((visual.cornerRadius ?? 0) * 200)"
          :min="0"
          :max="100"
          :step="1"
          :disabled="disabled"
          aria-label="画面圆角"
          @update:value="setFrame({ cornerRadius: Math.round($event) / 200 })"
        /><n-input-number
          :value="Math.round((visual.cornerRadius ?? 0) * 200)"
          :min="0"
          :max="100"
          :precision="0"
          :step="1"
          :disabled="disabled"
          @update:value="(value) => value !== null && setFrame({ cornerRadius: Math.round(value) / 200 })"
        ></n-input-number>
      </div>
      <div class="align-actions">
        <n-button
          v-for="entry in alignment"
          :key="entry.label"
          quaternary
          size="small"
          :title="entry.label"
          :aria-label="entry.label"
          :disabled="disabled"
          @click="align(entry.axis, entry.value)"
          ><component :is="entry.icon" :size="17"
        /></n-button>
      </div>
    </details>
  </section>
</template>
<script setup lang="ts">
import { useEditorVolumeSnap } from "./useEditorVolumeSnap";
import {
  VOLUME_MARKS,
  volumeDb,
  volumePercent,
  formatVolume,
  parseVolume,
  editorNumber,
  editorTooltip
} from "./editor-numbers";
import { computed, ref, watch } from "vue";
import { NButton, NInputNumber, NSlider, NSwitch } from "naive-ui";
import {
  RotateCcw,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal
} from "lucide-vue-next";
import {
  archiveClipDuration,
  archiveFrameGeometry,
  type ArchiveFrame,
  type ArchiveCutClip,
  type ArchiveStudioMusic
} from "@toolbox/shared/archive";
const props = defineProps<{
  music?: ArchiveStudioMusic;
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
  clip: [string, Partial<ArchiveCutClip>];
  music: [string, Partial<ArchiveStudioMusic>];
  frame: [ArchiveFrame];
}>();
const activeTab = ref<"picture" | "audio" | "speed">(props.music ? "audio" : "picture");
watch(
  () => Boolean(props.music),
  (isMusic) => {
    activeTab.value = isMusic ? "audio" : "picture";
  }
);
const propertyTabs = computed(() =>
  props.selected.length > 1 && props.clips.some((clip) => props.selected.includes(clip.id))
    ? [{ label: "变速", value: "speed" as const }]
    : props.music
      ? [
          { label: "基础", value: "audio" as const },
          { label: "变速", value: "speed" as const }
        ]
      : [
          { label: "画面", value: "picture" as const },
          { label: "音频", value: "audio" as const },
          { label: "变速", value: "speed" as const }
        ]
);
watch(
  () => props.selected.length,
  (count) => {
    if (count > 1) activeTab.value = "speed";
  },
  { immediate: true }
);
// 音频用其保留的源区间映射到相同的声音/变速控件，项目起止时间仍由时间线管理。
const clip = computed<ArchiveCutClip | undefined>(() => {
  const music = props.music;
  if (music)
    return {
      id: music.id,
      start: music.sourceStart,
      end: music.sourceStart + (music.end - music.start) * (music.speed ?? 1),
      speed: music.speed ?? 1,
      volume: music.volume,
      fadeIn: music.fadeIn,
      fadeOut: music.fadeOut
    };
  return props.selected.length === 1 ? props.clips.find((entry) => entry.id === props.selected[0]) : undefined;
});
const visual = computed(() => ({ ...props.frame, ...clip.value?.transform }));
const size = computed(() => archiveFrameGeometry(props.sourceWidth || 2, props.sourceHeight || 2, props.frame));
// 五段等宽轨道分别映射不同倍率区间，输出始终量化到 0.01×。
const speedPoints = [0.1, 1, 2, 5, 10, 100];
const speedMarks = { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "" };
const speedSliderHost = ref<HTMLElement>();
const speedSnap = ref<number>();
function snappedSpeedPosition(position: number) {
  const width = Math.max(1, speedSliderHost.value?.clientWidth ?? 300);
  const acquire = Math.min(0.15, (6 / width) * 5),
    release = Math.min(0.22, (10 / width) * 5);
  if (speedSnap.value !== undefined && Math.abs(position - speedSnap.value) <= release) return speedSnap.value;
  const nearest = Math.max(0, Math.min(5, Math.round(position)));
  return Math.abs(position - nearest) <= acquire ? nearest : position;
}
function updateSpeedPosition(position: number) {
  const snapped = snappedSpeedPosition(position);
  speedSnap.value = Number.isInteger(snapped) ? snapped : undefined;
  setClip({ speed: positionSpeed(snapped) });
}
function positionSpeed(position: number) {
  const clamped = Math.max(0, Math.min(5, position)),
    index = Math.min(4, Math.floor(clamped));
  return editorNumber(speedPoints[index] + (speedPoints[index + 1] - speedPoints[index]) * (clamped - index), 2);
}
function speedPosition(speed: number) {
  const value = Math.max(0.1, Math.min(100, speed));
  const index = Math.min(
    4,
    speedPoints.findIndex((point, i) => i < 5 && value <= speedPoints[i + 1])
  );
  return index + (value - speedPoints[index]) / (speedPoints[index + 1] - speedPoints[index]);
}
const speedTooltip = (position: number) => `${positionSpeed(snappedSpeedPosition(position)).toFixed(2)}×`;
function speedKeydown(event: KeyboardEvent) {
  if (props.disabled || !clip.value) return;
  const delta: Record<string, number> = {
    ArrowLeft: -0.01,
    ArrowDown: -0.01,
    ArrowRight: 0.01,
    ArrowUp: 0.01,
    PageDown: -1,
    PageUp: 1
  };
  if (!(event.key in delta) && event.key !== "Home" && event.key !== "End") return;
  event.preventDefault();
  event.stopPropagation();
  speedSnap.value = undefined;
  const value = event.key === "Home" ? 0.1 : event.key === "End" ? 100 : (clip.value.speed ?? 1) + delta[event.key];
  setClip({ speed: editorNumber(Math.max(0.1, Math.min(100, value)), 2) });
}
const decibels = computed(() => volumeDb(clip.value?.volume ?? 100));
const fadeMax = 10;
const fades = [
  { key: "fadeIn" as const, label: "淡入时长" },
  { key: "fadeOut" as const, label: "淡出时长" }
];
function setClip(changes: Partial<ArchiveCutClip>) {
  if (changes.speed !== undefined) changes.speed = editorNumber(changes.speed, 6);
  if (changes.fadeIn !== undefined) changes.fadeIn = editorNumber(changes.fadeIn, 1);
  if (changes.fadeOut !== undefined) changes.fadeOut = editorNumber(changes.fadeOut, 1);
  if (props.disabled || !clip.value) return;
  if (props.music) {
    const update: Partial<ArchiveStudioMusic> = {};
    for (const key of ["speed", "volume", "fadeIn", "fadeOut"] as const)
      if (changes[key] !== undefined) update[key] = changes[key];
    if (changes.speed !== undefined)
      update.end =
        props.music.start + ((props.music.end - props.music.start) * (props.music.speed ?? 1)) / changes.speed;
    emit("music", props.music.id, update);
  } else emit("clip", clip.value.id, changes);
}
const {
  host: volumeHost,
  update: updateVolume,
  reset: resetVolumeSnap,
  tooltip: volumeTip
} = useEditorVolumeSnap(setDb);
function setDb(value: number) {
  if (value < -60) value = decibels.value <= -61 && value > -61 ? -60 : -61;
  setClip({ volume: volumePercent(value) });
}
function setFrame(changes: Partial<ArchiveFrame>) {
  if (props.music) return;
  if (props.disabled) return;
  if (changes.offsetX !== undefined)
    changes.offsetX = Math.round(changes.offsetX * size.value.width) / size.value.width;
  if (changes.offsetY !== undefined)
    changes.offsetY = Math.round(changes.offsetY * size.value.height) / size.value.height;
  if (clip.value) emit("clip", clip.value.id, { transform: { ...clip.value.transform, ...changes } });
  else emit("frame", { ...props.frame, ...changes });
}
function scale(value: number) {
  const percent = Math.max(1, Math.min(500, editorNumber(value)));
  setFrame({ scaleX: percent / 100, ...(visual.value.linkedScale !== false ? { scaleY: percent / 100 } : {}) });
}
const alignment = [
  { label: "左对齐", axis: "x" as const, value: -1, icon: AlignStartVertical },
  { label: "水平居中", axis: "x" as const, value: 0, icon: AlignCenterVertical },
  { label: "右对齐", axis: "x" as const, value: 1, icon: AlignEndVertical },
  { label: "顶部对齐", axis: "y" as const, value: -1, icon: AlignStartHorizontal },
  { label: "垂直居中", axis: "y" as const, value: 0, icon: AlignCenterHorizontal },
  { label: "底部对齐", axis: "y" as const, value: 1, icon: AlignEndHorizontal }
];
function align(axis: "x" | "y", value: number) {
  const angle = ((visual.value.angle ?? 0) * Math.PI) / 180,
    w = size.value.contentWidth * (visual.value.scaleX ?? 1),
    h = size.value.contentHeight * (visual.value.scaleY ?? 1),
    extent =
      axis === "x"
        ? Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))
        : Math.abs(h * Math.cos(angle)) + Math.abs(w * Math.sin(angle)),
    full = axis === "x" ? size.value.width : size.value.height;
  setFrame({
    [axis === "x" ? "offsetX" : "offsetY"]: Math.max(-10, Math.min(10, (value * (full - extent)) / 2 / full))
  });
}
</script>
<style scoped src="./editor-properties.css"></style>
<style scoped>
.volume-slider-host {
  display: flex;
  align-items: center;
  min-width: 0;
}
.volume-slider-host :deep(.n-slider--with-mark) {
  margin: 0;
}
.speed-slider-host {
  min-width: 0;
  display: flex;
  align-items: center;
}
.speed-slider-host :deep(.n-slider--with-mark) {
  margin: 0;
}
.speed-slider-host :deep(.n-slider-marks) {
  display: none;
}

.duration-row {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  margin: 14px 0;
}
.duration-row :deep(.n-input-number) {
  --editor-number-width: 144px;
  width: 144px;
  flex-shrink: 0;
}
.duration-row {
  display: grid;
  grid-template-columns: auto minmax(52px, auto) minmax(12px, 1fr) 144px;
}
.duration-arrow {
  flex: 1;
  border-bottom: 1px dashed var(--color-border);
  text-align: right;
  color: var(--color-text-secondary);
}
.empty {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.duration-arrow {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 20px;
  border-bottom: 0;
}
.duration-arrow::before {
  content: "";
  position: absolute;
  left: 0;
  right: 14px;
  top: 50%;
  border-top: 1px dashed var(--color-border);
}
</style>
