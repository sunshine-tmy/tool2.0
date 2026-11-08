<template>
  <n-popover v-model:show="opened" trigger="click" placement="bottom-end" :show-arrow="false">
    <template #trigger>
      <n-button
        class="service-status-trigger"
        :class="`is-${status}`"
        circle
        quaternary
        :aria-label="`${title}，点击查看服务详情`"
        :aria-expanded="opened"
        aria-haspopup="dialog"
      >
        <span class="service-status-dot" aria-hidden="true" />
      </n-button>
    </template>
    <section class="service-status-details" :class="`is-${status}`" role="dialog" aria-label="服务状态详情">
      <strong><span class="service-status-dot" aria-hidden="true" />{{ title }}</strong>
      <p>{{ summary }}</p>
      <slot />
      <n-button
        class="service-status-refresh"
        size="small"
        secondary
        type="primary"
        :loading="loading"
        :disabled="loading"
        @click="emit('refresh')"
      >
        刷新服务状态
      </n-button>
    </section>
  </n-popover>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NPopover } from "naive-ui";

defineProps<{
  status: "available" | "partial" | "unavailable" | "loading" | "unknown";
  title: string;
  summary: string;
  loading?: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();
const opened = ref(false);
</script>

<style scoped>
.is-available {
  --service-dot-color: var(--color-success);
}
.is-partial {
  --service-dot-color: var(--color-warning);
}
.is-unavailable {
  --service-dot-color: var(--color-error);
}
.is-loading {
  --service-dot-color: var(--color-primary-600);
}
.is-unknown {
  --service-dot-color: var(--color-text-tertiary);
}
.service-status-trigger {
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
.service-status-dot {
  display: inline-block;
  flex: 0 0 9px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--service-dot-color);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--service-dot-color) 10%, transparent);
}
.service-status-details {
  display: grid;
  gap: 12px;
  width: 248px;
  max-width: calc(100vw - 64px);
  color: var(--color-text);
}
.service-status-details strong {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.service-status-details p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.service-status-details :deep(.service-status-refresh.n-button) {
  box-shadow: none;
}
@media (pointer: coarse), (max-width: 600px) {
  .service-status-details :deep(.n-button) {
    min-height: 44px;
  }
}
</style>
