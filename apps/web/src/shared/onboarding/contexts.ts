import { nextTick, onScopeDispose, ref, shallowReactive, type Ref } from "vue";

export type GuideContext = {
  available?: () => string;
  enter: (signal: AbortSignal) => (() => void) | Promise<() => void>;
};
const contexts = new Map<string, GuideContext>();
export const guideContextRevision = ref(0);
export const activeGuideContext = ref("");
// Dialogs request the existing async directory without importing its UI or lessons.
export const guideDirectoryRequest = ref<string>();
export function requestGuideDirectory(guideId: string) {
  guideDirectoryRequest.value = guideId;
}
const contextSessionActive = ref(false);
let activeOwner: symbol | undefined;
const allowedDialogs = new Set<string>();
const leavingDialogs = shallowReactive(new Set<string>());
export function clearGuideDialogs() {
  // Re-enabling VFocusTrap changes its rendered root from the dialog's
  // Transition to a Fragment. Keep that root stable until after-leave, or
  // Naive UI can lose the completion callback that removes its blocking mask.
  const candidates: Array<{ id: string; element: HTMLElement }> = [];
  for (const id of allowedDialogs) {
    const element = document.querySelector<HTMLElement>(`[data-guide-context="${id}"]`);
    if (element?.closest(".n-modal-container") && element.getClientRects().length) {
      leavingDialogs.add(id);
      candidates.push({ id, element });
    }
  }
  allowedDialogs.clear();
  contextSessionActive.value = false;
  void nextTick(() => {
    for (const { id, element } of candidates) {
      // A user-owned dialog remains open. It must not inherit a pending-close
      // exemption the next time the user closes it through the normal UI.
      if (!element.isConnected || element.getAttribute("data-guide-open") !== "false") leavingDialogs.delete(id);
    }
  });
}

export function registerGuideContext(id: string, context: GuideContext) {
  if (contexts.has(id)) throw new Error(`Duplicate guide context: ${id}`);
  contexts.set(id, context);
  guideContextRevision.value++;
  onScopeDispose(() => {
    if (contexts.get(id) === context) contexts.delete(id);
    leavingDialogs.delete(id);
    guideContextRevision.value++;
  });
}
export function contextUnavailable(id: string) {
  guideContextRevision.value;
  const context = contexts.get(id);
  return context ? (context.available?.() ?? "") : "教学区域仍在加载，请稍后开始。";
}
export async function enterGuideContext(id: string, signal: AbortSignal): Promise<() => void> {
  const context = contexts.get(id);
  if (!context) throw new Error("教学区域尚未就绪");
  const reason = context.available?.();
  if (reason) throw new Error(reason);
  const owner = Symbol(id);
  contextSessionActive.value = true;
  activeOwner = owner;
  allowedDialogs.add(id);
  activeGuideContext.value = id;
  try {
    const result = context.enter(signal);
    const restore = typeof result === "function" ? result : await result;
    let restored = false;
    const leave = () => {
      if (restored) return;
      restored = true;
      signal.removeEventListener("abort", leave);
      restore();
      if (activeOwner === owner) {
        activeOwner = undefined;
        activeGuideContext.value = "";
      }
    };
    signal.addEventListener("abort", leave, { once: true });
    if (signal.aborted) {
      leave();
      return () => undefined;
    }
    await nextTick();
    return leave;
  } catch (error) {
    if (activeOwner === owner) {
      activeOwner = undefined;
      activeGuideContext.value = "";
    }
    throw error;
  }
}
/** Directly display a dialog without invoking upload, parse, submit or reset actions. */
export function useGuideDialog(id: string, opened: Ref<boolean>, available?: () => string) {
  registerGuideContext(id, {
    available,
    enter: () => {
      const previous = opened.value;
      opened.value = true;
      return () => {
        opened.value = previous;
      };
    }
  });
}
export function guideDialogBinding(id: string, opened: boolean, aliases: string[] = []) {
  const current = activeGuideContext.value;
  const ids = [id, ...aliases];
  const owned = ids.some((value) =>
    contextSessionActive.value ? allowedDialogs.has(value) : !opened && leavingDialogs.has(value)
  );
  return {
    "data-guide-context": current === id || aliases.includes(current) ? current : id,
    "data-guide-open": opened ? "true" : "false",
    trapFocus: !owned,
    closeOnEsc: !owned,
    onAfterLeave: () => ids.forEach((value) => leavingDialogs.delete(value)),
    ...(owned ? { maskClosable: false, autoFocus: false } : {})
  };
}
export function isTeachingDialog(element: HTMLElement) {
  const container = element.closest(".n-modal-container,.n-drawer-container");
  return [...allowedDialogs].some((id) => {
    const owner = document.querySelector(`[data-guide-context="${id}"]`);
    return !!owner && (element === owner || owner.contains(element) || !!container?.contains(owner));
  });
}
export function updateTourLayer() {
  let layer = 3100;
  for (const id of allowedDialogs) {
    let element = document.querySelector<HTMLElement>(`[data-guide-context="${id}"]`);
    while (element) {
      const z = Number.parseInt(getComputedStyle(element).zIndex);
      if (Number.isFinite(z)) layer = Math.max(layer, z + 20);
      element = element.parentElement;
    }
  }
  document.documentElement.style.setProperty("--toolbox-tour-layer", String(layer));
}
