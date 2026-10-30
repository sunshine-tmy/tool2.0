// @vitest-environment happy-dom
/** 使用真实展示组件验证平台原文、身份缺省和编辑版本，不只验证 props 派发。 */
import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { NDrawer, NDrawerContent, NInput, NModal } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import ArchiveFacts from "./ArchiveFacts.vue";
import BilingualContent from "./BilingualContent.vue";
import TranslationEditModal from "./TranslationEditModal.vue";
import { archiveFixture, translationFixture } from "./__tests__/fixtures";
import { formatArchiveDate } from "./format-date";
import { copyTextToClipboard } from "../../shared/utils/clipboard";

describe("双平台内容展示与编辑", () => {
  it("真实抽屉的焦点约束下连续复制三项及切换作品仍复制所点击的当前字段", async () => {
    const item = ref(
      archiveFixture({
        platform: "tiktok",
        title: "当前标题",
        rawText: "当前正文",
        topics: [{ id: "tea", source: "Tea" }]
      })
    );
    const clipboard = { writeText: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) };
    const copied: string[] = [];
    const original = Object.getOwnPropertyDescriptor(document, "execCommand");
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => {
        const selected = document.activeElement;
        copied.push(selected instanceof HTMLTextAreaElement ? selected.value : "wrong selection");
        return true;
      }
    });
    let pending: Promise<void> = Promise.resolve();
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            NDrawer,
            { show: true },
            {
              default: () =>
                h(
                  NDrawerContent,
                  { title: "存档详情", closable: true },
                  {
                    default: () =>
                      h(BilingualContent, {
                        item: item.value,
                        onCopy: (text) => {
                          pending = copyTextToClipboard(text, { clipboard });
                        }
                      })
                  }
                )
            }
          )
      }),
      { attachTo: document.body, global: { stubs: { transition: false } } }
    );
    try {
      await flushPromises();
      const copy = async (label: string) => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (button) => button.textContent?.trim() === label
        )!;
        button.focus();
        expect(document.activeElement).toBe(button);
        button.click();
        await pending;
        expect(document.activeElement).toBe(button);
      };
      await copy("复制标题");
      await copy("复制正文");
      await copy("复制话题");
      item.value = archiveFixture({
        platform: "douyin",
        title: "另一个标题",
        rawText: "另一篇正文",
        topics: [{ id: "herb", source: "Herb" }]
      });
      await flushPromises();
      await copy("复制话题");
      await copy("复制正文");
      await copy("复制标题");
      expect(copied).toEqual(["当前标题", "当前正文", "#Tea", "#Herb", "另一篇正文", "另一个标题"]);
    } finally {
      wrapper.unmount();
      if (original) Object.defineProperty(document, "execCommand", original);
      else Reflect.deleteProperty(document, "execCommand");
    }
  });
  it.each(["xiaohongshu", "douyin", "tiktok"] as const)(
    "%s 分别复制当前展示的标题、正文和带 # 的全部话题",
    async (platform) => {
      const item =
        platform === "xiaohongshu"
          ? archiveFixture()
          : archiveFixture({
              platform,
              rawText: "完整原文\n第二行 #Tea [微笑R]",
              topics: [
                { id: "tea", source: "Tea" },
                { id: "herb", source: "Herb" }
              ],
              translation: translationFixture()
            });
      const wrapper = mount(BilingualContent, { props: { item, compact: true } });
      for (const label of ["复制标题", "复制正文", "复制话题"]) {
        const button = wrapper.findAll("button").find((button) => button.text() === label)!;
        expect(button.element.closest(".bilingual-section-head")).not.toBeNull();
        await button.trigger("click");
      }
      expect(wrapper.emitted("copy")).toEqual(
        platform === "xiaohongshu"
          ? [
              ["日落🙂", "标题"],
              ["晚霞", "正文"],
              ["#风景", "话题"]
            ]
          : [
              ["日落[微笑R]", "标题"],
              ["完整原文\n第二行 #Tea [微笑R]", "正文"],
              ["#Tea #Herb", "话题"]
            ]
      );
      await wrapper.setProps({
        item: archiveFixture({ platform: "tiktok", title: "新作品", rawText: "新正文", topics: [] })
      });
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "复制正文")!
        .trigger("click");
      expect(wrapper.emitted("copy")?.at(-1)).toEqual(["新正文", "正文"]);
      expect(wrapper.findAll("button").some((button) => button.text() === "复制话题")).toBe(false);
      wrapper.unmount();
    }
  );
  it("空标题不可复制，缺少正文与话题时不展示对应按钮", async () => {
    const wrapper = mount(BilingualContent, {
      props: { item: archiveFixture({ title: "", description: undefined, topics: [] }) }
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.attributes("disabled")).toBeDefined();
    await buttons[0]!.trigger("click");
    expect(wrapper.emitted("copy")).toBeUndefined();
    wrapper.unmount();
  });
  it.each(["xiaohongshu", "douyin"] as const)("%s 显示真实作品身份，未知作者和缺失时间不编造", (platform) => {
    const item = archiveFixture({ platform });
    const wrapper = mount(ArchiveFacts, { props: { item, formatDate: () => "存档时间夹具" } });
    expect(wrapper.text()).toContain(platform === "douyin" ? "抖音" : "小红书");
    expect(wrapper.text()).toContain(item.contentId);
    expect(wrapper.text()).toContain("未知");
    expect(wrapper.text()).not.toContain("发布时间");
    expect(wrapper.get("a").attributes("rel")).toBe("noopener noreferrer");
    wrapper.unmount();
  });
  it("发布时间独立显示，不替代归档时间", () => {
    const wrapper = mount(ArchiveFacts, {
      props: {
        item: archiveFixture({ author: { name: "作者" }, publishedAt: "2026-09-01T00:00:00.000Z" }),
        formatDate: (value) => value
      }
    });
    expect(wrapper.text()).toContain("发布时间");
    expect(wrapper.text()).toContain("2026-09-01");
    expect(wrapper.text()).toContain("作者");
    wrapper.unmount();
  });
  it("打开旧归档时安全展示无法识别的发布时间，不让详情渲染崩溃", () => {
    const wrapper = mount(ArchiveFacts, {
      props: {
        item: archiveFixture({ publishedAt: "unavailable" }),
        formatDate: formatArchiveDate
      }
    });
    expect(wrapper.text()).toContain("发布时间");
    expect(wrapper.text()).toContain("未知");
    wrapper.unmount();
  });
  it.each(["douyin", "tiktok"] as const)("%s 保留原始正文与字面标记，小红书使用其独有的文本规则", (platform) => {
    const dy = mount(BilingualContent, {
      props: { item: archiveFixture({ platform, rawText: "完整[彩虹R] #风景[话题]#" }) }
    });
    expect(dy.get(".source-body").text()).toBe("完整[彩虹R] #风景[话题]#");
    expect(dy.get("h3").text()).toBe("日落[微笑R]");
    dy.unmount();
    const xhs = mount(BilingualContent, { props: { item: archiveFixture({ translation: translationFixture() }) } });
    expect(xhs.get("h3").text()).toBe("日落🙂");
    expect(xhs.get(".source-body").text()).toBe("晚霞");
    expect(xhs.text()).toContain("Golden evening");
    xhs.unmount();
  });
  it("打开后固定 sourceHash，刷新同一归档不能偷偷提交新版本哈希", async () => {
    const wrapper = mount(TranslationEditModal, {
      props: { show: true, item: archiveFixture({ translation: translationFixture() }) },
      global: {
        stubs: {
          Teleport: true,
          "n-modal": defineComponent({ template: "<div><slot/><slot name='footer'/></div>" }),
          NModal: defineComponent({ template: "<div><slot/><slot name='footer'/></div>" }),
          NForm: defineComponent({ template: "<div><slot/></div>" }),
          NFormItem: defineComponent({ template: "<div><slot/></div>" }),
          NInput: true,
          NButton: defineComponent({ template: "<button><slot/></button>" })
        }
      }
    });
    const changed = archiveFixture({ translation: { ...translationFixture(), sourceHash: "b".repeat(64) } });
    await wrapper.setProps({ item: changed });
    expect(wrapper.html()).toContain("保存英文");
    const inputs = wrapper.findAllComponents(NInput);
    inputs[0]!.vm.$emit("update:value", "New edited title");
    inputs[1]!.vm.$emit("update:value", "New edited body");
    inputs[2]!.vm.$emit("update:value", "New topic");
    const save = wrapper.findAll("button").find((button) => button.text() === "保存英文")!;
    await save.trigger("click");
    expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject({
      sourceHash: "a".repeat(64),
      title: { edited: "New edited title" }
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "取消")!
      .trigger("click");
    wrapper.findComponent(NModal).vm.$emit("update:show", false);
    expect(wrapper.emitted("update:show")).toEqual([[false], [false]]);
    wrapper.unmount();
  });
});
