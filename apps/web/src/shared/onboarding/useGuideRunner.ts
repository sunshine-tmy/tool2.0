import { nextTick, onScopeDispose, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { Driver, DriveStep } from "driver.js";
import { guideUnavailable, visibleTarget, type Guide } from "./guides";
import { readProgress, writeProgress } from "./storage";
import { clearGuideDialogs, contextUnavailable, enterGuideContext, updateTourLayer } from "./contexts";

function waitForTarget(target: string, signal: AbortSignal): Promise<HTMLElement | undefined> {
  const found = visibleTarget(target);
  if (found || signal.aborted) return Promise.resolve(found);
  return new Promise((resolve) => {
    const finish = (element?: HTMLElement) => {
      observer.disconnect();
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      resolve(element);
    };
    const observer = new MutationObserver(() => {
      const element = visibleTarget(target);
      if (element) finish(element);
    });
    const aborted = () => finish();
    const timer = setTimeout(() => finish(), 3000);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    signal.addEventListener("abort", aborted, { once: true });
  });
}

export function useGuideRunner(notify: (message: string) => void) {
  const route = useRoute();
  const active = ref(false);
  const waiting = ref(false);
  let driver: Driver | undefined;
  let session: AbortController | undefined;
  let previousFocus: HTMLElement | undefined;
  let rootObserver: MutationObserver | undefined;
  let leaveContext: (() => void) | undefined;
  let contextId = "";
  let stopping = false;

  function stop() {
    if (stopping) return;
    stopping = true;
    const own = session;
    const restore = leaveContext;
    const instance = driver;
    const focus = previousFocus;
    session = undefined;
    driver = undefined;
    leaveContext = undefined;
    previousFocus = undefined;
    contextId = "";
    rootObserver?.disconnect();
    rootObserver = undefined;
    // Release our keyboard/wait guards even if another cleanup operation fails.
    active.value = false;
    waiting.value = false;
    try {
      if (instance) {
        // The runner owns focus restoration, after the dialog state has settled.
        // Driver must not refocus a control in the dialog we are about to close.
        instance.getState().__activeOnDestroyed = undefined;
        instance.setConfig({ ...instance.getConfig(), onDestroyed: undefined });
        instance.destroy();
      }
    } finally {
      try {
        own?.abort();
      } finally {
        try {
          restore?.();
        } finally {
          clearGuideDialogs();
          document.documentElement.style.removeProperty("--toolbox-tour-layer");
          stopping = false;
          void nextTick(() => {
            if (!session && !active.value && focus?.isConnected && focus.getClientRects().length) {
              focus.focus({ preventScroll: true });
            }
          });
        }
      }
    }
  }

  async function start(guide: Guide, resume: boolean) {
    stop();
    const unavailable = guideUnavailable(guide);
    if (unavailable) return notify(unavailable);
    const own = (session = new AbortController());
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    active.value = true;
    waiting.value = true;
    try {
      const [{ driver: createDriver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
        import("./tour.css")
      ]);
      if (own.signal.aborted) return;
      const saved = resume ? readProgress(guide.id, guide.version) : undefined;
      let index = Math.max(
        0,
        guide.steps.findIndex((step) => step.id === saved?.step)
      );
      let moving = false;
      const steps: DriveStep[] = guide.steps.map((step) => ({
        popover: { title: step.title, description: step.description }
      }));
      const save = (completed = false) =>
        writeProgress(guide.id, {
          version: guide.version,
          step: guide.steps[index].id,
          completed
        });
      const finish = () => {
        save(true);
        stop();
      };
      async function show(next: number, first = false) {
        if (moving || own.signal.aborted) return;
        moving = true;
        waiting.value = true;
        // Navigation stays serial while a conditional target is mounting.
        document
          .querySelectorAll<HTMLButtonElement>(".toolbox-tour .driver-popover-footer button")
          .forEach((button) => {
            button.disabled = true;
          });
        try {
          const step = guide.steps[next];
          const requested = step.context ?? guide.context ?? "";
          const reason = requested ? contextUnavailable(requested) : "";
          const desired = reason ? "" : requested;
          if (desired !== contextId) {
            leaveContext?.();
            leaveContext = undefined;
            contextId = "";
            await nextTick();
            if (own.signal.aborted) return;
            if (desired) {
              const restore = await enterGuideContext(desired, own.signal);
              if (own.signal.aborted) {
                restore();
                return;
              }
              leaveContext = restore;
              contextId = desired;
            }
          }
          updateTourLayer();
          // Conditional content (empty tables, absent subtitle rectangles) uses
          // its real parent immediately instead of repeating missing-step waits.
          const fallback = step.fallbackTarget ? visibleTarget(step.fallbackTarget) : undefined;
          const target = reason
            ? fallback
            : (visibleTarget(step.target) ?? fallback ?? (await waitForTarget(step.target, own.signal)));
          if (own.signal.aborted) return;
          steps[next] = {
            ...(target ? { element: target } : {}),
            popover: {
              title: step.title,
              description:
                target && !reason
                  ? step.description
                  : `${step.description}<br><br>${reason || step.missing || "请先准备素材或满足页面条件，结束引导后再操作；教程不会创建数据。"}`
            }
          };
          index = next;
          if (driver) {
            // setSteps() resets an active Driver tour. Update config in place
            // so resolving the next conditional anchor does not end the session.
            driver.setConfig({ ...driver.getConfig(), steps });
            if (first) driver.drive(index);
            else driver.moveTo(index);
          }
          save();
        } catch {
          if (!own.signal.aborted) {
            stop();
            notify("当前教程区域暂时无法显示，请重新打开引导。");
          }
        } finally {
          moving = false;
          if (!own.signal.aborted) waiting.value = false;
        }
      }
      driver = createDriver({
        steps,
        popoverClass: "toolbox-tour ui-v2",
        overlayOpacity: 0.45,
        stagePadding: 8,
        stageRadius: 10,
        animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        duration: 180,
        allowClose: true,
        overlayClickBehavior: "none",
        disableActiveInteraction: true,
        allowPageInteraction: false,
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "下一步",
        prevBtnText: "上一步",
        doneBtnText: "完成学习",
        closeBtnLabel: "结束引导",
        scrollIntoView: { block: "center", inline: "nearest" },
        focus: "popover",
        onNextClick: () => {
          if (index === steps.length - 1) finish();
          else void show(index + 1);
        },
        onPrevClick: () => {
          if (index > 0) void show(index - 1);
        },
        onDoneClick: finish,
        onDestroyed: stop,
        onPopoverRender: (popover) => {
          popover.wrapper.setAttribute("aria-label", `${guide.title}：${guide.steps[index].title}`);
          // Keep an explicit, labeled exit in addition to Escape and the close icon.
          popover.footer.querySelector(".toolbox-tour-end")?.remove();
          const end = document.createElement("button");
          end.type = "button";
          end.className = "toolbox-tour-end driver-popover-close-btn";
          end.textContent = "结束引导";
          end.addEventListener("click", stop);
          popover.footer.prepend(end);
        },
        onPopoverPositioned: (popover) => {
          const header =
            Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shell-overlay-top")) || 0;
          const rect = popover.wrapper.getBoundingClientRect();
          const top = Math.max(header + 8, Math.min(rect.top, innerHeight - rect.height - 12));
          const left = Math.max(12, Math.min(rect.left, innerWidth - rect.width - 12));
          popover.wrapper.style.top = `${top}px`;
          popover.wrapper.style.left = `${left}px`;
          popover.wrapper.style.bottom = "auto";
          popover.wrapper.style.right = "auto";
        }
      });
      rootObserver = new MutationObserver(() => {
        if (!visibleTarget(guide.root) || (guide.ready && !document.querySelector(guide.ready))) stop();
      });
      rootObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-tour-ready"]
      });
      await show(index, true);
    } catch {
      if (!own.signal.aborted) {
        stop();
        notify("引导资源加载失败，请稍后重新打开。");
      }
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (!active.value) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      stop();
      return;
    }
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) return;
    // Do not let global editor shortcuts change clips or start playback during a lesson.
    // Native button activation still works; Driver handles arrow navigation on keyup.
    event.stopImmediatePropagation();
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !["Enter", " ", "ArrowLeft", "ArrowRight"].includes(event.key)
    )
      event.preventDefault();
  }
  function onFullscreen() {
    if (document.fullscreenElement) stop();
  }
  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("fullscreenchange", onFullscreen);
  watch(() => route.fullPath, stop);
  onScopeDispose(() => {
    stop();
    document.removeEventListener("keydown", onKeydown, true);
    document.removeEventListener("fullscreenchange", onFullscreen);
  });
  return { active, waiting, start, stop };
}
