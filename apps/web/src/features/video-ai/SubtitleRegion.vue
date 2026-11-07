<template>
  <div
    ref="element"
    class="subtitle-rect manual saved"
    :class="{ selected, editable }"
    :style="style"
    :tabindex="editable ? 0 : undefined"
    :role="editable ? 'button' : undefined"
    :aria-label="`字幕框 ${label}`"
    @focus="$emit('select')"
    @pointerdown.stop="begin($event, 'move')"
    @pointermove.stop="move"
    @pointerup.stop="finish"
    @pointercancel.stop="cancel"
    @lostpointercapture="finish"
    @keydown="keydown"
  >
    <span class="region-number">{{ label }}</span>
    <template v-if="editable && selected">
      <button
        v-for="handle in handles"
        :key="handle"
        type="button"
        class="region-handle"
        :class="handle"
        :aria-label="`调整字幕框 ${label} ${handle}`"
        @pointerdown.stop="begin($event, handle)"
        @keydown="keydown"
      />
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import type { VideoAiRect } from "@toolbox/shared";
const props = defineProps<{
  rect: VideoAiRect;
  label: number;
  selected: boolean;
  editable: boolean;
  surfaceWidth: number;
  surfaceHeight: number;
}>();
const emit = defineEmits<{ select: []; update: [rect: VideoAiRect]; remove: [] }>();
const handles = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
const element = ref<HTMLElement>();
const style = computed(() => ({
  left: `${props.rect.x * 100}%`,
  top: `${props.rect.y * 100}%`,
  width: `${props.rect.width * 100}%`,
  height: `${props.rect.height * 100}%`
}));
let drag:
  | {
      kind: "move" | (typeof handles)[number];
      x: number;
      y: number;
      pointer: number;
      rect: VideoAiRect;
      width: number;
      height: number;
    }
  | undefined;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function begin(event: PointerEvent, kind: "move" | (typeof handles)[number]) {
  if (!props.editable || event.button !== 0 || !element.value) return;
  emit("select");
  element.value.focus({ preventScroll: true });
  drag = {
    kind,
    x: event.clientX,
    y: event.clientY,
    pointer: event.pointerId,
    rect: { ...props.rect },
    width: props.surfaceWidth,
    height: props.surfaceHeight
  };
  element.value.setPointerCapture(event.pointerId);
  event.preventDefault();
}
function move(event: PointerEvent) {
  if (!drag || !props.editable || event.pointerId !== drag.pointer) return;
  const original = drag.rect;
  const dx = (event.clientX - drag.x) / Math.max(1, drag.width),
    dy = (event.clientY - drag.y) / Math.max(1, drag.height);
  if (drag.kind === "move") {
    emit("update", {
      ...original,
      x: clamp(original.x + dx, 0, 1 - original.width),
      y: clamp(original.y + dy, 0, 1 - original.height)
    });
    return;
  }
  let left = original.x,
    top = original.y,
    right = original.x + original.width,
    bottom = original.y + original.height;
  const minWidth = Math.min(original.width, 2 / Math.max(1, drag.width)),
    minHeight = Math.min(original.height, 2 / Math.max(1, drag.height));
  if (drag.kind.includes("w")) left = clamp(left + dx, 0, right - minWidth);
  if (drag.kind.includes("e")) right = clamp(right + dx, left + minWidth, 1);
  if (drag.kind.includes("n")) top = clamp(top + dy, 0, bottom - minHeight);
  if (drag.kind.includes("s")) bottom = clamp(bottom + dy, top + minHeight, 1);
  emit("update", { x: left, y: top, width: right - left, height: bottom - top });
}
function finish() {
  const id = drag?.pointer;
  drag = undefined;
  if (id !== undefined && element.value?.hasPointerCapture(id)) element.value.releasePointerCapture(id);
}
function cancel() {
  if (drag && props.editable) emit("update", drag.rect);
  finish();
}
function keydown(event: KeyboardEvent) {
  if (
    !props.editable ||
    !props.selected ||
    (event.target !== element.value && !(event.target instanceof HTMLButtonElement))
  )
    return;
  if (event.key !== "Backspace" && event.key !== "Delete") return;
  event.preventDefault();
  event.stopPropagation();
  finish();
  emit("remove");
}
</script>
<style scoped>
.subtitle-rect {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  pointer-events: none;
}
.subtitle-rect.editable {
  pointer-events: auto;
  cursor: move;
  touch-action: none;
  z-index: 2;
}
.subtitle-rect.selected {
  border-color: var(--color-primary-600);
  z-index: 3;
  outline: none;
}
.region-number {
  color: white;
  background: var(--color-warning);
  padding: 1px 5px;
  font-size: 11px;
}
.selected .region-number {
  background: var(--color-primary-600);
}
.region-handle {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 1px solid var(--color-primary-600);
  padding: 0;
  background: var(--color-surface);
  transform: translate(-50%, -50%);
}
.n {
  left: 50%;
  top: 0;
  cursor: ns-resize;
}
.ne {
  left: 100%;
  top: 0;
  cursor: nesw-resize;
}
.e {
  left: 100%;
  top: 50%;
  cursor: ew-resize;
}
.se {
  left: 100%;
  top: 100%;
  cursor: nwse-resize;
}
.s {
  left: 50%;
  top: 100%;
  cursor: ns-resize;
}
.sw {
  left: 0;
  top: 100%;
  cursor: nesw-resize;
}
.w {
  left: 0;
  top: 50%;
  cursor: ew-resize;
}
.nw {
  left: 0;
  top: 0;
  cursor: nwse-resize;
}
</style>
