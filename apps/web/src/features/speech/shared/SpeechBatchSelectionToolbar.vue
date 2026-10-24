<template>
  <div class="speech-batch-selection-toolbar">
    <n-checkbox
      :checked="checked"
      :indeterminate="indeterminate"
      :disabled="disabled || loading"
      @update:checked="emit('selectAll', $event)"
      >全选本页</n-checkbox
    >
    <span>已选 {{ selectedCount }} 个批次</span>
    <n-button
      size="small"
      type="error"
      secondary
      :loading="loading"
      :disabled="disabled || !selectedCount"
      @click="emit('remove')"
    >
      <template #icon><Trash2 :size="15" /></template>删除所选
    </n-button>
  </div>
</template>
<script setup lang="ts">
import { NCheckbox, NButton } from "naive-ui";
import { Trash2 } from "lucide-vue-next";
defineProps<{ selectedCount: number; checked: boolean; indeterminate: boolean; disabled: boolean; loading: boolean }>();
const emit = defineEmits<{ selectAll: [checked: boolean]; remove: [] }>();
</script>
