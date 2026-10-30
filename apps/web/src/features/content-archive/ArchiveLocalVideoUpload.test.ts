// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NButton, NModal, NPagination, NProgress, NSelect } from "naive-ui";
import type { ArchiveGroup } from "@toolbox/shared/archive";
import { ApiRequestError } from "../../shared/http/http";
import { archiveFixture } from "./__tests__/fixtures";
import Upload from "./ArchiveLocalVideoUpload.vue";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), confirm: vi.fn(), guard: vi.fn() }));
vi.mock("./content-api", () => ({ uploadLocalArchiveVideo: mocks.upload }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("vue-router", () => ({ onBeforeRouteLeave: (guard: unknown) => mocks.guard(guard) }));
const wrappers: VueWrapper[] = [];
const video = (name: string) => new File(["synthetic video"], name, { type: "video/mp4" });
const result = (id: string, duplicate = false) => ({ item: archiveFixture({ id, platform: "local" }), duplicate });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockReset().mockResolvedValue(result("local-123"));
  mocks.confirm.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});
async function setup(groups: ArchiveGroup[] = []) {
  const modal = defineComponent({
    name: "Modal",
    props: { show: Boolean },
    template: '<section v-if="show"><slot /></section>'
  });
  const wrapper = mount(Upload, {
    props: { groups },
    global: {
      stubs: {
        teleport: true,
        Modal: modal,
        NModal: modal
      }
    }
  });
  wrappers.push(wrapper);
  await button(wrapper, "批量上传视频").trigger("click");
  return wrapper;
}
function button(wrapper: VueWrapper, label: string) {
  return wrapper.findAllComponents(NButton).find((entry) => entry.text() === label)!;
}
async function choose(wrapper: VueWrapper, files: File[]) {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input.element, "files", { configurable: true, value: files });
  await input.trigger("change");
  await flushPromises();
}
describe("本地视频批量上传队列", () => {
  it("整轮固定目标分组，重复项保留原组，下一轮可清空分组选择", async () => {
    const groups = ["素材甲", "素材乙"].map((name, index) => ({
      id: `group-${index}`,
      name,
      createdAt: "2026-10-29T00:00:00.000Z",
      updatedAt: "2026-10-29T00:00:00.000Z"
    }));
    const wrapper = await setup(groups),
      select = wrapper.getComponent(NSelect);
    select.vm.$emit("update:value", groups[0].id);
    let finish!: (value: ReturnType<typeof result>) => void;
    mocks.upload
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      )
      .mockResolvedValueOnce(result("duplicate", true));
    await choose(wrapper, [video("one.mp4"), video("two.mp4")]);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    expect(select.props("disabled")).toBe(true);
    expect(mocks.upload.mock.calls[0][4]).toBe(groups[0].id);
    // Even a programmatic model change cannot change a batch that is already running.
    select.vm.$emit("update:value", groups[1].id);
    finish(result("first"));
    await flushPromises();
    expect(mocks.upload.mock.calls[1][4]).toBe(groups[0].id);
    expect(wrapper.text()).toContain("已归档至“素材甲”");
    expect(wrapper.text()).toContain("保留其当前版本和原分组");
    expect(select.props("disabled")).toBe(false);
    select.vm.$emit("update:value", null);
    await choose(wrapper, [video("ungrouped.mp4")]);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload.mock.calls[2][4]).toBeUndefined();
    expect(wrapper.text()).toContain("已归档至未分组");
  });
  it("删除的目标分组不会显示裸 ID，停止后清空失效选项并提示重选", async () => {
    const wrapper = await setup([
      {
        id: "group-deleted",
        name: "待删除分组",
        createdAt: "2026-10-29T00:00:00.000Z",
        updatedAt: "2026-10-29T00:00:00.000Z"
      }
    ]);
    const select = wrapper.getComponent(NSelect);
    select.vm.$emit("update:value", "group-deleted");
    mocks.upload.mockImplementationOnce(
      (_file, _title, signal: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")), { once: true })
        )
    );
    await choose(wrapper, [video("one.mp4")]);
    await button(wrapper, "开始批量归档").trigger("click");
    await wrapper.setProps({ groups: [] });
    expect(select.props("options")).toEqual([
      { label: "所选分组已删除，请停止后重选", value: "group-deleted", disabled: true }
    ]);
    await button(wrapper, "停止剩余上传").trigger("click");
    await flushPromises();
    expect(select.props("value")).toBeNull();
    expect(select.props("options")).toEqual([]);
    expect(wrapper.text()).toContain("所选归档分组已删除，请重新选择分组");
  });
  it("按顺序逐个上传，上传结束后仍显示校验中，失败只重试自身且复用归档展示明确", async () => {
    const wrapper = await setup(),
      files = [video("one.mp4"), video("two.mp4")];
    let finish!: (value: ReturnType<typeof result>) => void;
    mocks.upload
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      )
      .mockRejectedValueOnce(new Error("network failed"));
    await choose(wrapper, files);
    expect(mocks.upload).not.toHaveBeenCalled();
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    mocks.upload.mock.calls[0][3](100);
    await flushPromises();
    expect(wrapper.text()).toContain("校验视频并生成封面");
    expect(wrapper.emitted("archived")).toBeUndefined();
    finish(result("first-archive"));
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("archived")).toHaveLength(1);
    mocks.upload.mockResolvedValueOnce(result("second-archive", true));
    await button(wrapper, "重试此项").trigger("click");
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload.mock.calls[2][0]).toBe(files[1]);
    expect(wrapper.text()).toContain("复用已存在的归档");
    expect(wrapper.emitted("archived")).toHaveLength(2);
    await button(wrapper, "查看归档").trigger("click");
    expect(wrapper.emitted("openArchive")).toEqual([["first-archive"]]);
  });
  it("超过批次数量拒绝加入，非法文件不能上传或重试，可单独移除", async () => {
    const wrapper = await setup();
    await choose(
      wrapper,
      Array.from({ length: 1001 }, (_, index) => video(`${index}.mp4`))
    );
    expect(wrapper.text()).toContain("每批最多 1000 个");
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
    await choose(wrapper, [new File(["image"], "bad.png")]);
    expect(button(wrapper, "开始批量归档").props("disabled")).toBe(true);
    expect(button(wrapper, "重试失败/已停止项").props("disabled")).toBe(true);
    await button(wrapper, "移除此项").trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("一次接受 1000 个文件，分页只渲染 20 行，累计选择不能突破上限", async () => {
    const wrapper = await setup();
    await choose(
      wrapper,
      Array.from({ length: 1000 }, (_, index) => video(`video-${index + 1}.mp4`))
    );
    expect(wrapper.findAll("tbody tr")).toHaveLength(20);
    expect(wrapper.getComponent(NPagination).props("itemCount")).toBe(1000);
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 1000 条");
    expect(button(wrapper, "开始批量归档").props("disabled")).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
    wrapper.getComponent(NPagination).vm.$emit("update:page", 50);
    await flushPromises();
    expect(wrapper.findAll("tbody tr")).toHaveLength(20);
    expect(wrapper.text()).toContain("video-1000.mp4");
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 1000 条");
    expect(wrapper.text()).not.toContain("video-1.mp4");
    await choose(wrapper, [video("extra.mp4")]);
    expect(wrapper.text()).toContain("请分批选择");
    expect(wrapper.getComponent(NPagination).props("itemCount")).toBe(1000);
    await button(wrapper, "移除此项").trigger("click");
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 999 条");
    await button(wrapper, "清空列表").trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
    expect(wrapper.findComponent(NPagination).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("请分批选择");
  });
  it("700 个文件一次启动后全部按顺序归档，保持单请求在途并只派发一次整轮结束", async () => {
    const wrapper = await setup(),
      files = Array.from({ length: 700 }, (_, index) => video(`item-${index + 1}.mp4`));
    let active = 0,
      maxActive = 0;
    mocks.upload.mockImplementation(async (file: File) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
      return result(`local-${file.name}`);
    });
    await choose(wrapper, files);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    expect(mocks.upload.mock.calls.map((call) => call[0])).toEqual(files);
    expect(maxActive).toBe(1);
    expect(wrapper.emitted("archived")).toHaveLength(700);
    expect(wrapper.emitted("finished")).toEqual([[expect.objectContaining({ id: "local-item-700.mp4" })]]);
    expect(wrapper.text()).toContain("成功 700");
    expect(wrapper.getComponent(NProgress).props("percentage")).toBe(100);
    expect(wrapper.findAll("tbody tr")).toHaveLength(20);
  }, 20000); // This stress fixture renders all 700 sequential responses without real network delays.
  it("删除最后一页仅剩项会返回有效页，不留下空白分页", async () => {
    const wrapper = await setup();
    await choose(
      wrapper,
      Array.from({ length: 21 }, (_, index) => video(`${index}.mp4`))
    );
    wrapper.getComponent(NPagination).vm.$emit("update:page", 2);
    await flushPromises();
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    await button(wrapper, "移除此项").trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(20);
    expect(wrapper.findComponent(NPagination).exists()).toBe(false);
  });
  it("429 自动等待一分钟后重试同一文件，再继续后续文件", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const wrapper = await setup(),
      files = [video("limited.mp4"), video("next.mp4")];
    mocks.upload.mockRejectedValueOnce(new ApiRequestError("限流", { code: "RATE_LIMIT_EXCEEDED", status: 429 }));
    await choose(wrapper, files);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("60 秒后自动重试（1/5）");
    expect(mocks.upload).toHaveBeenCalledOnce();
    mocks.upload.mock.calls[0][3](100);
    await flushPromises();
    expect(wrapper.text()).toContain("等待服务额度");
    expect(wrapper.text()).not.toContain("校验视频并生成封面");
    await vi.advanceTimersByTimeAsync(59000);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("1 秒后自动重试（1/5）");
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();
    expect(mocks.upload.mock.calls.map((call) => call[0])).toEqual([files[0], files[0], files[1]]);
    expect(wrapper.emitted("archived")).toHaveLength(2);
    expect(wrapper.emitted("finished")).toHaveLength(1);
  });
  it("限流等待可以立即停止，之后不会因定时器继续上传", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const wrapper = await setup();
    mocks.upload.mockRejectedValueOnce(new ApiRequestError("繁忙", { code: "ARCHIVE_UPLOAD_BUSY", status: 429 }));
    await choose(wrapper, [video("one.mp4"), video("two.mp4")]);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    await button(wrapper, "停止剩余上传").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("已停止 2");
    expect(wrapper.emitted("finished")).toEqual([[undefined]]);
    await vi.advanceTimersByTimeAsync(120000);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(wrapper.emitted("archived")).toBeUndefined();
  });
  it("限流最多自动重试五次，仍失败时保留手动重试入口", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const wrapper = await setup();
    mocks.upload.mockRejectedValue(new ApiRequestError("限流", { code: "RATE_LIMIT_EXCEEDED", status: 429 }));
    await choose(wrapper, [video("one.mp4")]);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    for (let attempt = 0; attempt < 5; attempt++) {
      await vi.advanceTimersByTimeAsync(60000);
      await flushPromises();
    }
    expect(mocks.upload).toHaveBeenCalledTimes(6);
    expect(wrapper.text()).toContain("失败 1");
    expect(button(wrapper, "重试此项").props("disabled")).toBe(false);
    expect(wrapper.emitted("finished")).toEqual([[undefined]]);
  });
  it("停止会中止当前传输并保留成功项，未开始项可重试，不会继续读取剩余文件", async () => {
    const wrapper = await setup();
    mocks.upload.mockImplementationOnce(
      (_file, _title, signal: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true })
        )
    );
    await choose(wrapper, [video("one.mp4"), video("two.mp4")]);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    const signal = mocks.upload.mock.calls[0][2] as AbortSignal;
    await button(wrapper, "停止剩余上传").trigger("click");
    await flushPromises();
    expect(signal.aborted).toBe(true);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(wrapper.emitted("archived")).toBeUndefined();
    mocks.upload.mockResolvedValue(result("retried"));
    await button(wrapper, "重试失败/已停止项").trigger("click");
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(wrapper.emitted("archived")).toHaveLength(2);
  });
  it("关闭或切页先确认，拒绝离开继续上传；卸载后的响应不更新归档列表", async () => {
    const wrapper = await setup();
    let finish!: (value: ReturnType<typeof result>) => void;
    mocks.upload.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await choose(wrapper, [video("one.mp4")]);
    await button(wrapper, "开始批量归档").trigger("click");
    await flushPromises();
    mocks.confirm.mockResolvedValueOnce(false);
    expect(await mocks.guard.mock.calls[0][0]()).toBe(false);
    expect((mocks.upload.mock.calls[0][2] as AbortSignal).aborted).toBe(false);
    mocks.confirm.mockResolvedValueOnce(false);
    wrapper.getComponent(NModal).vm.$emit("update:show", false);
    await flushPromises();
    expect(wrapper.getComponent(NModal).props("show")).toBe(true);
    wrapper.unmount();
    expect((mocks.upload.mock.calls[0][2] as AbortSignal).aborted).toBe(true);
    finish(result("late-result"));
    await flushPromises();
    expect(wrapper.emitted("archived")).toBeUndefined();
    wrappers.splice(0);
  });
});
