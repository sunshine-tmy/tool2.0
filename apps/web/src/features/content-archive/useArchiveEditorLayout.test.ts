// @vitest-environment happy-dom
import { effectScope, ref, type EffectScope } from "vue";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useArchiveEditorLayout } from "./useArchiveEditorLayout";

const heightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight")!;
const widthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth")!;
let scope: EffectScope;
beforeEach(() => {
  scope = effectScope();
  localStorage.clear();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
});
afterEach(() => {
  scope.stop();
  localStorage.clear();
  Object.defineProperty(window, "innerHeight", heightDescriptor);
  Object.defineProperty(window, "innerWidth", widthDescriptor);
});
it("历史布局、鼠标和键盘压缩共用最低轨道高度，不能挤掉两条视频", () => {
  localStorage.setItem("archive-editor-layout-v1", JSON.stringify({ left: 300, right: 400, top: 900 }));
  const layout = scope.run(() => useArchiveEditorLayout(() => 308))!;
  expect(layout.style.value["--workspace-top"]).toBe("262px");
  layout.resize(new PointerEvent("pointerdown", { button: 0, clientY: 100 }), "top");
  window.dispatchEvent(new PointerEvent("pointermove", { clientY: 10000 }));
  window.dispatchEvent(new PointerEvent("pointerup"));
  for (let i = 0; i < 50; i++) layout.nudge(new KeyboardEvent("keydown", { key: "ArrowDown" }), "top");
  expect(layout.style.value["--workspace-top"]).toBe("262px");
  expect(layout.style.value["--workspace-timeline"]).toBe("308px");
  expect(JSON.parse(localStorage.getItem("archive-editor-layout-v1")!).top).toBe(262);
});
it("素材高度增加、窗口缩小及重置均重新约束布局，小窗口保留可用轨道空间", () => {
  const minimum = ref(200),
    layout = scope.run(() => useArchiveEditorLayout(() => minimum.value))!;
  minimum.value = 308;
  expect(layout.style.value["--workspace-top"]).toBe("262px");
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
  window.dispatchEvent(new Event("resize"));
  expect(layout.style.value["--workspace-top"]).toBe("260px");
  expect(layout.style.value["--workspace-timeline"]).toBe("308px");
  layout.reset();
  expect(layout.style.value["--workspace-top"]).toBe("260px");
  expect(layout.style.value["--workspace-timeline"]).toBe("308px");
});
