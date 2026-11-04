// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NCheckbox, NSelect } from "naive-ui";
import Page from "./page.vue";
import { JSON_LIMITS, processJson, type JsonWorkerReply, type JsonWorkerRequest } from "./processor";
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
  onmessage: ((event: MessageEvent<JsonWorkerReply>) => void) | null = null;
  onerror = null;
  request!: JsonWorkerRequest;
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
  postMessage(request: JsonWorkerRequest) {
    this.request = request;
  }
  finish() {
    this.onmessage?.({
      data: { id: this.request.id, result: processJson(this.request.text, this.request) }
    } as MessageEvent<JsonWorkerReply>);
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
  mock.createUrl.mockReturnValue("blob:json-result");
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
async function process(text: string, action = "格式化") {
  await wrapper!.get("#json-source").setValue(text);
  await click(action);
  workers.at(-1)!.finish();
  await flushPromises();
}
it("shows an idle local-only editor, supports formatting options and keeps original input unchanged", async () => {
  const w = await setup();
  expect(w.text()).toContain("仅在本地处理");
  expect(w.text()).toContain("请输入 JSON");
  expect(w.find('[role="alert"]').exists()).toBe(false);
  expect(button("复制结果").props("disabled")).toBe(true);
  w.getComponent(NSelect).vm.$emit("update:value", "tab");
  await process('{"id":9007199254740993}');
  expect((w.get("#json-source").element as HTMLTextAreaElement).value).toBe('{"id":9007199254740993}');
  expect((w.get("#json-output").element as HTMLTextAreaElement).value).toBe('{\n\t"id": 9007199254740993\n}');
  await click("压缩");
  workers.at(-1)!.finish();
  await flushPromises();
  expect((w.get("#json-output").element as HTMLTextAreaElement).value).toBe('{"id":9007199254740993}');
});
it("copies only fresh output, downloads exact UTF-8 JSON and releases download URLs", async () => {
  await setup();
  await process('{"中文":"😀"}');
  const expected = '{\n  "中文": "😀"\n}';
  await click("复制结果");
  expect(mock.copy).toHaveBeenCalledWith(expected);
  await click("下载 JSON");
  expect(mock.download).toHaveBeenCalledWith("formatted.json", "blob:json-result");
  expect(await (mock.createUrl.mock.calls[0][0] as Blob).text()).toBe(expected);
  await vi.advanceTimersByTimeAsync(1000);
  expect(mock.revokeUrl).toHaveBeenCalledWith("blob:json-result");
  await wrapper!.get("#json-source").setValue("[1,]");
  expect(button("复制结果").props("disabled")).toBe(true);
  expect(button("下载 JSON").props("disabled")).toBe(true);
  expect(wrapper!.text()).toContain("旧结果");
  await click("清空");
  expect((wrapper!.get("#json-output").element as HTMLTextAreaElement).value).toBe("");
});
it("locates syntax errors and provides an actionable clipboard failure without executing source markup", async () => {
  const w = await setup();
  await process('{\n"x": ]}');
  expect(w.text()).toContain("第 2 行，第 6 列");
  await click("定位错误");
  const input = w.get("#json-source").element as HTMLTextAreaElement;
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(7);
  const key = "<img src=x onerror=alert(1)>";
  await process(`{"${key}":0,"${key}":1}`);
  expect(w.text()).toContain("重复字段");
  expect(w.find("img").exists()).toBe(false);
  mock.copy.mockRejectedValueOnce(Error("denied"));
  await click("复制结果");
  expect(mock.error).toHaveBeenCalledWith(expect.stringContaining("手动复制"));
});
it("imports a local file, offers cancellation and ignores late worker output after clear", async () => {
  const w = await setup(),
    input = w.get("input[type=file]");
  Object.defineProperty(input.element, "files", { configurable: true, value: [new File(["null"], "数据.json")] });
  await input.trigger("change");
  await flushPromises();
  expect((w.get("#json-source").element as HTMLTextAreaElement).value).toBe("null");
  await click("格式化");
  const late = workers.at(-1)!.onmessage!,
    request = workers.at(-1)!.request;
  await click("停止处理");
  expect(workers.at(-1)!.terminate).toHaveBeenCalledOnce();
  await click("格式化");
  workers.at(-1)!.finish();
  await flushPromises();
  await click("下载 JSON");
  expect(mock.download).toHaveBeenCalledWith("数据.json", "blob:json-result");
  await click("清空");
  late({ data: { id: request.id, result: processJson(request.text, request) } } as MessageEvent<JsonWorkerReply>);
  await flushPromises();
  expect((w.get("#json-output").element as HTMLTextAreaElement).value).toBe("");
  w.unmount();
  wrapper = undefined;
  expect(mock.revokeUrl).toHaveBeenCalledWith("blob:json-result");
});
it("rejects oversized paste without truncation, supports file drop and disables automatic processing", async () => {
  const w = await setup();
  await process("1");
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", { value: { getData: () => "a".repeat(JSON_LIMITS.inputBytes + 1) } });
  w.get("#json-source").element.dispatchEvent(paste);
  await flushPromises();
  expect(paste.defaultPrevented).toBe(true);
  expect(w.text()).toContain("已保留当前输入");
  expect((w.get("#json-source").element as HTMLTextAreaElement).value).toBe("1");
  w.getComponent(NCheckbox).vm.$emit("update:checked", false);
  await flushPromises();
  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: { files: [new File(["[]"], "drop.txt")] } });
  w.get(".json-panel").element.dispatchEvent(drop);
  await flushPromises();
  const count = workers.length;
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(count);
  expect((w.get("#json-source").element as HTMLTextAreaElement).value).toBe("[]");
});
