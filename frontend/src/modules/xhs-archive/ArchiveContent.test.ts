// @vitest-environment happy-dom
/** 使用真实展示组件验证平台原文、身份缺省和编辑版本，不只验证 props 派发。 */
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { NInput, NModal } from "naive-ui";
import { describe, expect, it } from "vitest";
import ArchiveFacts from "./ArchiveFacts.vue";
import BilingualContent from "./BilingualContent.vue";
import TranslationEditModal from "./TranslationEditModal.vue";
import { archiveFixture, translationFixture } from "./__tests__/fixtures";

describe("双平台内容展示与编辑", () => {
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
  it("抖音保留原始正文与字面标记，小红书使用其独有的文本规则", () => {
    const dy = mount(BilingualContent, {
      props: { item: archiveFixture({ platform: "douyin", rawText: "完整[彩虹R] #风景[话题]#" }) }
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
