// @vitest-environment happy-dom

import { reactive } from "vue";
import { shallowMount } from "@vue/test-utils";
import { NButton } from "naive-ui";
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
