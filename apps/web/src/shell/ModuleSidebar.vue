<template>
  <aside
    id="module-sidebar"
    class="module-sidebar"
    :class="{ 'is-collapsed': collapsed, 'is-mobile-menu': mobile }"
    aria-label="模块导航"
  >
    <div class="module-sidebar-heading">
      <span class="module-sidebar-copy">工具导航</span>
      <span class="module-sidebar-count module-sidebar-copy">{{ tools.length }}</span>
    </div>
    <nav class="module-sidebar-links" aria-label="切换工具">
      <router-link class="module-sidebar-link module-sidebar-home" to="/" title="返回首页" aria-label="返回首页">
        <span class="module-sidebar-icon"><House :size="20" /></span>
        <span class="module-sidebar-copy">返回首页</span>
      </router-link>
      <section v-for="group in groups" :key="group.value" class="module-sidebar-group" :aria-label="group.label">
        <h2 class="module-sidebar-copy">{{ group.label }}</h2>
        <router-link
          v-for="tool in group.tools"
          :key="tool.id"
          :to="tool.routePath"
          class="module-sidebar-link"
          :class="{ 'is-current': currentToolId === tool.id }"
          :aria-current="currentToolId === tool.id ? 'page' : undefined"
          :aria-label="tool.title"
          :title="tool.title"
        >
          <span class="module-sidebar-icon"
            ><img v-if="tool.icon" :src="tool.icon" alt="" draggable="false" /><Wrench v-else :size="20"
          /></span>
          <span class="module-sidebar-copy">{{ tool.title }}</span>
        </router-link>
      </section>
    </nav>
    <router-link
      v-if="showSettings"
      class="module-sidebar-link module-sidebar-settings"
      to="/settings"
      title="桌面设置"
      aria-label="桌面设置"
    >
      <span class="module-sidebar-icon"><Settings :size="19" /></span>
      <span class="module-sidebar-copy">桌面设置</span>
    </router-link>
  </aside>
</template>

<script setup lang="ts">
import { House, Settings, Wrench } from "lucide-vue-next";
import { toolCategories, workbenchTools } from "../shared/ui/tool/catalog";

defineProps<{ currentToolId?: string; collapsed: boolean; showSettings: boolean; mobile?: boolean }>();
const tools = workbenchTools();
const groups = toolCategories
  .map((category) => ({
    ...category,
    tools: tools.filter((tool) => tool.category === category.value)
  }))
  .filter((category) => category.tools.length);
</script>

<style scoped>
.module-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 20px 12px 16px;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
  scrollbar-width: thin;
}
.module-sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
  margin: 0 10px 14px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.module-sidebar-count {
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  font-size: 11px;
}
.module-sidebar-links {
  display: grid;
  gap: 4px;
}
.module-sidebar-group {
  min-width: 0;
}
.module-sidebar-group h2 {
  margin: 18px 12px 8px;
  color: var(--color-text-tertiary);
  font-size: 11px;
  font-weight: 500;
}
.module-sidebar-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 7px 10px;
  margin: 2px 0;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 13px;
  line-height: 1.4;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.module-sidebar-link:hover {
  color: var(--color-primary-700);
  background: var(--color-primary-50);
}
.module-sidebar-link.is-current {
  color: var(--color-primary-700);
  background: var(--color-primary-100);
  border-color: var(--color-primary-200);
  font-weight: 700;
}
.module-sidebar-link.is-current::before {
  position: absolute;
  content: "";
  left: -8px;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 3px;
  background: var(--color-primary-600);
}
.module-sidebar-icon {
  display: grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
}
.module-sidebar-icon img {
  display: block;
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.module-sidebar-copy {
  min-width: 0;
}
.module-sidebar-settings {
  margin-top: 20px;
  border-top-color: var(--color-border);
  border-radius: 0;
  padding-top: 14px;
}
.module-sidebar.is-collapsed {
  padding-inline: 8px;
}
.module-sidebar.is-collapsed .module-sidebar-copy {
  display: none;
}
.module-sidebar.is-collapsed .module-sidebar-heading {
  display: none;
}
.module-sidebar.is-collapsed .module-sidebar-link {
  justify-content: center;
  padding-inline: 6px;
}
.module-sidebar.is-collapsed .module-sidebar-group + .module-sidebar-group {
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
}
@media (max-width: 900px) {
  .module-sidebar {
    padding: 14px 8px;
  }
  .module-sidebar .module-sidebar-copy,
  .module-sidebar .module-sidebar-heading {
    display: none;
  }
  .module-sidebar .module-sidebar-link {
    justify-content: center;
    padding-inline: 6px;
  }
  .module-sidebar .module-sidebar-group + .module-sidebar-group {
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
    margin-top: 8px;
  }
}
.module-sidebar.is-mobile-menu {
  height: auto;
  padding: 14px 12px 20px;
  border-right: 0;
}
.module-sidebar.is-mobile-menu .module-sidebar-copy {
  display: block;
}
.module-sidebar.is-mobile-menu .module-sidebar-heading {
  display: flex;
}
.module-sidebar.is-mobile-menu .module-sidebar-link {
  justify-content: flex-start;
  min-height: 48px;
  padding: 8px 10px;
  font-size: 14px;
}
.module-sidebar.is-mobile-menu .module-sidebar-group + .module-sidebar-group {
  padding-top: 0;
  margin-top: 0;
  border-top: 0;
}
</style>
