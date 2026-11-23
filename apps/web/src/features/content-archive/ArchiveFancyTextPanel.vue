<template>
  <div class="fancy-text-grid" aria-label="花字样式">
    <button
      type="button"
      class="fancy-text-card"
      :aria-pressed="!active || active === 'none'"
      title="无花字"
      aria-label="无花字"
      :disabled="disabled"
      @click="$emit('apply', 'none')"
    >
      <div class="fancy-text-thumbnail"><CircleSlash :size="28" aria-hidden="true" /></div>
      <span>无花字</span>
    </button>
    <button
      v-for="style in archiveFancyTextStyles"
      :key="style.id"
      type="button"
      class="fancy-text-card"
      :aria-pressed="active === style.id"
      :title="style.label"
      :aria-label="style.label"
      :disabled="disabled"
      @click="$emit('apply', style.id)"
    >
      <svg class="fancy-text-thumbnail" viewBox="-40 -29 80 58" aria-hidden="true">
        <path v-for="(shape, i) in flames" :key="i" :d="archiveFancySvgPath(shape.path)" :fill="shape.color" />
        <text
          v-for="stroke in style.strokes"
          :key="stroke.color"
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="central"
          :stroke="stroke.color"
          :stroke-width="stroke.width * 52"
          fill="none"
          stroke-linejoin="round"
        >
          花字
        </text>
        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" :fill="style.fill">花字</text></svg
      ><span>{{ style.label }}</span>
    </button>
  </div>
</template>
<script setup lang="ts">
import { CircleSlash } from "lucide-vue-next";
import { archiveFancyTextStyles, archiveFancyFlames, archiveFancySvgPath } from "@toolbox/shared/archive";
defineProps<{ active?: string; disabled: boolean }>();
defineEmits<{ apply: [id: "none" | (typeof archiveFancyTextStyles)[number]["id"]] }>();
const flames = archiveFancyFlames({
  font: 26,
  lineHeight: 31.2,
  lines: ["花字"],
  lineWidths: [52],
  blockWidth: 52,
  vertical: false,
  glyphs: []
});
</script>
<style scoped>
.fancy-text-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 10px;
  align-content: start;
}
.fancy-text-card {
  min-width: 0;
  padding: 5px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-secondary);
  background: var(--color-surface-subtle);
  cursor: pointer;
  display: grid;
  gap: 5px;
  text-align: center;
  font-size: 12px;
}
.fancy-text-card[aria-pressed="true"],
.fancy-text-card:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: -2px;
}
.fancy-text-card:disabled {
  opacity: 0.45;
  cursor: default;
}
.fancy-text-thumbnail {
  width: 100%;
  height: 66px;
  border-radius: 5px;
  background: #303038;
  color: #d4d4da;
  display: grid;
  place-items: center;
}
.fancy-text-thumbnail text {
  font:
    700 26px Arial,
    sans-serif;
}
</style>
