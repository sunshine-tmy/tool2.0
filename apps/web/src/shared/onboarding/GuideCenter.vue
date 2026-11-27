<template>
  <Teleport to="body">
    <div
      v-show="launcherVisible"
      ref="host"
      class="guide-launcher ui-v2"
      data-onboarding-launcher
      :class="{ dragging: launcher.isDragging.value, compact: appearance === 'icon' || mascotUnavailable }"
      :style="launcher.style.value"
      @click.capture="suppressDragClick"
      @focusin="tipOpen = true"
      @focusout="tipOpen = false"
    >
      <n-tooltip
        v-model:show="tipOpen"
        trigger="hover"
        :placement="launcher.side.value === 'left' ? 'right' : 'left'"
        :disabled="launcher.isDragging.value || !launcherVisible"
      >
        <template #trigger>
          <GuideMascot
            v-if="appearance === 'mascot'"
            :key="mascotRevision"
            :active="launcherVisible"
            :dragging="launcher.isDragging.value"
            :motion-allowed="reducedMotion !== 'reduce'"
            @activate="open"
            @fallback="mascotUnavailable = true"
          />
          <button
            v-else
            type="button"
            class="guide-icon-trigger"
            data-guide-trigger
            aria-label="新手引导，点击查看教程；可拖动调整位置"
            @click="open"
          >
            <CircleHelp :size="24" aria-hidden="true" />
          </button>
        </template>
        新手引导，点击查看教程；可拖动调整位置
      </n-tooltip>
    </div>
  </Teleport>
  <n-modal
    v-model:show="opened"
    preset="card"
    aria-labelledby="guide-directory-title"
    class="guide-directory ui-v2"
    content-scrollable
    :style="{ width: 'min(720px, calc(100vw - 32px))' }"
    :bordered="false"
    :auto-focus="true"
    :z-index="directoryLayer"
    @after-leave="startPending"
  >
    <template #header>
      <div class="guide-directory-heading">
        <h2 id="guide-directory-title">新手操作引导</h2>
        <p class="guide-intro">按功能选择教程，随时退出。不会上传素材、修改参数或提交任务。</p>
        <n-tabs
          class="guide-module-tabs"
          :value="selectedModuleId"
          type="line"
          size="small"
          :animated="false"
          @update:value="selectModule"
        >
          <n-tab v-for="module in visibleModules" :key="module.id" :name="module.id">{{ module.title }}</n-tab>
        </n-tabs>
        <n-select
          class="guide-module-select"
          :value="selectedModuleId"
          :options="moduleOptions"
          :input-props="{ 'aria-label': '选择引导模块' }"
          @update:value="selectModule"
        />
        <p v-if="notice" class="guide-notice" role="status">{{ notice }}</p>
      </div>
    </template>
    <template #header-extra>
      <n-dropdown
        trigger="click"
        :options="positionOptions"
        :menu-props="() => ({ class: 'guide-position-menu' })"
        @select="moveLauncher"
      >
        <n-button class="guide-settings" size="small" quaternary circle aria-label="入口设置" title="入口设置">
          <template #icon><Settings2 :size="18" aria-hidden="true" /></template>
        </n-button>
      </n-dropdown>
    </template>
    <div v-if="!inSelectedModule" class="guide-module-notice">
      <p>正在浏览{{ selectedModule.title }}教程，进入模块后可开始学习。</p>
      <n-button size="small" type="primary" secondary @click="navigate(selectedModule.route)">前往该模块</n-button>
    </div>
    <n-collapse
      :key="selectedModuleId"
      class="guide-groups"
      display-directive="show"
      :expanded-names="expandedGroups"
      @update:expanded-names="setExpandedGroups"
    >
      <n-collapse-item v-for="group in selectedModule.groups" :key="group.id" :name="group.id" :title="group.title">
        <template #header="{ collapsed }">
          <n-button
            :id="`guide-group-${selectedModuleId}-${group.id}`"
            class="guide-group-toggle"
            text
            :aria-expanded="!collapsed"
            :aria-controls="`guide-chapters-${selectedModuleId}-${group.id}`"
            @click.stop="toggleGroup(group.id)"
            >{{ group.title }}</n-button
          >
        </template>
        <div
          :id="`guide-chapters-${selectedModuleId}-${group.id}`"
          class="guide-chapters"
          role="region"
          :aria-labelledby="`guide-group-${selectedModuleId}-${group.id}`"
        >
          <article v-for="chapter in group.chapters" :key="chapter.guide.id" class="guide-chapter">
            <div class="guide-chapter-info">
              <div class="guide-chapter-heading">
                <h3>{{ chapter.title }}</h3>
                <n-tag
                  :type="progress(chapter.guide)?.completed ? 'success' : 'default'"
                  size="small"
                  :bordered="false"
                >
                  {{ progress(chapter.guide)?.completed ? "已完成" : progress(chapter.guide) ? "学习中" : "未开始" }}
                </n-tag>
              </div>
              <p>{{ chapterDescription(chapter.guide) }}</p>
            </div>
            <div v-if="inSelectedModule" class="guide-chapter-actions">
              <n-button
                v-if="needsDraftHome(chapter.guide)"
                size="small"
                secondary
                @click="navigate(chapter.guide.route)"
                >前往草稿主页</n-button
              >
              <template v-else>
                <n-button
                  v-if="progress(chapter.guide) && !progress(chapter.guide)?.completed"
                  size="small"
                  type="primary"
                  :disabled="!!availability(chapter.guide)"
                  @click="begin(chapter.guide, true)"
                  >继续学习</n-button
                >
                <n-button
                  size="small"
                  :type="progress(chapter.guide) ? 'default' : 'primary'"
                  :disabled="!!availability(chapter.guide)"
                  @click="begin(chapter.guide, false)"
                  >{{ progress(chapter.guide) ? "重新开始" : "开始学习" }}</n-button
                >
              </template>
            </div>
          </article>
        </div>
      </n-collapse-item>
    </n-collapse>
  </n-modal>
  <Teleport to="body">
    <div v-if="runner.waiting.value" class="guide-wait-mask" aria-hidden="true"></div>
    <div v-if="runner.waiting.value" class="guide-waiting ui-v2" role="status">
      正在定位教程区域…<button type="button" @click="runner.stop">结束引导</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDropdown,
  NModal,
  NSelect,
  NTab,
  NTabs,
  NTag,
  NTooltip,
  useMessage
} from "naive-ui";
import { CircleHelp, Settings2 } from "lucide-vue-next";
import { useDocumentVisibility, usePreferredReducedMotion } from "@vueuse/core";
import GuideMascot from "./GuideMascot.vue";
import { guides, guideUnavailable, visibleTarget, type Guide } from "./guides";
import { directoryModuleForPath, resolveGuideDirectory, type DirectoryModule } from "./directory";
import { readLocal, readProgress, writeLocal } from "./storage";
import { useGuideLauncher } from "./useGuideLauncher";
import { useGuideRunner } from "./useGuideRunner";
import { guideDirectoryRequest, isTeachingDialog } from "./contexts";
import "./launcher.css";

const route = useRoute(),
  router = useRouter(),
  message = useMessage();
const opened = ref(false),
  directoryLayer = ref<number>(),
  fullscreen = ref(false),
  blocked = ref(false),
  host = ref<HTMLElement>();
const revision = ref(0),
  notice = ref("");
const APPEARANCE_KEY = "toolbox:onboarding:appearance:v1";
const appearance = ref<"mascot" | "icon">(readLocal(APPEARANCE_KEY) === "icon" ? "icon" : "mascot");
const mascotUnavailable = ref(false),
  tipOpen = ref(false);
const mascotRevision = ref(0);
const documentVisibility = useDocumentVisibility();
const reducedMotion = usePreferredReducedMotion();
const runner = useGuideRunner((text) => message.info(text));
const launcher = useGuideLauncher(
  host,
  () =>
    opened.value || runner.active.value || fullscreen.value || blocked.value || documentVisibility.value !== "visible"
);
const launcherVisible = computed(
  () =>
    launcher.mounted.value &&
    !runner.active.value &&
    !fullscreen.value &&
    !blocked.value &&
    !opened.value &&
    documentVisibility.value === "visible"
);
watch(
  () => [launcherVisible.value, launcher.isDragging.value],
  () => {
    if (!launcherVisible.value || launcher.isDragging.value) tipOpen.value = false;
  }
);
const directory = resolveGuideDirectory(guides);
const selectedModuleId = ref(directory[0].id);
const expandedByModule = ref<Record<string, string[]>>({});
const selectedModule = computed(() => directory.find((module) => module.id === selectedModuleId.value)!);
const currentModule = computed(() => directoryModuleForPath(directory, route.path));
const visibleModules = computed(() => (currentModule.value ? [currentModule.value] : directory));
const inSelectedModule = computed(() => currentModule.value?.id === selectedModuleId.value);
const expandedGroups = computed(() => expandedByModule.value[selectedModuleId.value] ?? []);
const moduleOptions = computed(() => visibleModules.value.map((module) => ({ label: module.title, value: module.id })));
const positionOptions = computed(() => [
  { label: appearance.value === "mascot" ? "独角兽形象 · 当前" : "独角兽形象", key: "mascot" },
  { label: appearance.value === "icon" ? "简洁图标 · 当前" : "简洁图标", key: "icon" },
  { type: "divider" as const, key: "appearance-divider" },
  { label: "靠左", key: "left" },
  { label: "靠右", key: "right" },
  { label: "重置位置", key: "reset" }
]);
let pending:
  | (({ kind: "guide"; guide: Guide; resume: boolean } | { kind: "navigate"; target: string }) & { path: string })
  | undefined;
let disposed = false;
const needsDraftHome = (guide: Guide) =>
  guide.id === "editor-home" && inSelectedModule.value && route.path !== guide.route;
const availability = (guide: Guide) => {
  revision.value;
  return guideUnavailable(guide);
};
const progress = (guide: Guide) => {
  revision.value;
  return readProgress(guide.id, guide.version);
};
function defaultGroup(module: DirectoryModule) {
  if (module.id === "editor" && (route.name === "video-editor-project" || visibleTarget("editor-workspace")))
    return "workspace";
  if (module.id === "speech" && visibleTarget("speech-online")) return "online";
  return module.groups[0].id;
}
function selectModule(value: string | number) {
  const module = visibleModules.value.find((item) => item.id === value);
  if (!module) return;
  selectedModuleId.value = module.id;
  notice.value = "";
  expandedByModule.value[module.id] ??= [defaultGroup(module)];
}
function setExpandedGroups(value: string | number | Array<string | number> | null) {
  expandedByModule.value[selectedModuleId.value] = (Array.isArray(value) ? value : value === null ? [] : [value]).map(
    String
  );
}
function toggleGroup(id: string) {
  const current = expandedGroups.value;
  setExpandedGroups(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
}
function moveLauncher(value: string | number) {
  if (value === "left" || value === "right" || value === "reset") launcher.moveTo(value);
  else if (value === "mascot" || value === "icon") {
    appearance.value = value;
    mascotUnavailable.value = false;
    if (value === "mascot") mascotRevision.value++;
    writeLocal(APPEARANCE_KEY, value);
  }
}
function chapterDescription(guide: Guide) {
  if (needsDraftHome(guide)) return "返回草稿主页，学习开始创作和草稿管理。";
  return (inSelectedModule.value ? availability(guide) : "") || `${guide.steps.length} 个步骤 · 可随时结束`;
}
function suppressDragClick(event: MouseEvent) {
  if (event.detail && !launcher.consumeClick()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
function open() {
  directoryLayer.value = undefined;
  notice.value = "";
  expandedByModule.value = {};
  selectModule(currentModule.value?.id ?? selectedModuleId.value);
  revision.value++;
  opened.value = true;
}
watch(
  guideDirectoryRequest,
  (guideId) => {
    if (!guideId) return;
    guideDirectoryRequest.value = undefined;
    if (runner.active.value || fullscreen.value || documentVisibility.value !== "visible") return;
    const module = visibleModules.value.find((item) =>
      item.groups.some((group) => group.chapters.some((chapter) => chapter.guide.id === guideId))
    );
    const group = module?.groups.find((item) => item.chapters.some((chapter) => chapter.guide.id === guideId));
    if (!module || !group) return;
    open();
    selectModule(module.id);
    expandedByModule.value[module.id] = [group.id];
    // The source dialog keeps its fields and focus trap; the directory is a
    // nested modal above it, and closes before the runner takes over teaching.
    let layer = 3100;
    for (const dialog of document.querySelectorAll<HTMLElement>(".n-modal-mask,.n-drawer-mask,[aria-modal='true']")) {
      if (!dialog.getClientRects().length) continue;
      let element: HTMLElement | null = dialog;
      while (element) {
        const z = Number.parseInt(getComputedStyle(element).zIndex);
        if (Number.isFinite(z)) layer = Math.max(layer, z + 20);
        element = element.parentElement;
      }
    }
    directoryLayer.value = layer;
  },
  { immediate: true }
);
function begin(guide: Guide, resume: boolean) {
  const reason = guideUnavailable(guide);
  if (reason) {
    notice.value = reason;
    return;
  }
  pending = { kind: "guide", guide, resume, path: route.fullPath };
  opened.value = false;
}
async function startPending() {
  const request = pending;
  pending = undefined;
  if (!request || request.path !== route.fullPath || document.fullscreenElement || disposed) return;
  if (request.kind === "guide") await runner.start(request.guide, request.resume);
  else await navigateAfterLeave(request.target);
}
function navigate(target: string) {
  pending = { kind: "navigate", target, path: route.fullPath };
  opened.value = false;
}
async function navigateAfterLeave(target: string) {
  try {
    const failure = await router.push(target);
    await nextTick();
    if (disposed) return;
    if (!failure && currentModule.value) {
      selectModule(currentModule.value.id);
      expandedByModule.value[currentModule.value.id] = [defaultGroup(currentModule.value)];
    }
    notice.value = failure ? "页面跳转已取消，未开始引导。" : "进入模块后，请选择章节开始学习。";
  } catch {
    notice.value = "页面暂时无法打开，请稍后重试。";
  }
  if (disposed) return;
  opened.value = true;
  revision.value++;
}
let observer: MutationObserver | undefined,
  frame = 0;
function updateBoundary() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    fullscreen.value = !!document.fullscreenElement;
    blocked.value = Array.from(
      document.querySelectorAll<HTMLElement>(".n-modal-mask,.n-drawer-mask,[aria-modal='true']")
    ).some((element) => !element.closest(".toolbox-tour") && element.getClientRects().length > 0);
    if (opened.value) revision.value++;
    const unexpectedDialog = Array.from(
      document.querySelectorAll<HTMLElement>(".n-modal-mask,.n-drawer-mask,[aria-modal='true']")
    ).some(
      (element) =>
        !element.closest(".toolbox-tour") && element.getClientRects().length > 0 && !isTeachingDialog(element)
    );
    if (runner.active.value && (fullscreen.value || unexpectedDialog)) runner.stop();
  });
}
onMounted(() => {
  observer = new MutationObserver(updateBoundary);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-tour-ready", "aria-modal", "class"]
  });
  document.addEventListener("fullscreenchange", updateBoundary);
  updateBoundary();
});
watch(
  () => route.fullPath,
  () => {
    pending = undefined;
    opened.value = false;
    revision.value++;
  }
);
watch(runner.active, (active) => {
  if (!active) {
    revision.value++;
    void nextTick(() =>
      document
        .querySelector<HTMLElement>("[data-onboarding-launcher] [data-guide-trigger]")
        ?.focus({ preventScroll: true })
    );
  }
});
onScopeDispose(() => {
  disposed = true;
  pending = undefined;
  observer?.disconnect();
  cancelAnimationFrame(frame);
  document.removeEventListener("fullscreenchange", updateBoundary);
});
</script>
