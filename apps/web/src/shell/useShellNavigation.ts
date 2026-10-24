import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { listTools } from "@toolbox/shared";
import { AudioLines, FileArchive, ImageDown, LibraryBig, ScanLine } from "lucide-vue-next";
export function useShellNavigation() {
  const route = useRoute();
  const keyword = ref("");
  const searchInput = ref<{ focus: () => void }>();
  const isCompact = ref(typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);

  const desktopSidebarCollapsed = ref(false);
  const mobileDrawerOpen = ref(false);

  const tools = listTools();
  const iconByTool: Record<string, unknown> = {
    "image-compress": ImageDown,
    "image-ai": ScanLine,
    "lan-transfer": FileArchive,
    "edge-tts": AudioLines,
    "audio-library": AudioLines,
    "xhs-archive": LibraryBig
  };

  const filteredTools = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) => tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q));
  });

  const toolGroupDefinitions = [
    { label: "图片工具", ids: ["image-compress", "image-ai"] },
    { label: "视频与文案", ids: ["edge-tts", "audio-library", "xhs-archive"] },
    { label: "文件协作", ids: ["lan-transfer"] }
  ];

  const filteredToolGroups = computed(() =>
    toolGroupDefinitions
      .map((group) => ({ ...group, tools: filteredTools.value.filter((tool) => group.ids.includes(tool.id)) }))
      .filter((group) => group.tools.length)
  );

  const sidebarToggleLabel = computed(() => {
    if (isCompact.value) return mobileDrawerOpen.value ? "关闭工具菜单" : "打开工具菜单";
    return desktopSidebarCollapsed.value ? "显示侧边菜单" : "隐藏侧边菜单";
  });

  const sidebarHidden = computed(() => isCompact.value && !mobileDrawerOpen.value);

  let compactQuery: MediaQueryList | undefined;

  function syncCompactLayout(event?: MediaQueryListEvent) {
    isCompact.value = event?.matches ?? compactQuery?.matches ?? false;
    if (!isCompact.value) mobileDrawerOpen.value = false;
  }

  function toggleSidebar() {
    if (isCompact.value) mobileDrawerOpen.value = !mobileDrawerOpen.value;
    else desktopSidebarCollapsed.value = !desktopSidebarCollapsed.value;
  }

  function closeMobileDrawer() {
    if (isCompact.value) mobileDrawerOpen.value = false;
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isCompact.value) mobileDrawerOpen.value = false;
    if (event.key === "/" && !isEditableTarget(event.target)) {
      event.preventDefault();
      searchInput.value?.focus();
    }
  }

  function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return target.matches("input, textarea, [contenteditable='true']");
  }

  function startNavigation() {
    compactQuery = window.matchMedia("(max-width: 900px)");
    syncCompactLayout();
    compactQuery.addEventListener("change", syncCompactLayout);
    window.addEventListener("keydown", onWindowKeydown);
  }
  onBeforeUnmount(() => {
    compactQuery?.removeEventListener("change", syncCompactLayout);
    window.removeEventListener("keydown", onWindowKeydown);
    document.body.classList.remove("sidebar-drawer-active");
  });
  watch(
    () => route.path,
    (path) => {
      closeMobileDrawer();
      if (path.startsWith("/tools/")) localStorage.setItem("toolbox:last-tool", path);
    }
  );

  watch(
    () => isCompact.value && mobileDrawerOpen.value,
    (open) => document.body.classList.toggle("sidebar-drawer-active", open)
  );

  return {
    keyword,
    searchInput,
    isCompact,
    desktopSidebarCollapsed,
    mobileDrawerOpen,
    tools,
    iconByTool,
    filteredTools,
    filteredToolGroups,
    sidebarToggleLabel,
    sidebarHidden,
    toggleSidebar,
    closeMobileDrawer,
    startNavigation
  };
}
