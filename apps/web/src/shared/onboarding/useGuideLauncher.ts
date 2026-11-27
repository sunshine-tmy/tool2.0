import { computed, onMounted, onScopeDispose, reactive, ref, type Ref } from "vue";
import { useDraggable } from "@vueuse/core";
import { readLocal, writeLocal } from "./storage";

const KEY = "toolbox:onboarding:position:v1";
const MARGIN = 12;
type Dock = { side: "left" | "right"; ratio: number };

export function useGuideLauncher(host: Ref<HTMLElement | undefined>, disabled: () => boolean) {
  const saved = readLocal(KEY) as Partial<Dock> | undefined;
  const dock = reactive<Dock>({
    side: saved?.side === "left" ? "left" : "right",
    ratio:
      typeof saved?.ratio === "number" && Number.isFinite(saved.ratio) ? Math.max(0, Math.min(1, saved.ratio)) : 0.65
  });
  const mounted = ref(false);
  const lastSize = { width: 48, height: 48 };
  let moved = false;
  let origin = { x: 0, y: 0, left: 0, top: 0 };
  function bounds() {
    const style = getComputedStyle(document.documentElement);
    const header = Number.parseFloat(style.getPropertyValue("--shell-overlay-top")) || 0;
    const safeBottom = host.value ? Number.parseFloat(getComputedStyle(host.value).paddingBottom) || 0 : 0;
    const rect = host.value?.getBoundingClientRect();
    const hostStyle = host.value ? getComputedStyle(host.value) : undefined;
    const width = rect?.width || Number.parseFloat(hostStyle?.width ?? "") || 0;
    const height = rect?.height ? rect.height - safeBottom : Number.parseFloat(hostStyle?.height ?? "") || 0;
    if (width > 0 && Number.isFinite(width)) lastSize.width = width;
    if (height > 0 && Number.isFinite(height)) lastSize.height = height;
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft ?? 0) + MARGIN;
    const top = Math.max(viewport?.offsetTop ?? 0, header) + MARGIN;
    return {
      left,
      top,
      right: Math.max(left, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth) - lastSize.width - MARGIN),
      bottom: Math.max(
        top,
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - lastSize.height - MARGIN - safeBottom
      )
    };
  }
  const { x, y, isDragging } = useDraggable(host, {
    disabled,
    stopPropagation: true,
    onStart: (_position, event) => {
      moved = false;
      origin = { x: event.clientX, y: event.clientY, left: x.value, top: y.value };
    },
    onMove: (position, event) => {
      moved ||= Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6;
      const limit = bounds();
      position.x = moved ? Math.max(limit.left, Math.min(limit.right, position.x)) : origin.left;
      position.y = moved ? Math.max(limit.top, Math.min(limit.bottom, position.y)) : origin.top;
    },
    onEnd: () => {
      if (!moved) return;
      const limit = bounds();
      dock.side = x.value + lastSize.width / 2 < (limit.left + limit.right + lastSize.width) / 2 ? "left" : "right";
      dock.ratio = limit.bottom > limit.top ? (y.value - limit.top) / (limit.bottom - limit.top) : 0;
      position();
      writeLocal(KEY, dock);
    }
  });
  function position() {
    const limit = bounds();
    x.value = dock.side === "left" ? limit.left : limit.right;
    y.value = limit.top + dock.ratio * (limit.bottom - limit.top);
  }
  function moveTo(side: "left" | "right" | "reset") {
    dock.side = side === "reset" ? "right" : side;
    if (side === "reset") dock.ratio = 0.65;
    position();
    writeLocal(KEY, dock);
  }
  function consumeClick() {
    // Keyboard activation remains available after a drag.
    if (moved) {
      moved = false;
      return false;
    }
    return true;
  }
  let observer: MutationObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let frame = 0;
  function update() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!isDragging.value) position();
    });
  }
  onMounted(() => {
    mounted.value = true;
    position();
    observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(document.documentElement);
    if (host.value) resizeObserver.observe(host.value);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
  });
  onScopeDispose(() => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("scroll", update);
  });
  return {
    mounted,
    isDragging,
    consumeClick,
    moveTo,
    side: computed(() => dock.side),
    style: computed(() => ({ transform: `translate3d(${x.value}px, ${y.value}px, 0)` }))
  };
}
