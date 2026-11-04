// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NCheckbox, NRadioGroup, NSelect } from "naive-ui";
import Page from "./page.vue";
import { processUrl, URL_CODEC_LIMITS, type UrlReply, type UrlRequest } from "./processor";
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
  onmessage: ((event: MessageEvent<UrlReply>) => void) | null = null;
  onerror = null;
  request!: UrlRequest;
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
  postMessage(request: UrlRequest) {
    this.request = structuredClone(request);
  }
  finish() {
    this.onmessage?.({
      data: { id: this.request.id, result: processUrl(this.request.source, this.request.settings) }
    } as MessageEvent<UrlReply>);
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
  mock.createUrl.mockReturnValue("blob:url-result");
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
async function process(text: string, direction: "encode" | "decode" = "encode") {
  wrapper!.getComponent(NRadioGroup).vm.$emit("update:value", direction);
  await flushPromises();
  await wrapper!.get("#url-codec-source").setValue(text);
  await click(direction === "encode" ? "开始编码" : "开始解码");
  workers.at(-1)!.finish();
  await flushPromises();
}
const output = () => (wrapper!.get("#url-codec-output").element as HTMLTextAreaElement).value;
it("offers three modes, uses UTF-8 component mode by default, and invalidates stale exports", async () => {
  const w = await setup();
  expect(w.text()).toContain("仅在本地处理");
  expect(button("开始编码").props("disabled")).toBe(true);
  expect(w.getComponent(NSelect).props("options")).toHaveLength(3);
  await process("中文 a+b");
  expect(output()).toBe("%E4%B8%AD%E6%96%87%20a%2Bb");
  await click("复制结果");
  expect(mock.copy).toHaveBeenCalledWith("%E4%B8%AD%E6%96%87%20a%2Bb");
  w.getComponent(NSelect).vm.$emit("update:value", "form");
  await flushPromises();
  expect(w.text()).toContain("只处理一个表单字段");
  expect(button("下载 TXT").props("disabled")).toBe(true);
  await process("a b+c");
  expect(output()).toBe("a+b%2Bc");
  w.getComponent(NSelect).vm.$emit("update:value", "uri");
  await flushPromises();
  await process("https://example.com/中文?q=a b&x=1");
  expect(output()).toBe("https://example.com/%E4%B8%AD%E6%96%87?q=a%20b&x=1");
  await w.get("#url-codec-source").setValue("new");
  expect(button("复制结果").props("disabled")).toBe(true);
});
it("downloads exact UTF-8 text with BOM and CRLF and releases object URLs", async () => {
  await setup();
  await process("%EF%BB%BF%E4%B8%AD%0D%0A%00", "decode");
  await click("下载 TXT");
  expect(mock.download).toHaveBeenCalledWith("url-decoded.txt", "blob:url-result");
  expect(new Uint8Array(await (mock.createUrl.mock.calls[0][0] as Blob).arrayBuffer())).toEqual(
    new Uint8Array(Buffer.from("\ufeff中\r\n\0"))
  );
  await vi.advanceTimersByTimeAsync(1000);
  expect(mock.revokeUrl).toHaveBeenCalledWith("blob:url-result");
  await process(" ");
  await click("下载 TXT");
  expect(mock.download).toHaveBeenLastCalledWith("url-encoded.txt", "blob:url-result");
  wrapper!.unmount();
  wrapper = undefined;
  expect(mock.revokeUrl).toHaveBeenCalledTimes(2);
});
it("locates errors against original text including form plus and keeps decoded markup inert", async () => {
  const w = await setup();
  w.getComponent(NSelect).vm.$emit("update:value", "form");
  await flushPromises();
  await process("😀\r\na+b%GG", "decode");
  expect(w.text()).toContain("第 2 行，第 4 列");
  await click("定位错误");
  const input = w.get("#url-codec-source").element as HTMLTextAreaElement;
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(input.value.indexOf("%"));
  await process("%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E", "decode");
  expect(w.find("img").exists()).toBe(false);
  expect(output()).toBe("<img src=x onerror=alert(1)>");
  mock.copy.mockRejectedValueOnce(Error("blocked"));
  await click("复制结果");
  expect(mock.error).toHaveBeenCalledWith(expect.stringContaining("手动复制"));
});
it("can stop and clear without accepting late results, and releases pending work on unmount", async () => {
  const w = await setup();
  await w.get("#url-codec-source").setValue("x y");
  await click("开始编码");
  const late = workers[0].onmessage!,
    request = workers[0].request;
  await click("停止处理");
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  await click("清空");
  late({ data: { id: request.id, result: processUrl(request.source, request.settings) } } as MessageEvent<UrlReply>);
  await flushPromises();
  expect(output()).toBe("");
  await w.get("#url-codec-source").setValue("new");
  await click("开始编码");
  w.unmount();
  wrapper = undefined;
  expect(workers[1].terminate).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(6000);
  expect(workers).toHaveLength(2);
  expect(document.querySelector("#url-codec-source")).toBeNull();
});
it("preserves current input on oversized paste, and obeys the automatic toggle", async () => {
  const w = await setup();
  await process("keep");
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: { getData: () => "a".repeat(URL_CODEC_LIMITS.inputBytes + 1) }
  });
  w.get("#url-codec-source").element.dispatchEvent(paste);
  await flushPromises();
  expect(paste.defaultPrevented).toBe(true);
  expect((w.get("#url-codec-source").element as HTMLTextAreaElement).value).toBe("keep");
  expect(w.text()).toContain("已保留当前输入");
  w.getComponent(NCheckbox).vm.$emit("update:checked", false);
  await w.get("#url-codec-source").setValue("a b");
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(1);
  w.getComponent(NCheckbox).vm.$emit("update:checked", true);
  await vi.advanceTimersByTimeAsync(300);
  workers[1].finish();
  await flushPromises();
  expect(output()).toBe("a%20b");
});
