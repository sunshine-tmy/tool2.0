<template>
  <section class="editor-properties watermark-properties" aria-label="水印属性">
    <div class="property-tabs" role="tablist" aria-label="水印属性类型">
      <n-button
        v-for="entry in tabs"
        :id="`watermark-${mark.id}-${entry.value}-tab`"
        :key="entry.value"
        :aria-controls="`watermark-${mark.id}-${entry.value}-panel`"
        quaternary
        :type="tab === entry.value ? 'primary' : 'default'"
        role="tab"
        :aria-selected="tab === entry.value"
        @click="tab = entry.value"
        >{{ entry.label }}</n-button
      >
    </div>
    <div
      v-if="tab === 'base'"
      :id="`watermark-${mark.id}-base-panel`"
      class="property-section"
      role="tabpanel"
      :aria-labelledby="`watermark-${mark.id}-base-tab`"
    >
      <h4>基础</h4>
      <p class="asset-name" :title="mark.title">{{ mark.title }}</p>
      <div class="property-row">
        <span>不透明度</span
        ><n-slider
          aria-label="水印不透明度"
          :format-tooltip="editorTooltip(0)"
          :value="mark.settings.opacity"
          :min="0"
          :max="100"
          :step="1"
          :disabled="disabled"
          @update:value="setSettings({ ...mark.settings, opacity: $event })"
        /><n-input-number
          aria-label="水印不透明度数值"
          :step="1"
          :value="mark.settings.opacity"
          :min="0"
          :max="100"
          :precision="0"
          :disabled="disabled"
          @update:value="setSettings({ ...mark.settings, opacity: $event ?? 0 })"
          ><template #suffix>%</template></n-input-number
        >
      </div>
      <n-checkbox :checked="mark.followEnd" :disabled="disabled" @update:checked="emit('update', { followEnd: $event })"
        >跟随成片结尾</n-checkbox
      >
      <p class="hint">在时间线中调整显示区间，左侧水印分类可添加其他图片。</p>
    </div>
    <div
      v-else-if="tab === 'position'"
      :id="`watermark-${mark.id}-position-panel`"
      class="property-section"
      role="tabpanel"
      :aria-labelledby="`watermark-${mark.id}-position-tab`"
    >
      <h4>位置大小</h4>
      <div class="property-row">
        <span>横向缩放</span
        ><n-slider
          aria-label="水印横向缩放"
          :format-tooltip="editorTooltip(0)"
          :value="Math.round((mark.scaleX ?? 1) * 100)"
          :min="1"
          :max="500"
          :step="1"
          :disabled="disabled"
          @update:value="emit('update', { scaleX: $event / 100 })"
        /><n-input-number
          aria-label="水印横向缩放数值"
          :step="1"
          :value="Math.round((mark.scaleX ?? 1) * 100)"
          :min="1"
          :max="500"
          :precision="0"
          :disabled="disabled"
          @update:value="emit('update', { scaleX: ($event ?? 100) / 100 })"
          ><template #suffix>%</template></n-input-number
        >
      </div>
      <div class="property-row">
        <span>纵向缩放</span
        ><n-slider
          aria-label="水印纵向缩放"
          :format-tooltip="editorTooltip(0)"
          :value="Math.round((mark.scaleY ?? 1) * 100)"
          :min="1"
          :max="500"
          :step="1"
          :disabled="disabled"
          @update:value="emit('update', { scaleY: $event / 100 })"
        /><n-input-number
          aria-label="水印纵向缩放数值"
          :step="1"
          :value="Math.round((mark.scaleY ?? 1) * 100)"
          :min="1"
          :max="500"
          :precision="0"
          :disabled="disabled"
          @update:value="emit('update', { scaleY: ($event ?? 100) / 100 })"
          ><template #suffix>%</template></n-input-number
        >
      </div>
      <div class="xy-fields">
        <label
          >X<n-input-number
            aria-label="水印 X 位置"
            :value="Math.round(geometry.x - width / 2)"
            :precision="0"
            :step="1"
            :disabled="disabled"
            @update:value="position('x', ($event ?? 0) + width / 2)" /></label
        ><label
          >Y<n-input-number
            aria-label="水印 Y 位置"
            :value="Math.round(geometry.y - height / 2)"
            :precision="0"
            :step="1"
            :disabled="disabled"
            @update:value="position('y', ($event ?? 0) + height / 2)"
        /></label>
      </div>
      <div class="position-row">
        <span>旋转</span
        ><n-input-number
          aria-label="水印旋转角度"
          :value="mark.angle ?? 0"
          :min="-180"
          :max="180"
          :step="0.5"
          :precision="1"
          :disabled="disabled"
          @update:value="emit('update', { angle: $event ?? 0 })"
        />
      </div>
      <div class="align-actions">
        <n-button
          v-for="entry in alignments"
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
    </div>
    <div
      v-else
      :id="`watermark-${mark.id}-motion-panel`"
      class="property-section"
      role="tabpanel"
      :aria-labelledby="`watermark-${mark.id}-motion-tab`"
    >
      <h4>运动</h4>
      <ArchiveWatermarkControls
        track-mode
        :settings="motionSettings"
        :selected-point="selectedPoint"
        :selected-frame="selectedFrame"
        :asset="{ width: mark.asset.width, height: mark.asset.height, url }"
        :disabled="disabled"
        :duration="
          Math.max(
            mark.sourceStart + (mark.motionOffsetSeconds ?? 0) + mark.end - mark.start,
            mark.settings.endSeconds ?? 0,
            ...mark.settings.motion.keyframes.map((point) => point.timeSeconds)
          )
        "
        :time="Math.max(0, time - mark.start + mark.sourceStart + (mark.motionOffsetSeconds ?? 0))"
        @update:settings="setMotionSettings"
        @update:selected-point="selectedPoint = $event"
        @update:selected-frame="selectedFrame = $event"
        @move="movePoint"
        @seek="emit('seek', mark.start + $event - mark.sourceStart - (mark.motionOffsetSeconds ?? 0))"
        @remove="emit('remove')"
      />
    </div>
  </section>
</template>
<script setup lang="ts">
import { editorTooltip } from "./editor-numbers";
import { computed, ref } from "vue";
import { NButton, NSlider, NInputNumber, NCheckbox } from "naive-ui";
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal
} from "lucide-vue-next";
import {
  watermarkTrackGeometry,
  watermarkTrackMotionSettings,
  positionWatermarkTrack,
  type ArchiveStudioWatermark,
  type ArchiveWatermarkSettings
} from "@toolbox/shared/archive";
import ArchiveWatermarkControls from "./ArchiveWatermarkControls.vue";
const props = defineProps<{
  mark: ArchiveStudioWatermark;
  url: string;
  width: number;
  height: number;
  time: number;
  disabled: boolean;
}>();
const emit = defineEmits<{ update: [Partial<ArchiveStudioWatermark>]; seek: [number]; remove: [] }>();
const tab = ref("base"),
  selectedPoint = ref<"from" | "to">("from"),
  selectedFrame = ref(0);
const tabs = [
  { label: "基础", value: "base" },
  { label: "位置大小", value: "position" },
  { label: "运动", value: "motion" }
];
const geometry = computed(() => watermarkTrackGeometry(props.mark, props.time, props.width, props.height));
const motionSettings = computed(() => watermarkTrackMotionSettings(props.mark, props.width, props.height));
const alignments = [
  { label: "左对齐", axis: "x", value: 0, icon: AlignStartVertical },
  { label: "水平居中", axis: "x", value: 0.5, icon: AlignCenterVertical },
  { label: "右对齐", axis: "x", value: 1, icon: AlignEndVertical },
  { label: "顶部对齐", axis: "y", value: 0, icon: AlignStartHorizontal },
  { label: "垂直居中", axis: "y", value: 0.5, icon: AlignCenterHorizontal },
  { label: "底部对齐", axis: "y", value: 1, icon: AlignEndHorizontal }
];
function setSettings(settings: ArchiveWatermarkSettings) {
  if (!props.disabled) emit("update", { settings });
}
function setMotionSettings(settings: ArchiveWatermarkSettings) {
  const bounce = props.mark.settings.motion.type === "bounce" || settings.motion.type === "bounce";
  if (props.mark.settings.motion.type !== "bounce" && settings.motion.type === "bounce")
    settings = watermarkTrackMotionSettings({ ...props.mark, settings }, props.width, props.height);
  if (!props.disabled)
    emit("update", {
      settings,
      ...(bounce ? { offsetX: 0, offsetY: 0 } : {})
    });
}
function position(axis: string, target: number) {
  const g = geometry.value;
  emit(
    "update",
    positionWatermarkTrack(
      props.mark,
      props.time,
      axis === "x" ? target : g.x,
      axis === "y" ? target : g.y,
      props.width,
      props.height
    )
  );
}
function align(axis: string, value: number) {
  const g = geometry.value,
    angle = (g.rotation * Math.PI) / 180;
  const extent =
    axis === "x"
      ? (Math.abs(g.width * Math.cos(angle)) + Math.abs(g.height * Math.sin(angle))) / 2
      : (Math.abs(g.width * Math.sin(angle)) + Math.abs(g.height * Math.cos(angle))) / 2;
  const total = axis === "x" ? props.width : props.height;
  position(axis, extent + (total - extent * 2) * value);
}
function movePoint(point: { x: number; y: number }) {
  const settings = JSON.parse(JSON.stringify(motionSettings.value));
  if (settings.motion.type === "keyframes" && settings.motion.keyframes[selectedFrame.value])
    Object.assign(settings.motion.keyframes[selectedFrame.value], point);
  else settings.motion[selectedPoint.value] = point;
  setMotionSettings(settings);
}
</script>
<style scoped>
@import "./editor-properties.css";
.property-tabs {
  flex-wrap: wrap;
}
.property-section {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.property-section h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.property-section .property-row,
.property-section .position-row {
  margin: 0;
}
.asset-name {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.align-actions :deep(.n-button) {
  min-width: 32px;
  height: 32px;
}
@media (pointer: coarse) {
  .align-actions :deep(.n-button) {
    min-width: 44px;
    height: 44px;
  }
}

.xy-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.xy-fields label {
  min-width: 0;
}
.xy-fields :deep(.n-input-number) {
  width: 126px;
}
.hint {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.align-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
