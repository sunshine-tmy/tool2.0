// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NCheckbox, NRadioGroup, NSelect } from "naive-ui";
import Page from "./page.vue";
import { BASE64_LIMITS, processBase64, type Base64Reply, type Base64Request } from "./processor";
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
class WorkerStub {
  onmessage: ((event: MessageEvent<Base64Reply>) => void) | null = null;
  onerror = null;
  request!: Base64Request;
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
  postMessage(request: Base64Request, transfer: Transferable[]) {
    this.request = structuredClone(request, { transfer });
  }
  finish() {
    const result = processBase64(this.request.input, this.request.settings);
    this.onmessage?.({
      data: structuredClone(
        { id: this.request.id, result },
        { transfer: result.ok && result.direction === "decode" ? [result.buffer] : [] }
      )
    } as MessageEvent<Base64Reply>);
  }
}
const workers: WorkerStub[] = [];
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  workers.length = 0;
  vi.stubGlobal("Worker", WorkerStub);
  const NativeURL = URL;
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = mock.createUrl;
      static revokeObjectURL = mock.revokeUrl;
    }
  );
  mock.createUrl.mockReturnValue("blob:base64-result");
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
async function direction(mode: "encode" | "decode") {
  wrapper!
    .findAllComponents(NRadioGroup)
    .find((c) => c.attributes("aria-label") === "编解码方向")!
    .vm.$emit("update:value", mode);
  await flushPromises();
}
async function process(text: string, mode: "encode" | "decode" = "encode") {
  await direction(mode);
  await wrapper!.get("#base64-source").setValue(text);
  await click(mode === "encode" ? "开始编码" : "开始解码");
  workers.at(-1)!.finish();
  await flushPromises();
}
it("opens idle and encodes UTF-8 without changing the input, with URL variant and stale-output protection", async () => {
  const w = await setup();
  expect(w.find(".local-badge").exists()).toBe(false);
  expect(w.text()).toContain("请输入内容");
  expect(button("开始编码").props("disabled")).toBe(true);
  expect(button("复制结果").props("disabled")).toBe(true);
  await process("中文😀");
  expect((w.get("#base64-source").element as HTMLTextAreaElement).value).toBe("中文😀");
  expect((w.get("#base64-output").element as HTMLTextAreaElement).value).toBe(Buffer.from("中文😀").toString("base64"));
  w.getComponent(NSelect).vm.$emit("update:value", "url");
  await flushPromises();
  expect(button("下载结果").props("disabled")).toBe(true);
  await click("开始编码");
  workers.at(-1)!.finish();
  await flushPromises();
  expect((w.get("#base64-output").element as HTMLTextAreaElement).value).toBe(
    Buffer.from("中文😀").toString("base64url")
  );
  await click("复制结果");
  expect(mock.copy).toHaveBeenCalledWith(Buffer.from("中文😀").toString("base64url"));
});
it("downloads text as exact decoded bytes including BOM, and treats invalid UTF-8 as downloadable binary success", async () => {
  const w = await setup();
  const data = Buffer.from("\ufeff中文😀");
  await process(data.toString("base64"), "decode");
  await click("下载结果");
  expect(mock.download).toHaveBeenCalledWith("decoded.txt", "blob:base64-result");
  expect(new Uint8Array(await (mock.createUrl.mock.calls[0][0] as Blob).arrayBuffer())).toEqual(new Uint8Array(data));
  await process("/w==", "decode");
  expect(w.text()).toContain("结果为二进制数据");
  expect(w.find("#base64-output").exists()).toBe(false);
  expect(button("复制结果").props("disabled")).toBe(true);
  expect(button("下载结果").props("disabled")).toBe(false);
  await click("下载结果");
  expect(mock.download).toHaveBeenLastCalledWith("decoded.bin", "blob:base64-result");
  expect(new Uint8Array(await (mock.createUrl.mock.calls.at(-1)![0] as Blob).arrayBuffer())).toEqual(
    new Uint8Array([255])
  );
  await vi.advanceTimersByTimeAsync(1000);
  expect(mock.revokeUrl).toHaveBeenCalledWith("blob:base64-result");
});
it("locates errors in the original wrapped Base64 and never renders decoded HTML", async () => {
  const w = await setup();
  await process("\r\nZg?", "decode");
  expect(w.text()).toContain("第 2 行，第 3 列");
  await click("定位错误");
  const input = w.get("#base64-source").element as HTMLTextAreaElement;
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(input.value.indexOf("?"));
  await process(Buffer.from('<img src=x onerror="alert(1)">').toString("base64"), "decode");
  expect(w.find("img").exists()).toBe(false);
  expect((w.get("#base64-output").element as HTMLTextAreaElement).value).toContain("<img");
  mock.copy.mockRejectedValueOnce(Error("blocked"));
  await click("复制结果");
  expect(mock.error).toHaveBeenCalledWith(expect.stringContaining("手动复制"));
});
it("imports raw files for manual encoding and clears or cancels pending work without late output", async () => {
  const w = await setup(),
    input = w.get("input[type=file]");
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [new File([new Uint8Array([255])], "raw.bin")]
  });
  await input.trigger("change");
  await flushPromises();
  expect(w.text()).toContain("raw.bin");
  expect(w.find("#base64-source").exists()).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(0);
  await click("开始编码");
  const late = workers[0].onmessage!,
    request = workers[0].request;
  await click("停止处理");
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  await click("开始编码");
  workers[1].finish();
  await flushPromises();
  await click("下载结果");
  expect(mock.download).toHaveBeenCalledWith("raw.bin.base64.txt", "blob:base64-result");
  await click("清空");
  late({
    data: { id: request.id, result: processBase64(request.input, request.settings) }
  } as MessageEvent<Base64Reply>);
  await flushPromises();
  expect((w.get("#base64-output").element as HTMLTextAreaElement).value).toBe("");
  w.unmount();
  wrapper = undefined;
  expect(mock.revokeUrl).toHaveBeenCalledWith("blob:base64-result");
});
it("rejects oversized paste without truncation, supports file drop and disables automatic small-text work", async () => {
  const w = await setup();
  await process("f");
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: { getData: () => "a".repeat(BASE64_LIMITS.payloadBytes + 1) }
  });
  w.get("#base64-source").element.dispatchEvent(paste);
  await flushPromises();
  expect(paste.defaultPrevented).toBe(true);
  expect((w.get("#base64-source").element as HTMLTextAreaElement).value).toBe("f");
  expect(w.text()).toContain("已保留当前输入");
  w.findAllComponents(NCheckbox)
    .find((c) => c.text() === "自动处理小文本")!
    .vm.$emit("update:checked", false);
  await direction("decode");
  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: { files: [new File(["Zg=="], "data.b64")] } });
  w.get(".codec-panel").element.dispatchEvent(drop);
  await flushPromises();
  const count = workers.length;
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(count);
  expect((w.get("#base64-source").element as HTMLTextAreaElement).value).toBe("Zg==");
});
