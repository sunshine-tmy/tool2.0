<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <header
    class="tool-page-header"
    :class="{
      'has-compact-actions': compactActions,
      'has-icon': Boolean(tool?.icon),
      'has-actions': Boolean($slots.actions)
    }"
  >
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
  --tool-header-icon: 64px;
  --tool-header-title: 26px;
  --tool-header-line: 36px;
  --tool-header-gap: 16px;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  column-gap: var(--tool-header-gap);
  row-gap: 16px;
  min-width: 0;
  min-height: var(--tool-header-icon);
  margin: 0;
  padding: 0;
  flex-shrink: 0;
}
.tool-page-header.has-icon {
  grid-template-columns: var(--tool-header-icon) minmax(0, 1fr);
}
.tool-page-header.has-actions {
  grid-template-columns: minmax(0, 1fr) auto;
}
.tool-page-header.has-icon.has-actions {
  grid-template-columns: var(--tool-header-icon) minmax(0, 1fr) auto;
}
.tool-page-icon,
.tool-page-header-copy,
.tool-page-actions {
  position: relative;
  z-index: 1;
}
.tool-page-icon {
  display: block;
  width: var(--tool-header-icon);
  height: var(--tool-header-icon);
  object-fit: contain;
}
.tool-page-header-copy {
  min-width: 0;
}
h2 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--tool-header-title);
  font-weight: 700;
  line-height: var(--tool-header-line);
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
p {
  max-width: 760px;
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.tool-page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}
.tool-page-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  margin-bottom: 8px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
}
@media (max-width: 600px) {
  .tool-page-header {
    --tool-header-icon: 56px;
    --tool-header-title: 24px;
    --tool-header-line: 32px;
    --tool-header-gap: 12px;
  }
  .tool-page-header.has-actions:not(.has-compact-actions) {
    grid-template-columns: minmax(0, 1fr);
  }
  .tool-page-header.has-icon.has-actions:not(.has-compact-actions) {
    grid-template-columns: var(--tool-header-icon) minmax(0, 1fr);
  }
  .tool-page-header.has-actions:not(.has-compact-actions) .tool-page-actions {
    grid-column: 1/-1;
    justify-self: start;
    justify-content: flex-start;
    width: 100%;
  }
  .tool-page-header.has-icon.has-compact-actions.has-actions {
    grid-template-columns: var(--tool-header-icon) minmax(0, 1fr) 44px;
  }
}
@container tool-content (max-width:600px) {
  .tool-page-header {
    --tool-header-icon: 56px;
    --tool-header-title: 24px;
    --tool-header-line: 32px;
    --tool-header-gap: 12px;
  }
  .tool-page-header.has-actions:not(.has-compact-actions) {
    grid-template-columns: minmax(0, 1fr);
  }
  .tool-page-header.has-icon.has-actions:not(.has-compact-actions) {
    grid-template-columns: var(--tool-header-icon) minmax(0, 1fr);
  }
  .tool-page-header.has-actions:not(.has-compact-actions) .tool-page-actions {
    grid-column: 1/-1;
    justify-self: start;
    justify-content: flex-start;
    width: 100%;
  }
  .tool-page-header.has-icon.has-compact-actions.has-actions {
    grid-template-columns: var(--tool-header-icon) minmax(0, 1fr) 44px;
  }
}
</style>
