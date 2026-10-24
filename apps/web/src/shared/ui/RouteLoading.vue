<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <main class="route-loading" aria-label="正在加载工具" aria-busy="true">
    <div class="route-loading-sidebar" />
    <div class="route-loading-content">
      <div class="route-loading-line title" />
      <div class="route-loading-line subtitle" />
      <div class="route-loading-panel">
        <div class="route-loading-line tab" />
        <div class="route-loading-grid">
          <div class="route-loading-block" />
          <div class="route-loading-block compact" />
        </div>
      </div>
    </div>
    <span class="sr-only">工具正在加载，请稍候</span>
  </main>
</template>
