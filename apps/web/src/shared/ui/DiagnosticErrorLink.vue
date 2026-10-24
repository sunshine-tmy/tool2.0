<template>
  <n-button
    v-if="environmentError && localDiagnosticsAvailable"
    size="small"
    text
    type="primary"
    @click="$router.push({ path: '/settings/diagnostics', query: { module } })"
    >查看环境诊断</n-button
  >
  <span v-else-if="environmentError" class="remote-diagnostic-hint">请在桌面主机上查看环境诊断</span>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { localDiagnosticsAvailable } from "../http/diagnostics";
const props = defineProps<{ error?: string; module: string }>();
const environmentError = computed(() =>
  /(?:ECONNREFUSED|ETIMEDOUT|\b403\b|WORKER_|CUDA|显存不足|环境.{0,10}(?:未就绪|不可用|缺失)|服务.{0,12}(?:失败|准备|不可用|未启动)|模型.{0,8}(?:加载失败|缺失))/i.test(
    props.error || ""
  )
);
</script>
