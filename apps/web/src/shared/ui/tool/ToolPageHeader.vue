<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <header class="tool-page-header" :class="{ 'has-compact-actions': compactActions }">
    <ToolPageDecoration v-if="tool?.icon" :tool-id="tool.id" />
    <img v-if="tool?.icon" :src="tool.icon" class="tool-page-icon" alt="" draggable="false" decoding="async" />
    <div class="tool-page-header-copy">
      <span v-if="kicker && !tool" class="tool-page-kicker">{{ kicker }}</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="tool-page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { toolPresentationKey } from "./catalog";
import ToolPageDecoration from "./ToolPageDecoration.vue";
const tool = inject(
  toolPresentationKey,
  computed(() => undefined)
);
defineProps<{
  title: string;
  description: string;
  kicker?: string;
  compactActions?: boolean;
}>();
</script>

<style scoped>
.tool-page-header {
  position: relative;
}
.tool-page-icon,
.tool-page-header-copy,
.tool-page-actions {
  position: relative;
  z-index: 1;
}
.tool-page-header.has-compact-actions .tool-page-actions {
  flex: 0 0 auto;
  width: auto;
  align-self: center;
}
@media (max-width: 600px) {
  header.tool-page-header.has-compact-actions {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) 44px;
  }
  .tool-page-header.has-compact-actions .tool-page-actions {
    grid-column: 3;
    grid-row: 1;
  }
}
</style>
