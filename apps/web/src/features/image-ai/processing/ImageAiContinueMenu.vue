<template>
  <n-dropdown :options="options" trigger="click" @select="choose">
    <n-button size="small" secondary type="primary" :disabled="disabled" :loading="loading">继续处理</n-button>
  </n-dropdown>
</template>

<script setup lang="ts">
import { NButton, NDropdown } from "naive-ui";

defineProps<{ disabled?: boolean; loading?: boolean }>();
const emit = defineEmits<{ select: [target: "watermark" | "enhance" | "cutout"] }>();
const options = [
  { label: "去水印", key: "watermark" },
  { label: "变清晰", key: "enhance" },
  { label: "抠图", key: "cutout" }
];
function choose(key: string) {
  if (key === "watermark" || key === "enhance" || key === "cutout") emit("select", key);
}
</script>
