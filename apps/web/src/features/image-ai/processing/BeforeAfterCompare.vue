<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <div class="compare-panel" :class="{ 'is-compact': compact }">
    <div ref="compareStage" class="compare-stage" :class="{ 'is-compact': compact }">
      <img class="compare-before-image" :src="beforeUrl" :alt="beforeLabel" decoding="async" />
      <div class="compare-after-layer" :class="{ checkerboard }" :style="{ clipPath: `inset(0 0 0 ${position}%)` }">
        <img :src="afterUrl" :alt="afterLabel" decoding="async" />
      </div>
      <div
        class="compare-divider"
        role="slider"
        tabindex="0"
        aria-label="处理前后对比位置"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="position"
        :style="{ left: `${position}%` }"
        @pointerdown.prevent="startDragging"
        @pointermove="moveDivider"
        @pointerup="stopDragging"
        @pointercancel="stopDragging"
        @lostpointercapture="stopDragging"
        @keydown="moveDividerWithKeyboard"
      >
        <span>↔</span>
      </div>
      <span class="compare-label before">{{ beforeLabel }}</span>
      <span class="compare-label after">{{ afterLabel }}</span>
    </div>
    <div class="compare-slider-row">
      <span>{{ beforeLabel }}</span>
      <n-slider v-model:value="position" :min="0" :max="100" :tooltip="false" />
      <span>{{ afterLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NSlider } from "naive-ui";

withDefaults(
  defineProps<{
    beforeUrl: string;
    afterUrl: string;
    beforeLabel?: string;
    afterLabel?: string;
    checkerboard?: boolean;
    compact?: boolean;
  }>(),
  {
    beforeLabel: "处理前",
    afterLabel: "处理后",
    checkerboard: false,
    compact: false
  }
);

const position = ref(50);
const compareStage = ref<HTMLDivElement>();
const dragging = ref(false);

function startDragging(event: PointerEvent) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  dragging.value = true;

  const handle = event.currentTarget as HTMLElement;
  try {
    handle.setPointerCapture(event.pointerId);
  } catch {
    // 测试环境或旧浏览器无法捕获合成指针时，仍可处理当前元素收到的移动事件。
  }

  updatePositionFromPointer(event.clientX);
}

function moveDivider(event: PointerEvent) {
  if (dragging.value) updatePositionFromPointer(event.clientX);
}

function stopDragging() {
  dragging.value = false;
}

function updatePositionFromPointer(clientX: number) {
  const bounds = compareStage.value?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0) return;
  position.value = Math.round(Math.min(100, Math.max(0, ((clientX - bounds.left) / bounds.width) * 100)));
}

function moveDividerWithKeyboard(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") position.value = Math.max(0, position.value - step);
  else if (event.key === "ArrowRight" || event.key === "ArrowUp") position.value = Math.min(100, position.value + step);
  else if (event.key === "Home") position.value = 0;
  else if (event.key === "End") position.value = 100;
  else return;
  event.preventDefault();
}
</script>
