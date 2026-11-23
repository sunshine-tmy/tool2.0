<template>
  <div class="transform-box" :style="style" aria-label="素材变换框" @pointerdown.stop="start($event, 'move')">
    <button
      v-for="handle in disabled ? [] : handles"
      :key="handle"
      class="transform-handle"
      :class="handle"
      :aria-label="labels[handle]"
      :title="labels[handle]"
      @pointerdown.stop="start($event, handle)"
    ></button>
    <button
      v-if="!disabled"
      class="transform-rotate"
      aria-label="旋转素材"
      title="旋转"
      @pointerdown.stop="start($event, 'rotate')"
    >
      <RotateCw :size="14" />
    </button>
  </div>
</template>
<script setup lang="ts">
import { RotateCw } from "lucide-vue-next";
import { computed, onScopeDispose } from "vue";
export interface TransformDelta {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  angle: number;
}
const props = defineProps<{
  box: { left: number; top: number; width: number; height: number; rotation: number };
  disabled?: boolean;
  scaleX?: number;
  scaleY?: number;
}>();
const emit = defineEmits<{
  start: [operation: "move" | "scale" | "rotate"];
  update: [TransformDelta];
  commit: [TransformDelta];
  cancel: [];
}>();
const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const labels: Record<string, string> = {
  nw: "左上等比缩放",
  ne: "右上等比缩放",
  sw: "左下等比缩放",
  se: "右下等比缩放",
  n: "调整上边",
  s: "调整下边",
  w: "调整左边",
  e: "调整右边"
};
const style = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
  transform: `translate(-50%,-50%) rotate(${props.box.rotation}deg)`
}));
let cleanup: (() => void) | undefined;
function start(event: PointerEvent, handle: string) {
  if (props.disabled || event.button !== 0) return;
  event.preventDefault();
  cleanup?.();
  const box = { ...props.box },
    x = event.clientX,
    y = event.clientY,
    rect = (event.currentTarget as HTMLElement).closest(".transform-box")!.getBoundingClientRect(),
    cx = rect.left + rect.width / 2,
    cy = rect.top + rect.height / 2,
    initial = Math.atan2(y - cy, x - cx),
    radians = (box.rotation * Math.PI) / 180;
  let result: TransformDelta = { dx: 0, dy: 0, sx: 1, sy: 1, angle: 0 };
  const originalX = props.scaleX ?? 1,
    originalY = props.scaleY ?? 1;
  const ratio = (value: number, axis: "x" | "y") =>
    Math.max(
      0.01 / (axis === "x" ? originalX : originalY),
      Math.min(5 / (axis === "x" ? originalX : originalY), value)
    );
  const move = (e: PointerEvent) => {
    const dx = e.clientX - x,
      dy = e.clientY - y;
    result = { dx: 0, dy: 0, sx: 1, sy: 1, angle: 0 };
    if (handle === "move") {
      result.dx = dx;
      result.dy = dy;
    } else if (handle === "rotate")
      result.angle = ((Math.atan2(e.clientY - cy, e.clientX - cx) - initial) * 180) / Math.PI;
    else {
      const lx = dx * Math.cos(radians) + dy * Math.sin(radians),
        ly = -dx * Math.sin(radians) + dy * Math.cos(radians),
        nx = handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0,
        ny = handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0;
      let sx = 1,
        sy = 1;
      if (nx && ny) {
        const factor = 1 + (nx * lx * box.width + ny * ly * box.height) / (box.width ** 2 + box.height ** 2);
        sx = sy = Math.max(0.01 / Math.min(originalX, originalY), Math.min(5 / Math.max(originalX, originalY), factor));
      } else if (nx) sx = ratio(1 + (nx * lx) / Math.max(1, box.width), "x");
      else sy = ratio(1 + (ny * ly) / Math.max(1, box.height), "y");
      const shiftX = (nx * box.width * (sx - 1)) / 2,
        shiftY = (ny * box.height * (sy - 1)) / 2;
      result = {
        dx: shiftX * Math.cos(radians) - shiftY * Math.sin(radians),
        dy: shiftX * Math.sin(radians) + shiftY * Math.cos(radians),
        sx,
        sy,
        angle: 0
      };
    }
    emit("update", result);
  };
  const finish = (e: PointerEvent) => {
    move(e);
    cleanup?.();
    emit("commit", result);
  };
  const cancel = () => {
    cleanup?.();
    emit("cancel");
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };
  cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("keydown", key, true);
    cleanup = undefined;
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("blur", cancel);
  window.addEventListener("keydown", key, true);
  emit("start", handle === "move" ? "move" : handle === "rotate" ? "rotate" : "scale");
}
onScopeDispose(() => cleanup?.());
</script>
<style scoped>
.transform-box {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid #fff;
  box-shadow: 0 0 0 1px #0006;
  z-index: 4;
  cursor: move;
  pointer-events: none;
  touch-action: none;
}
.transform-handle {
  position: absolute;
  pointer-events: auto;
  background: #fff;
  border: 1px solid #777;
  border-radius: 50%;
  width: 9px;
  height: 9px;
  padding: 0;
  transform: translate(-50%, -50%);
  touch-action: none;
}
.nw {
  left: 0;
  top: 0;
  cursor: nwse-resize;
}
.ne {
  left: 100%;
  top: 0;
  cursor: nesw-resize;
}
.sw {
  left: 0;
  top: 100%;
  cursor: nesw-resize;
}
.se {
  left: 100%;
  top: 100%;
  cursor: nwse-resize;
}
.n {
  left: 50%;
  top: 0;
  cursor: ns-resize;
  border-radius: 2px;
  width: 14px;
  height: 5px;
}
.s {
  left: 50%;
  top: 100%;
  cursor: ns-resize;
  border-radius: 2px;
  width: 14px;
  height: 5px;
}
.w {
  left: 0;
  top: 50%;
  cursor: ew-resize;
  border-radius: 2px;
  width: 5px;
  height: 14px;
}
.e {
  left: 100%;
  top: 50%;
  cursor: ew-resize;
  border-radius: 2px;
  width: 5px;
  height: 14px;
}
.transform-rotate {
  display: grid;
  place-items: center;
  position: absolute;
  pointer-events: auto;
  left: 50%;
  top: calc(100% + 18px);
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: #fff;
  color: #333;
  border: 1px solid #777;
  border-radius: 50%;
  padding: 0;
  cursor: grab;
  touch-action: none;
}
</style>
