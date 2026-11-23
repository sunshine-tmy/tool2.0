<template>
  <section class="editor-properties text-settings" aria-label="文本属性">
    <div class="property-tabs" role="tablist" aria-label="文本属性类型">
      <n-button
        id="archive-text-tab"
        quaternary
        type="primary"
        role="tab"
        aria-selected="true"
        aria-controls="archive-text-panel"
        >文本</n-button
      >
    </div>
    <div id="archive-text-panel" class="text-sections" role="tabpanel" aria-labelledby="archive-text-tab">
      <div class="text-subtabs" role="tablist" aria-label="文本样式分类">
        <n-button
          v-for="entry in textSections"
          :id="`archive-text-${entry.id}-tab`"
          :key="entry.id"
          quaternary
          size="small"
          role="tab"
          :aria-selected="textSection === entry.id"
          :aria-controls="`archive-text-${entry.id}-panel`"
          :type="textSection === entry.id ? 'primary' : 'default'"
          @click="textSection = entry.id"
          >{{ entry.label }}</n-button
        >
      </div>
      <div
        v-show="textSection === 'basic'"
        id="archive-text-basic-panel"
        class="text-sections"
        role="tabpanel"
        aria-labelledby="archive-text-basic-tab"
      >
        <div class="text-basic" aria-label="文字基础">
          <n-input
            :value="text"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            maxlength="2000"
            show-count
            aria-label="文本内容"
            placeholder="输入文本内容"
            :disabled="disabled"
            @update:value="editText"
            @blur="restoreEmptyText"
          />
          <div class="text-field">
            <span>字体</span
            ><n-select
              :value="cue.fontFamily ?? 'Arial'"
              :options="fonts"
              filterable
              :disabled="disabled"
              aria-label="字体"
              @update:value="set({ fontFamily: $event })"
            />
          </div>
          <div class="property-row">
            <span>字号</span
            ><n-slider
              :value="cue.fontSize"
              :min="1"
              :max="200"
              :step="1"
              :format-tooltip="editorTooltip(0)"
              :disabled="disabled"
              aria-label="字号"
              @update:value="set({ fontSize: $event })"
            />
            <n-input-number
              :value="cue.fontSize"
              :min="1"
              :max="200"
              :precision="0"
              :step="1"
              :disabled="disabled"
              aria-label="字号数值"
              @update:value="(value) => value !== null && set({ fontSize: value })"
            />
          </div>
          <div class="text-field">
            <span>样式</span>
            <div class="style-actions">
              <n-button
                v-for="entry in styles"
                :key="entry.key"
                quaternary
                :type="cue[entry.key] ? 'primary' : 'default'"
                :aria-pressed="!!cue[entry.key]"
                :title="entry.label"
                :aria-label="entry.label"
                :disabled="disabled"
                @click="set({ [entry.key]: !cue[entry.key] })"
                ><component :is="entry.icon" :size="17"
              /></n-button>
            </div>
          </div>
          <div class="text-field">
            <label for="archive-text-color">颜色</label
            ><input
              id="archive-text-color"
              type="color"
              :value="cue.color"
              :disabled="disabled"
              @input="set({ color: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div class="spacing-fields">
            <label
              >字间距<n-input-number
                :value="cue.letterSpacing ?? 0"
                :min="-10"
                :max="50"
                :precision="0"
                :step="1"
                :disabled="disabled"
                @update:value="(value) => value !== null && set({ letterSpacing: value })"
            /></label>
            <label
              >行间距<n-input-number
                :value="cue.lineSpacing ?? 0"
                :min="0"
                :max="100"
                :precision="0"
                :step="1"
                :disabled="disabled"
                @update:value="(value) => value !== null && set({ lineSpacing: value })"
            /></label>
          </div>
          <div class="text-field">
            <span>对齐方式</span>
            <div class="style-actions">
              <n-button
                v-for="entry in textAlignments"
                :key="entry.value"
                quaternary
                size="small"
                :type="(cue.textAlign ?? 'center') === entry.value ? 'primary' : 'default'"
                :aria-pressed="(cue.textAlign ?? 'center') === entry.value"
                :title="entry.label"
                :aria-label="entry.label"
                :disabled="disabled"
                @click="set({ textAlign: entry.value })"
              >
                <component :is="entry.icon" :size="17"
              /></n-button>
            </div>
          </div>
        </div>
        <details open class="preset-section">
          <summary>预设样式</summary>
          <div class="text-presets" aria-label="文字预设样式">
            <button
              v-for="preset in archiveTextPresets"
              :key="preset.id"
              type="button"
              class="text-preset"
              :aria-label="preset.label"
              :title="preset.label"
              :aria-pressed="activePreset === preset.id"
              :disabled="disabled"
              @click="applyPreset(preset.style)"
            >
              <CircleSlash v-if="preset.id === 'none'" :size="23" aria-hidden="true" />
              <span v-else :style="archiveTextPresetPreview(preset.style)" aria-hidden="true">T</span>
            </button>
          </div>
        </details>
        <details open>
          <summary class="property-summary">
            位置大小<n-button
              quaternary
              size="tiny"
              title="重置位置大小"
              aria-label="重置位置大小"
              :disabled="disabled"
              @click.stop="set({ scale: 1, scaleX: 1, scaleY: 1, linkedScale: true, x: 0.5, y: 0.5, rotation: 0 })"
              ><RotateCcw :size="14"
            /></n-button>
          </summary>
          <div class="property-row">
            <span>缩放</span
            ><n-slider
              :value="scaleX"
              :min="1"
              :max="500"
              :step="1"
              :format-tooltip="editorTooltip(0)"
              :disabled="disabled"
              aria-label="文本缩放"
              @update:value="scale($event)"
            />
            <n-input-number
              :value="scaleX"
              :min="1"
              :max="500"
              :precision="0"
              :step="1"
              :disabled="disabled"
              aria-label="文本缩放数值"
              @update:value="(value) => value !== null && scale(value)"
              ><template #suffix>%</template></n-input-number
            >
          </div>
          <label class="switch-row"
            >等比缩放<n-switch
              :value="linked"
              :disabled="disabled"
              aria-label="文本等比缩放"
              @update:value="
                (value) =>
                  set({
                    linkedScale: value,
                    ...(value ? { scale: 1, scaleX: scaleX / 100, scaleY: scaleX / 100 } : {})
                  })
              "
          /></label>
          <div v-if="!linked" class="property-row">
            <span>纵向缩放</span
            ><n-slider
              :value="scaleY"
              :min="1"
              :max="500"
              :step="1"
              :format-tooltip="editorTooltip(0)"
              :disabled="disabled"
              aria-label="文本纵向缩放"
              @update:value="scale($event, true)"
            />
            <n-input-number
              :value="scaleY"
              :min="1"
              :max="500"
              :precision="0"
              :step="1"
              :disabled="disabled"
              aria-label="文本纵向缩放数值"
              @update:value="(value) => value !== null && scale(value, true)"
              ><template #suffix>%</template></n-input-number
            >
          </div>
          <div class="position-row">
            <span>位置</span>
            <n-input-number
              :value="position.x"
              :min="-width * 10"
              :max="width * 10"
              :precision="0"
              :step="1"
              :disabled="disabled"
              aria-label="文本位置 X"
              @update:value="(value) => value !== null && setPosition('x', value)"
              ><template #prefix>X</template></n-input-number
            >
            <n-input-number
              :value="position.y"
              :min="-height * 10"
              :max="height * 10"
              :precision="0"
              :step="1"
              :disabled="disabled"
              aria-label="文本位置 Y"
              @update:value="(value) => value !== null && setPosition('y', value)"
              ><template #prefix>Y</template></n-input-number
            >
          </div>
          <div class="property-row">
            <span>旋转</span
            ><n-slider
              :value="rotation"
              :min="-180"
              :max="180"
              :step="0.5"
              :format-tooltip="editorTooltip(1)"
              :disabled="disabled"
              aria-label="文本旋转"
              @update:value="rotate($event)"
            />
            <n-input-number
              :value="rotation"
              :min="-180"
              :max="180"
              :step="0.5"
              :precision="1"
              :disabled="disabled"
              aria-label="文本旋转数值"
              @update:value="(value) => value !== null && rotate(value)"
              ><template #suffix>°</template></n-input-number
            >
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
        <details open>
          <summary class="property-summary">
            混合<n-button
              quaternary
              size="tiny"
              title="重置混合"
              aria-label="重置混合"
              :disabled="disabled"
              @click.stop="set({ opacity: 1 })"
              ><RotateCcw :size="14"
            /></n-button>
          </summary>
          <div class="property-row">
            <span>不透明度</span
            ><n-slider
              :value="opacity"
              :min="0"
              :max="100"
              :step="1"
              :format-tooltip="editorTooltip(0)"
              :disabled="disabled"
              aria-label="文本不透明度"
              @update:value="set({ opacity: $event / 100 })"
            />
            <n-input-number
              :value="opacity"
              :min="0"
              :max="100"
              :step="1"
              :precision="0"
              :disabled="disabled"
              aria-label="文本不透明度数值"
              @update:value="(value) => value !== null && set({ opacity: value / 100 })"
              ><template #suffix>%</template></n-input-number
            >
          </div>
        </details>
      </div>
      <div
        v-show="textSection === 'fancy'"
        id="archive-text-fancy-panel"
        role="tabpanel"
        aria-labelledby="archive-text-fancy-tab"
      >
        <ArchiveFancyTextPanel :active="cue.decoration" :disabled="disabled" @apply="applyFancyText" />
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NInput, NInputNumber, NSelect, NSlider, NSwitch } from "naive-ui";
import {
  Bold,
  Italic,
  Underline,
  CircleSlash,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  RotateCcw
} from "lucide-vue-next";
import {
  archiveFancyTextStyle,
  archiveTextAppearance,
  type ArchiveSubtitle,
  type ArchiveTextAppearance
} from "@toolbox/shared/archive";
import ArchiveFancyTextPanel from "./ArchiveFancyTextPanel.vue";
import { editorNumber, editorTooltip } from "./editor-numbers";
import { subtitleBounds } from "./subtitle-interaction";
import { archiveTextPresets, activeArchiveTextPreset, archiveTextPresetPreview } from "./text-presets";
const props = defineProps<{ cue: ArchiveSubtitle; width: number; height: number; disabled: boolean }>();
const emit = defineEmits<{ update: [string, Partial<ArchiveSubtitle>, discrete?: boolean] }>();
const text = ref(props.cue.text);
const textSection = ref("basic");
const textSections = [
  { id: "basic", label: "基础" },
  { id: "fancy", label: "花字" }
];
const activePreset = computed(() => activeArchiveTextPreset(props.cue));
watch([() => props.cue.id, () => props.cue.text], () => {
  text.value = props.cue.text;
});
const fonts = [
  { label: "系统（默认）", value: "Arial" },
  { label: "微软雅黑", value: "Microsoft YaHei" },
  { label: "苹方", value: "PingFang SC" },
  { label: "黑体", value: "SimHei" },
  { label: "宋体", value: "SimSun" },
  { label: "华文宋体", value: "Songti SC" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Courier New", value: "Courier New" }
];
const styles = [
  { key: "bold", label: "加粗", icon: Bold },
  { key: "underline", label: "下划线", icon: Underline },
  { key: "italic", label: "斜体", icon: Italic }
] as const;
const textAlignments = [
  { value: "left", label: "文字左对齐", icon: AlignLeft },
  { value: "center", label: "文字居中", icon: AlignCenter },
  { value: "right", label: "文字右对齐", icon: AlignRight },
  { value: "vertical-top", label: "竖排顶部对齐", icon: AlignStartHorizontal },
  { value: "vertical-center", label: "竖排居中", icon: AlignCenterHorizontal },
  { value: "vertical-bottom", label: "竖排底部对齐", icon: AlignEndHorizontal }
] as const;
const alignment = [
  { label: "画布左对齐", axis: "x", value: -1, icon: AlignStartVertical },
  { label: "画布水平居中", axis: "x", value: 0, icon: AlignCenterVertical },
  { label: "画布右对齐", axis: "x", value: 1, icon: AlignEndVertical },
  { label: "画布顶部对齐", axis: "y", value: -1, icon: AlignStartHorizontal },
  { label: "画布垂直居中", axis: "y", value: 0, icon: AlignCenterHorizontal },
  { label: "画布底部对齐", axis: "y", value: 1, icon: AlignEndHorizontal }
] as const;
const canvas = document.createElement("canvas");
const bounds = computed(() => {
  const ctx = canvas.getContext("2d");
  return ctx ? subtitleBounds(props.cue, props.width, props.height, ctx) : undefined;
});
const position = computed(() => ({
  x: Math.round((bounds.value?.cx ?? props.width / 2) - props.width / 2),
  y: Math.round((bounds.value?.cy ?? props.height / 2) - props.height / 2)
}));
const scaleX = computed(() => editorNumber((props.cue.scale ?? 1) * (props.cue.scaleX ?? 1) * 100));
const scaleY = computed(() => editorNumber((props.cue.scale ?? 1) * (props.cue.scaleY ?? 1) * 100));
const linked = computed(() => props.cue.linkedScale ?? scaleX.value === scaleY.value);
const opacity = computed(() => editorNumber((props.cue.opacity ?? 1) * 100));
const rotation = computed(() => editorNumber(((((-(props.cue.rotation ?? 0) + 180) % 360) + 360) % 360) - 180, 1));
function set(changes: Partial<ArchiveSubtitle>) {
  if (!props.disabled) emit("update", props.cue.id, changes);
}
function applyPreset(style: ArchiveTextAppearance) {
  if (!props.disabled) emit("update", props.cue.id, { ...style, decoration: "none" }, true);
}
function applyFancyText(id: ArchiveSubtitle["decoration"]) {
  if (props.disabled) return;
  if (id === "none") {
    emit("update", props.cue.id, { decoration: "none" }, true);
    return;
  }
  const style = archiveFancyTextStyle(id);
  if (style)
    emit(
      "update",
      props.cue.id,
      { ...archiveTextAppearance({ outlineWidth: 0 }), color: style.fill, decoration: style.id, bold: true },
      true
    );
}
function editText(value: string) {
  text.value = value;
  if (value.trim()) set({ text: value });
}
function restoreEmptyText() {
  if (!text.value.trim()) text.value = props.cue.text;
}
function scale(value: number, vertical = false) {
  const amount = editorNumber(Math.max(1, Math.min(500, value))) / 100;
  const x = vertical ? Math.min(5, scaleX.value / 100) : amount;
  const y = vertical || linked.value ? amount : Math.min(5, scaleY.value / 100);
  set({ scale: 1, scaleX: x, scaleY: y });
}
function setPosition(axis: "x" | "y", value: number) {
  const width = props.width,
    height = props.height;
  set({
    x: Math.max(-10, Math.min(11, ((axis === "x" ? Math.round(value) : position.value.x) + width / 2) / width)),
    y: Math.max(-10, Math.min(11, ((axis === "y" ? Math.round(value) : position.value.y) + height / 2) / height))
  });
}
function rotate(value: number) {
  set({ rotation: -editorNumber(value, 1) });
}
function align(axis: "x" | "y", value: number) {
  const b = bounds.value;
  if (!b) return;
  const angle = (b.rotation * Math.PI) / 180;
  const w = b.halfW * b.scale * b.scaleX,
    h = b.halfH * b.scale * b.scaleY;
  const extent =
    axis === "x"
      ? Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))
      : Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle));
  const full = axis === "x" ? props.width : props.height;
  setPosition(axis, Math.round(value * (full / 2 - extent)));
}
</script>
<style scoped src="./editor-properties.css"></style>
<style scoped>
.text-subtabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 3px;
  gap: 3px;
  border-radius: 7px;
  background: var(--color-surface-subtle);
}
.text-subtabs :deep(.n-button[aria-selected="true"]) {
  background: var(--color-primary-100, #f0edff);
}
.text-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
  gap: 8px;
}
.text-preset {
  display: grid;
  place-items: center;
  min-width: 0;
  height: 40px;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: #42434a;
  color: #d4d4da;
  cursor: pointer;
}
.text-preset[aria-pressed="true"],
.text-preset:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: -2px;
}
.text-preset:disabled {
  opacity: 0.45;
  cursor: default;
}
.text-preset span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 3px;
  font:
    700 24px Arial,
    sans-serif;
  paint-order: stroke fill;
}
@media (max-width: 600px) {
  .text-presets {
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  }
  .text-preset {
    height: 44px;
  }
}
.text-sections {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.text-basic {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 4px 0;
}
.text-basic .property-row {
  margin: 0;
}
.text-field {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.text-field input[type="color"] {
  width: 70px;
  height: 30px;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
}
.style-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.style-actions :deep(.n-button[aria-pressed="true"]) {
  background: var(--color-primary-100, #f0edff);
}
.spacing-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.spacing-fields label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
</style>
