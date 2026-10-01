// @vitest-environment happy-dom
/** 展示组件的真实按钮/输入事件：验证管理动作、媒体导航、平台筛选与双语状态。 */
import { mount } from "@vue/test-utils";
import { NSelect, NInput, NCheckbox, NDrawer } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import ArchiveListPanel from "./ArchiveListPanel.vue";
import XhsResultPanel from "./XhsResultPanel.vue";
import XhsDetailDrawer from "./XhsDetailDrawer.vue";
import MediaGallery from "./MediaGallery.vue";
import BilingualContent from "./BilingualContent.vue";
import { archiveFixture, listFixture, translationFixture } from "./__tests__/fixtures";

describe("归档组件交互", () => {
  it("平台徽标不替代类型，媒体封面与工具栏事件可用", async () => {
    const fixtures = [
      archiveFixture({ id: "one", platform: "douyin" }),
      archiveFixture({ id: "two", type: "live-photo" }),
      archiveFixture({ id: "three", type: "image" })
    ];
    const archives = listFixture(fixtures);
    archives.items[0]!.coverUrl = "/video.mp4";
    archives.items[0]!.coverKind = "video";
    archives.items[1]!.coverUrl = "/cover.png";
    archives.items[1]!.coverKind = "image";
    const wrapper = mount(ArchiveListPanel, {
      props: {
        archives,
        listLoading: false,
        selectedIds: ["one"],
        keyword: "",
        typeFilter: "all",
        platformFilter: "all",
        page: 1
      }
    });
    expect(wrapper.findAll(".card-platform-badge").map((badge) => badge.text())).toEqual(["抖音", "小红书", "小红书"]);
    expect(wrapper.findAll(".card-type-badge").map((badge) => badge.text())).toEqual(["视频", "Live Photo", "图文"]);
    const selects = wrapper.findAllComponents(NSelect);
    selects[0]!.vm.$emit("update:value", "video");
    selects[1]!.vm.$emit("update:value", "douyin");
    expect(wrapper.emitted("update:typeFilter")).toEqual([["video"]]);
    expect(wrapper.emitted("update:platformFilter")).toEqual([["douyin"]]);
    wrapper.findComponent(NInput).vm.$emit("update:value", "晚霞");
    expect(wrapper.emitted("update:keyword")).toEqual([["晚霞"]]);
    wrapper.findComponent(NCheckbox).vm.$emit("update:checked", true);
    expect(wrapper.emitted("toggleSelectAll")).toEqual([[true]]);
    for (const text of ["刷新", "删除所选", "翻译所选"])
      await wrapper
        .findAll("button")
        .find((button) => button.text().includes(text))!
        .trigger("click");
    expect(wrapper.emitted("refresh")).toHaveLength(1);
    expect(wrapper.emitted("removeSelected")).toHaveLength(1);
    expect(wrapper.emitted("translateSelected")).toHaveLength(1);
    const video = wrapper.get("video");
    Object.defineProperty(video.element, "duration", { configurable: true, value: 1 });
    await video.trigger("loadedmetadata");
    expect((video.element as HTMLVideoElement).currentTime).toBe(0.1);
    await video.trigger("loadedmetadata");
    expect((video.element as HTMLVideoElement).currentTime).toBe(0.1);
    wrapper.unmount();
  });
  it("结果区复制三种文案、编辑/恢复和截帧事件均传入原归档", async () => {
    const item = archiveFixture({ platform: "douyin", translation: translationFixture(), warnings: ["验收提示"] });
    const copy = vi.fn(),
      edit = vi.fn(),
      reset = vi.fn();
    const wrapper = mount(XhsResultPanel, {
      props: {
        current: item,
        refreshing: false,
        copyDescription: vi.fn(),
        copyCurrent: copy,
        zipUrl: () => "/zip",
        refreshItem: vi.fn(),
        translateCurrent: vi.fn(),
        editTranslation: edit,
        resetTranslation: reset,
        hasEdited: () => true,
        formatDate: () => "时间"
      },
      global: { stubs: { MediaGallery: true } }
    });
    for (const text of ["复制中文", "复制英文", "复制中英双语", "编辑英文", "恢复机器翻译"])
      await wrapper
        .findAll("button")
        .find((button) => button.text() === text)!
        .trigger("click");
    expect(copy.mock.calls.map(([language]) => language)).toEqual(["zh", "en", "both"]);
    expect(edit).toHaveBeenCalledWith(item);
    expect(reset).toHaveBeenCalledWith(item);
    wrapper.findComponent(MediaGallery).vm.$emit("frameSaved", item);
    expect(wrapper.emitted("frameSaved")?.[0]).toEqual([item]);
    expect(wrapper.text()).toContain("验收提示");
    wrapper.unmount();
  });
  it("详情抽屉编辑/恢复/关闭事件与媒体更新不丢失", async () => {
    const item = archiveFixture({ translation: translationFixture() });
    const edit = vi.fn(),
      reset = vi.fn();
    const wrapper = mount(XhsDetailDrawer, {
      props: {
        open: true,
        width: 720,
        detail: item,
        formatDate: () => "时间",
        removeItem: vi.fn(),
        translateDetail: vi.fn(),
        editTranslation: edit,
        resetTranslation: reset,
        hasEdited: () => true,
        zipUrl: () => "/zip"
      },
      global: { stubs: { Teleport: true, MediaGallery: true } }
    });
    for (const text of ["编辑英文", "恢复机器翻译"])
      await wrapper
        .findAll("button")
        .find((button) => button.text() === text)!
        .trigger("click");
    expect(edit).toHaveBeenCalledWith(item);
    expect(reset).toHaveBeenCalledWith(item);
    wrapper.findComponent(MediaGallery).vm.$emit("frameSaved", item);
    expect(wrapper.emitted("frameSaved")?.[0]).toEqual([item]);
    wrapper.findComponent(NDrawer).vm.$emit("update:show", false);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    wrapper.unmount();
  });
  it.each(["ready", "failed", "queued", "installing", "stale", "translating"] as const)(
    "翻译 %s 的状态和失败反馈可辨认",
    (status) => {
      const item = archiveFixture({
        topics: [{ id: "topic-1", source: "风景" }],
        translation: {
          ...translationFixture(),
          status,
          error: status === "failed" ? { code: "TEST_FAILED", message: "模型不可用" } : undefined
        }
      });
      const wrapper = mount(BilingualContent, { props: { item } });
      expect(wrapper.get(".translation-status").text()).not.toBe("");
      expect(wrapper.text()).toContain("Landscape");
      if (status === "failed") expect(wrapper.text()).toContain("模型不可用");
      wrapper.unmount();
    }
  );
});
