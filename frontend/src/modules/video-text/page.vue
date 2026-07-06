<template>
  <ToolLayout>
    <section class="main-column">
      <div class="section-title">
        <div>
          <h2>视频文本解析</h2>
          <p>该模块已预留路由，后续会接入视频转文字能力。</p>
        </div>
      </div>
      <section class="workspace-panel">
        <n-empty description="规划中" />
      </section>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { NEmpty } from "naive-ui";
import ToolLayout from "../../layouts/ToolLayout.vue";
</script>
