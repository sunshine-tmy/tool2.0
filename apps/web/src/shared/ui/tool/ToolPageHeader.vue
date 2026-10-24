<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <header class="tool-page-header">
    <div class="tool-page-header-copy">
      <span v-if="kicker" class="tool-page-kicker">{{ kicker }}</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="tool-page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  kicker?: string;
}>();
</script>
