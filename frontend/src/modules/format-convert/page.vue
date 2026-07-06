<template>
  <ToolLayout>
    <ImageToolPage
      tool-id="format-convert"
      title="格式转换"
      description="在 JPG、PNG、WebP 等常用图片格式之间快速转换。"
      submit-label="开始转换"
    />
  </ToolLayout>
</template>

<script setup lang="ts">
import ToolLayout from "../../layouts/ToolLayout.vue";
import ImageToolPage from "../shared/ImageToolPage.vue";
</script>
