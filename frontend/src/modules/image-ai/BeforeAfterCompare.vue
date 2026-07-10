<template>
  <div class="compare-panel" :class="{ 'is-compact': compact }">
    <div class="compare-stage" :class="{ 'is-compact': compact }">
      <img class="compare-before-image" :src="beforeUrl" :alt="beforeLabel" />
      <div
        class="compare-after-layer"
        :class="{ checkerboard }"
        :style="{ clipPath: `inset(0 ${100 - position}% 0 0)` }"
      >
        <img :src="afterUrl" :alt="afterLabel" />
      </div>
      <div class="compare-divider" :style="{ left: `${position}%` }">
        <span>↔</span>
      </div>
      <span class="compare-label after">{{ afterLabel }}</span>
      <span class="compare-label before">{{ beforeLabel }}</span>
    </div>
    <div class="compare-slider-row">
      <span>{{ afterLabel }}</span>
      <n-slider v-model:value="position" :min="0" :max="100" :tooltip="false" />
      <span>{{ beforeLabel }}</span>
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
</script>

