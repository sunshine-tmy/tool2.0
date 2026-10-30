// @vitest-environment happy-dom

import { reactive } from "vue";
import { shallowMount } from "@vue/test-utils";
import { NButton, NInput, NModal, NCard } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import OrderedSpeechEditor from "./OrderedSpeechEditor.vue";
import { orderedSpeechEditorKey, useOrderedSpeechEditor } from "./useOrderedSpeechEditor";

const bilingualSegments = [
  {
    text: "Terima kasih kepada semua yang bersama kami dalam live hari ini.",
    referenceTranslation: "感谢今天所有陪伴我们观看直播的朋友。"
  },
  {
    text: "Harap sesi hari ini membantu anda mengenali produk Tang Tea dengan lebih jelas.",
    referenceTranslation: "希望今天的直播能帮助大家更清楚地了解 Tang Tea 的产品。"
  },
  {
    text: "Kalau berminat, anda masih boleh semak produk yang dipaparkan pada halaman Shopee kami.",
    referenceTranslation: "如果感兴趣，大家仍然可以查看我们 Shopee 店铺中展示的商品。"
  },
  {
    text: "Terima kasih atas sokongan anda, dan jumpa lagi dalam live yang akan datang!",
    referenceTranslation: "感谢大家的支持，我们下次直播再见！"
  }
];

describe("Ordered speech smart segmentation", () => {
  it("edits local fields, reorders and duplicates without submitting, and closes the parser dialog", async () => {
    const editor = reactive(
      useOrderedSpeechEditor({
        message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
        confirm: vi.fn().mockResolvedValue(true),
        isSubmitting: () => false
      })
    );
    const wrapper = shallowMount(OrderedSpeechEditor, {
      props: { submitting: false, languageLabel: "马来语" },
      global: {
        renderStubDefaultSlot: true,
        provide: { [orderedSpeechEditorKey as symbol]: editor },
        stubs: {
          NCard: { template: "<section><slot/><slot name='footer'/></section>" },
          Card: { template: "<section><slot/><slot name='footer'/></section>" }
        }
      }
    });
    const click = async (label: string) => {
      const control = wrapper
        .findAllComponents(NButton)
        .find((button) => button.attributes("title") === label || button.text() === label);
      if (!control) throw new Error(`Missing ${label}`);
      control.vm.$emit("click");
      await wrapper.vm.$nextTick();
    };
    try {
      wrapper.findAllComponents(NInput)[0].vm.$emit("update:value", "Draft batch");
      const fields = wrapper.get(".segment-fields").findAllComponents(NInput);
      ["First text", "第一段", "first"].forEach((value, index) => fields[index].vm.$emit("update:value", value));
      expect(editor.batchName).toBe("Draft batch");
      expect(editor.segments[0]).toMatchObject({
        text: "First text",
        referenceTranslation: "第一段",
        fileName: "first"
      });
      await click("添加一段");
      await click("复制");
      expect(editor.segments).toHaveLength(3);
      await click("下移");
      await click("上移");
      await wrapper.findAll(".segment-order")[0].trigger("dragstart");
      await wrapper.findAll(".segment-editor-card")[1].trigger("dragover");
      await wrapper.findAll(".segment-editor-card")[1].trigger("drop");
      await wrapper.findAll(".segment-order")[0].trigger("dragend");
      expect(editor.dragId).toBe("");
      expect(editor.segments.map((item) => item.text)).toEqual(["First text", "First text", ""]);
      await click("删除");
      expect(editor.segments).toHaveLength(2);
      await click("智能识别分段");
      expect(editor.autoVisible).toBe(true);
      wrapper.getComponent(NModal).vm.$emit("update:show", false);
      expect(editor.autoVisible).toBe(false);
      editor.autoVisible = true;
      wrapper.getComponent(NCard).vm.$emit("close");
      expect(editor.autoVisible).toBe(false);
      const auto = wrapper
        .findAllComponents(NInput)
        .find((input) => String(input.props("placeholder")).startsWith("1. Hello"))!;
      auto.vm.$emit("update:value", "Hello.\n你好。");
      expect(editor.autoText).toBe("Hello.\n你好。");
      const textarea = document.createElement("textarea");
      const paste = new Event("paste", { cancelable: true });
      Object.defineProperty(paste, "target", { value: textarea });
      Object.defineProperty(paste, "clipboardData", {
        value: { getData: (type: string) => (type === "text/plain" ? "**1. Hello.**\r\n你好。" : "") }
      });
      auto.vm.$emit("paste", paste);
      expect(paste.defaultPrevented).toBe(true);
      expect(editor.autoText).toBe("1. Hello.\n你好。");
      expect(editor.parsed).toEqual([{ text: "Hello.", referenceTranslation: "你好。" }]);
      editor.autoVisible = true;
      await click("取消");
      expect(editor.autoVisible).toBe(false);
      await click("清空当前批次内容");
      await Promise.resolve();
      expect(editor.batchName).toBe("");
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps numbering separate from complete bilingual preview content and fills all four segments", async () => {
    const editor = reactive(
      useOrderedSpeechEditor({
        message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
        confirm: vi.fn().mockResolvedValue(true),
        isSubmitting: () => false
      })
    );
    editor.autoVisible = true;
    editor.autoText = bilingualSegments
      .map((item, index) => `${index + 1}. ${item.text}\n${item.referenceTranslation}`)
      .join("\n\n");
    const wrapper = shallowMount(OrderedSpeechEditor, {
      props: { submitting: false, languageLabel: "马来语" },
      global: {
        renderStubDefaultSlot: true,
        provide: { [orderedSpeechEditorKey as symbol]: editor },
        stubs: {
          NCard: { template: "<section><slot/><slot name='footer'/></section>" },
          Card: { template: "<section><slot/><slot name='footer'/></section>" }
        }
      }
    });

    try {
      const rows = wrapper.findAll(".auto-segment-preview > li");
      expect(rows).toHaveLength(4);
      rows.forEach((row, index) => {
        // The first grid column is only 28px wide: it must contain the index, not the text.
        expect(row.element.children[0].classList.contains("auto-segment-index")).toBe(true);
        expect(row.find(".auto-segment-index").text()).toBe(`${index + 1}.`);
        expect(row.find("div > span").text()).toBe(bilingualSegments[index].text);
        expect(row.find("div > small").text()).toBe(bilingualSegments[index].referenceTranslation);
      });
      expect(editor.parsed).toEqual(bilingualSegments);

      wrapper
        .findAllComponents(NButton)
        .find((button) => button.text() === "识别并填入")!
        .vm.$emit("click");
      await wrapper.vm.$nextTick();
      expect(editor.segments.map(({ text, referenceTranslation }) => ({ text, referenceTranslation }))).toEqual(
        bilingualSegments
      );
      expect(editor.autoVisible).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
});
