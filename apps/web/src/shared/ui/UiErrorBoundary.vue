<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <slot v-if="!error" />
  <main v-else class="route-error" role="alert">
    <div class="route-error-card">
      <div class="route-error-icon"><TriangleAlert :size="26" /></div>
      <p class="tool-page-kicker">页面加载异常</p>
      <h1>这个模块暂时没有正常打开</h1>
      <p>页面内容没有完整加载。你可以重试，其他工具和本地文件不会受到影响。</p>
      <details>
        <summary>查看错误信息</summary>
        <code>{{ error.message }}</code>
      </details>
      <div class="route-error-actions">
        <n-button type="primary" @click="retry">重新加载</n-button>
        <n-button secondary @click="goHome">返回工具首页</n-button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton } from "naive-ui";
import { TriangleAlert } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const error = ref<Error>();

onErrorCaptured((captured) => {
  error.value = captured instanceof Error ? captured : new Error(String(captured));
  return false;
});

watch(
  () => route.fullPath,
  () => {
    error.value = undefined;
  }
);

function retry() {
  window.location.reload();
}

function goHome() {
  error.value = undefined;
  void router.push("/");
}
</script>
