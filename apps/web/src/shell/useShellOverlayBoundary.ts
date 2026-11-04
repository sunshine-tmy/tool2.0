/** 给 body 下的弹窗提供真实头部边界，包含桌面原生标题区及移动端两行工具栏。 */
import { onMounted, onScopeDispose, type Ref } from "vue";

let activeOwner: symbol | undefined;
export function useShellOverlayBoundary(header: Ref<HTMLElement | undefined>) {
  const owner = Symbol("shell-overlay-boundary");
  let observer: ResizeObserver | undefined;
  const update = () => {
    if (activeOwner !== owner || !header.value) return;
    const bottom = header.value.getBoundingClientRect().bottom;
    if (!Number.isFinite(bottom)) return;
    document.documentElement.style.setProperty("--shell-overlay-top", `${Math.max(0, Math.ceil(bottom))}px`);
  };
  onMounted(() => {
    if (!header.value) return;
    activeOwner = owner;
    update();
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(header.value);
      const titlebar = header.value.previousElementSibling;
      if (titlebar?.classList.contains("desktop-window-titlebar")) observer.observe(titlebar);
    }
    window.addEventListener("resize", update);
  });
  onScopeDispose(() => {
    observer?.disconnect();
    window.removeEventListener("resize", update);
    if (activeOwner === owner) {
      activeOwner = undefined;
      document.documentElement.style.removeProperty("--shell-overlay-top");
    }
  });
}
