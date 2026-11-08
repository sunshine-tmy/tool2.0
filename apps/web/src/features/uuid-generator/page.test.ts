// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NCheckbox, NInputNumber, NProgress, NSelect } from "naive-ui";
import Page from "./page.vue";
const mock = vi.hoisted(() => ({
  copy: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  createUrl: vi.fn(),
  revokeUrl: vi.fn(),
  download: vi.fn()
}));
vi.mock("../../shared/utils/clipboard", () => ({ copyTextToClipboard: mock.copy }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => ({ success: mock.success, error: mock.error })
}));
let wrapper: VueWrapper | undefined,
  serial = 0;
const fill = vi.fn((bytes: Uint8Array) => {
  bytes.fill(171);
  for (let i = 0; i < bytes.length; i += 16) new DataView(bytes.buffer).setUint32(i, serial++);
  return bytes;
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  serial = 0;
  fill.mockClear();
  vi.stubGlobal("crypto", { getRandomValues: fill });
  const NativeURL = URL;
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = mock.createUrl;
      static revokeObjectURL = mock.revokeUrl;
    }
  );
  mock.createUrl.mockReturnValue("blob:uuid-result");
  mock.copy.mockResolvedValue(undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    mock.download(this.download, this.href);
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function setup() {
  wrapper = mount(Page, {
    attachTo: document.body,
    global: { stubs: { ToolLayout: { template: "<main><slot/></main>" } } }
  });
  await flushPromises();
  return wrapper;
}
function button(text: string) {
  return wrapper!.findAllComponents(NButton).find((b) => b.text() === text)!;
}
async function click(text: string) {
  await button(text).trigger("click");
  await flushPromises();
}
const output = () => (wrapper!.get("#uuid-output").element as HTMLTextAreaElement).value;
async function quantity(value: number | null) {
  wrapper!.getComponent(NInputNumber).vm.$emit("update:value", value);
  await flushPromises();
}
async function option(name: string, value: string) {
  wrapper!
    .findAllComponents(NSelect)
    .find((c) => c.classes().includes(name))!
    .vm.$emit("update:value", value);
  await flushPromises();
}
async function generate() {
  await click("生成 UUID");
  await vi.runAllTimersAsync();
  await flushPromises();
}
it("opens empty and generates five UUIDs using the LAN-safe source only on request", async () => {
  const w = await setup();
  expect(w.find(".local-badge").exists()).toBe(false);
  expect(output()).toBe("");
  expect(w.getComponent(NInputNumber).props("value")).toBe(5);
  expect(button("复制结果").props("disabled")).toBe(true);
  expect(fill).not.toHaveBeenCalled();
  await generate();
  const ids = output().split("\n");
  expect(ids).toHaveLength(5);
  expect(new Set(ids).size).toBe(5);
  expect(w.text()).toContain("已生成 5 条");
  expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(
    true
  );
  await quantity(10);
  expect(w.text()).toContain("下次生成 10 条");
  expect(output().split("\n")).toEqual(ids);
  expect(fill).toHaveBeenCalledOnce();
});
it("reformats the same identities and copies/downloads the exact current TXT or JSON", async () => {
  const w = await setup();
  await generate();
  const ids = output().split("\n");
  await option("case-select", "upper");
  w.getComponent(NCheckbox).vm.$emit("update:checked", false);
  await flushPromises();
  await option("layout-select", "comma");
  const compact = ids.map((id) => id.replaceAll("-", "").toUpperCase());
  expect(output()).toBe(compact.join(","));
  await click("复制结果");
  expect(mock.copy).toHaveBeenCalledWith(compact.join(","));
  await click("下载结果");
  expect(mock.download).toHaveBeenCalledWith("uuids.txt", "blob:uuid-result");
  expect(await (mock.createUrl.mock.calls[0][0] as Blob).text()).toBe(compact.join(","));
  await option("layout-select", "json");
  expect(JSON.parse(output())).toEqual(compact);
  await click("下载结果");
  expect(mock.download).toHaveBeenLastCalledWith("uuids.json", "blob:uuid-result");
  expect((mock.createUrl.mock.calls[1][0] as Blob).type).toBe("application/json;charset=utf-8");
  expect(JSON.parse(await (mock.createUrl.mock.calls[1][0] as Blob).text())).toEqual(compact);
  expect(fill).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1000);
  expect(mock.revokeUrl).toHaveBeenCalledTimes(2);
});
it("rejects invalid numeric quantities without clamping or losing previous results", async () => {
  const w = await setup();
  await generate();
  const old = output();
  for (const count of [null, 0, -1, 1.5, 10_001]) {
    await quantity(count);
    expect(button("生成 UUID").props("disabled")).toBe(true);
    expect(w.text()).toContain("请输入 1～10,000 的整数数量");
    expect(output()).toBe(old);
  }
  expect(fill).toHaveBeenCalledOnce();
  expect(button("下载结果").props("disabled")).toBe(false);
});
it("shows chunk progress, retains the last complete result after stop and replaces it with the next successful batch", async () => {
  const w = await setup();
  await generate();
  const old = output();
  await quantity(10_000);
  await click("生成 UUID");
  expect(button("复制结果").props("disabled")).toBe(true);
  expect(w.getComponent(NInputNumber).props("disabled")).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  await flushPromises();
  expect(w.text()).toContain("256 / 10,000");
  expect(w.findComponent(NProgress).exists()).toBe(true);
  expect(output()).toBe(old);
  await click("停止");
  expect(w.text()).toContain("仍保留上一次完整的 5 条结果");
  expect(output()).toBe(old);
  await generate();
  const ids = output().split("\n");
  expect(ids).toHaveLength(10_000);
  expect(new Set(ids).size).toBe(10_000);
  expect(w.text()).toContain("已生成 10,000 条");
});
it("reports missing secure randomness, allows retry and surfaces clipboard failure without discarding results", async () => {
  const w = await setup();
  vi.stubGlobal("crypto", {});
  await generate();
  expect(w.text()).toContain("无法使用安全随机数");
  expect(output()).toBe("");
  vi.stubGlobal("crypto", { getRandomValues: fill });
  await generate();
  const old = output();
  mock.copy.mockRejectedValueOnce(Error("blocked"));
  await click("复制结果");
  expect(mock.error).toHaveBeenCalledWith(expect.stringContaining("手动复制"));
  expect(output()).toBe(old);
});
it("clears partial work and releases timers and download URLs on leaving", async () => {
  const w = await setup();
  await generate();
  await click("下载结果");
  await quantity(513);
  await click("生成 UUID");
  await click("清空");
  await vi.runAllTimersAsync();
  await flushPromises();
  expect(output()).toBe("");
  expect(button("复制结果").props("disabled")).toBe(true);
  await click("生成 UUID");
  w.unmount();
  wrapper = undefined;
  await vi.runAllTimersAsync();
  expect(mock.revokeUrl).toHaveBeenCalledWith("blob:uuid-result");
  expect(document.querySelector("#uuid-output")).toBeNull();
});
