<template>
  <ToolLayout>
    <ImageToolPage
      tool-id="image-compress"
      title="图片压缩"
      description="压缩商品图、详情页素材和社媒图片，兼顾体积与清晰度。"
      submit-label="开始压缩"
    />
  </ToolLayout>
</template>

<script setup lang="ts">
import ToolLayout from "../../layouts/ToolLayout.vue";
import ImageToolPage from "../shared/ImageToolPage.vue";
</script>
