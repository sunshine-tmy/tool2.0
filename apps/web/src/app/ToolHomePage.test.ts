// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workbenchTools } from "../shared/ui/tool/catalog";
import ToolHomePage from "./ToolHomePage.vue";

vi.mock("../shared/http/diagnostics", () => ({
  localDiagnosticsAvailable: true
}));
const wrappers: Array<{ unmount(): void }> = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  localStorage.clear();
  delete window.toolboxDesktop;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
async function home() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div/>" } }]
  });
  await router.push("/");
  const w = mount(ToolHomePage, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: { ToolLayout: { template: "<div><slot/></div>" } }
    }
  });
  wrappers.push(w);
  await flushPromises();
  return { w, router };
}
describe("home-centered workbench", () => {
  it("includes all 13 real routes with distinct finalized icons and places LAN last", async () => {
    const { w, router } = await home();
    const cards = w.findAll(".workbench-card");
    expect(cards).toHaveLength(13);
    expect(cards.map((c) => c.attributes("href"))).toEqual(workbenchTools().map((t) => t.routePath));
    expect(new Set(cards.map((c) => c.get("img").attributes("src"))).size).toBe(13);
    expect(cards.at(-1)!.classes()).toContain("workbench-card-wide");
    await cards.find((c) => c.text().includes("视频去字幕"))!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/tools/video-subtitle");
  });
  it("combines category and purpose search, resets empty results and preserves all tool entries", async () => {
    const { w } = await home();
    const categories = w.findAll(".workbench-categories button");
    expect(categories.map((b) => b.get("span").text())).toEqual(["13", "2", "2", "4", "4", "1"]);
    await categories[3].trigger("click");
    expect(w.findAll(".workbench-card")).toHaveLength(4);
    await w.get("input").setValue("OGG");
    expect(w.findAll(".workbench-card")).toHaveLength(1);
    expect(w.get(".workbench-card").text()).toContain("音频格式转换");
    await w.get("input").setValue("图片压缩");
    expect(w.findAll(".workbench-card")).toHaveLength(0);
    await w.get(".workbench-empty button").trigger("click");
    expect(w.findAll(".workbench-card")).toHaveLength(13);
    expect(categories[0].attributes("aria-pressed")).toBe("true");
  });
  it("restores actual previous tools, including the legacy archive URL, and ignores unknown storage", async () => {
    localStorage.setItem("toolbox:last-tool", "/tools/xhs-archive");
    const { w } = await home();
    expect(w.get(".workbench-continue").attributes("href")).toBe("/tools/media-archive");
    w.unmount();
    localStorage.setItem("toolbox:last-tool", "https://untrusted.example/");
    const next = await home();
    expect(next.w.find(".workbench-continue").exists()).toBe(false);
  });
  it("does not steal slash from text, IME, modified keys or a dialog; releases the shortcut on unmount", async () => {
    const { w } = await home();
    const input = w.get("input").element as HTMLInputElement;
    const focus = vi.spyOn(input, "focus");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
    expect(focus).toHaveBeenCalledOnce();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", isComposing: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    document.body.append(modal);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
    expect(focus).toHaveBeenCalledOnce();
    modal.remove();
    w.unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
    expect(focus).toHaveBeenCalledOnce();
  });
  it("shows data migration only on desktop and tolerates denied preference reads", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const browser = await home();
    expect(browser.w.find('a[href="/settings/data-backup"]').exists()).toBe(false);
    expect(browser.w.find(".workbench-continue").exists()).toBe(false);
    Object.defineProperty(window, "toolboxDesktop", {
      configurable: true,
      value: {}
    });
    const desktop = await home();
    expect(desktop.w.find('a[href="/settings/data-backup"]').exists()).toBe(true);
  });
});
