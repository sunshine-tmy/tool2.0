import { ref, computed, watch, onScopeDispose } from "vue";
export function useArchiveEditorLayout(timelineMinimum: () => number = () => 200) {
  // Two 120px cards, their gap, panel padding, and the content scrollbar.
  const leftMinimum = 300,
    topMinimum = 260,
    pageChrome = 230;
  const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
  const minimum = computed(() => Math.max(200, timelineMinimum()));
  const topMaximum = computed(() => Math.max(topMinimum, viewport.value.height - pageChrome - minimum.value));
  const defaults = { left: leftMinimum, right: 400, top: Math.min(560, Math.max(320, viewport.value.height * 0.48)) };
  type Key = keyof typeof defaults;
  function constrain(key: Key, value: number) {
    const low = key === "left" ? leftMinimum : key === "right" ? 380 : topMinimum;
    const high =
      key === "top"
        ? topMaximum.value
        : key === "left"
          ? Math.max(leftMinimum, Math.min(500, viewport.value.width * 0.3))
          : Math.max(380, Math.min(650, viewport.value.width * 0.4));
    return Math.max(low, Math.min(high, value));
  }
  const sizes = ref({
    left: defaults.left,
    right: constrain("right", defaults.right),
    top: constrain("top", defaults.top)
  });
  try {
    const saved = JSON.parse(localStorage.getItem("archive-editor-layout-v1") ?? "null");
    if (saved && [saved.left, saved.right, saved.top].every((value) => Number.isFinite(value)))
      sizes.value = {
        left: constrain("left", saved.left),
        right: constrain("right", saved.right),
        top: constrain("top", saved.top)
      };
  } catch {
    // Unavailable storage or malformed preferences use the default layout.
  }
  const style = computed(() => ({
    "--workspace-left": `${sizes.value.left}px`,
    "--workspace-left-min": `${leftMinimum}px`,
    "--workspace-right-min": "380px",
    "--workspace-right": `${sizes.value.right}px`,
    "--workspace-top": `${sizes.value.top}px`,
    "--workspace-timeline": `${Math.max(minimum.value, viewport.value.height - sizes.value.top - pageChrome)}px`
  }));
  // Revalidate restored layouts when tracks change or the window shrinks.
  watch(
    [minimum, viewport],
    () => {
      for (const key of ["left", "right", "top"] as const) sizes.value[key] = constrain(key, sizes.value[key]);
    },
    { flush: "sync" }
  );
  const windowResize = () => {
    viewport.value = { width: window.innerWidth, height: window.innerHeight };
  };
  window.addEventListener("resize", windowResize);
  let cleanup: (() => void) | undefined;
  function persist() {
    try {
      localStorage.setItem("archive-editor-layout-v1", JSON.stringify(sizes.value));
    } catch {
      // Layout persistence is optional; keep resizing available.
    }
  }
  function resize(event: PointerEvent, key: Key) {
    if (event.button !== 0) return;
    cleanup?.();
    event.preventDefault();
    const initial = sizes.value[key],
      origin = key === "top" ? event.clientY : event.clientX;
    const move = (e: PointerEvent) => {
      const delta = (key === "top" ? e.clientY : e.clientX) - origin;
      sizes.value[key] = constrain(key, initial + (key === "right" ? -delta : delta));
    };
    const stop = () => {
      cleanup?.();
      persist();
    };
    cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      cleanup = undefined;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }
  function nudge(event: KeyboardEvent, key: Key) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    sizes.value[key] = constrain(key, sizes.value[key] + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -20 : 20));
    persist();
  }
  function reset() {
    sizes.value = {
      left: constrain("left", defaults.left),
      right: constrain("right", defaults.right),
      top: constrain("top", defaults.top)
    };
    persist();
  }
  onScopeDispose(() => {
    cleanup?.();
    window.removeEventListener("resize", windowResize);
  });
  return { style, resize, nudge, reset };
}
