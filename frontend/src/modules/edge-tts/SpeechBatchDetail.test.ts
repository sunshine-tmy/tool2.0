// @vitest-environment happy-dom

import { reactive } from "vue";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shallowMount } from "@vue/test-utils";
import { NInput, NInputNumber, NTag } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import ChatterboxBatchDetail from "./ChatterboxBatchDetail.vue";
import EdgeTtsBatchDetail from "./EdgeTtsBatchDetail.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";
import { edgeTtsPanelKey } from "./edge-tts-panel-context";
import SpeechDetailItemActions from "./SpeechDetailItemActions.vue";
import SpeechBatchDownloads from "./SpeechBatchDownloads.vue";
import SaveToAudioLibrary from "../audio-library/SaveToAudioLibrary.vue";
import { taskTagType } from "./speech-batch-display";

describe("Shared detail form spacing", () => {
  it("uses a single field gap without stacking legacy row margins", () => {
    const css = readFileSync(resolve("src/modules/edge-tts/ChatterboxPanel.css"), "utf8");
    expect(css).toMatch(/\.detail-item-form\s*\{[^}]*display: grid;[^}]*gap: 12px;/);
    expect(css).toMatch(
      /\.detail-item-parameters label\s*\{[^}]*grid-template-columns: max-content minmax\(0, var\(--detail-parameter-width, 120px\)\);[^}]*align-items: center;/
    );
    expect(css).toMatch(/\.detail-item-parameters\s*\{[^}]*gap: 12px 24px;/);
    expect(css).toMatch(/\.detail-item-parameter--seed\s*\{\s*--detail-parameter-width: 140px;/);
    expect(css).toMatch(/\.detail-item-parameters--clone\s*\{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  });
});

describe.each([
  { engine: "chatterbox", component: ChatterboxBatchDetail, key: chatterboxPanelKey },
  { engine: "edge-tts", component: EdgeTtsBatchDetail, key: edgeTtsPanelKey }
])("$engine batch detail actions", ({ engine, component, key }) => {
  it("shares both toolbars and preserves engine-specific move, regenerate and delete behavior", async () => {
    const items = [1, 2].map((index) => ({ id: `item-${index}`, status: "completed", text: `Text ${index}` }));
    const batch = {
      id: "batch-1",
      status: "completed",
      items,
      referenceAvailable: false,
      createdAt: "2026-10-19T00:00:00Z"
    };
    const drafts = Object.fromEntries(
      items.map((item) => [item.id, { text: item.text, referenceTranslation: "中文", fileName: "" }])
    );
    const panel = reactive({
      detailVisible: true,
      detailBatch: batch,
      detail: batch,
      orderedDetailItems: items,
      itemDrafts: drafts,
      drafts,
      selectedItems: [],
      retryVoiceOptions: [],
      busy: false,
      regeneratingItemId: "",
      isBatchRunning: () => false,
      batchTitle: () => "测试批次",
      title: () => "测试批次",
      batchStatusLabel: () => "已完成",
      statusLabel: () => "已完成",
      taskStatusLabel: () => "已完成",
      taskTagType,
      formatDuration: () => "10 秒",
      moveDetailItem: vi.fn(),
      moveItem: vi.fn(),
      regenerateItem: vi.fn(),
      regenerate: vi.fn(),
      removeBatchItem: vi.fn(),
      removeItem: vi.fn()
    });
    const wrapper = shallowMount(component, {
      global: { renderStubDefaultSlot: true, provide: { [key as symbol]: panel } }
    });
    try {
      expect(wrapper.getComponent(SaveToAudioLibrary).props("toolbar")).toBe(true);
      expect(wrapper.getComponent(SpeechBatchDownloads).props("toolbar")).toBe(true);
      expect(wrapper.getComponent(SpeechBatchDownloads).props("archiveOnly")).toBe(false);
      const forms = wrapper.findAll(".detail-item-form");
      expect(forms).toHaveLength(2);
      for (const form of forms) {
        expect(form.element.children).toHaveLength(4);
        expect(form.findAllComponents(NInput)).toHaveLength(3);
        expect(form.find(".detail-item-parameters").exists()).toBe(true);
        const labels = form.findAll(".detail-item-parameters > label");
        expect(labels.map((label) => label.get("span").text())).toEqual(
          engine === "chatterbox" ? ["情绪强度", "随机种子", "音色遵循", "随机度"] : ["语速 %", "音量 %", "音调 Hz"]
        );
        labels.forEach((label) => expect(label.findComponent(NInputNumber).exists()).toBe(true));
        if (engine === "chatterbox") {
          expect(form.find(".detail-item-parameters--clone").exists()).toBe(true);
          expect(labels[1].classes()).toContain("detail-item-parameter--seed");
          expect(labels[1].getComponent(NInputNumber).props()).toMatchObject({ min: 0, max: 2147483647, precision: 0 });
        }
      }
      for (const [status, type] of [
        ["completed", "success"],
        ["queued", "warning"],
        ["processing", "warning"],
        ["failed", "error"],
        ["cancelled", "error"]
      ]) {
        panel.detail.items[0].status = status;
        await wrapper.vm.$nextTick();
        expect(wrapper.findAllComponents(NTag)[0].props("type")).toBe(type);
      }
      panel.detail.items[0].status = "completed";
      await wrapper.vm.$nextTick();
      const actions = wrapper.findAllComponents(SpeechDetailItemActions);
      expect(actions).toHaveLength(2);
      expect(actions[0].props()).toMatchObject({
        engine,
        disableMoveUp: true,
        disableMoveDown: false,
        disableRemove: false
      });
      expect(actions[1].props()).toMatchObject({ disableMoveUp: false, disableMoveDown: true });
      actions[0].vm.$emit("move", 1);
      actions[0].vm.$emit("regenerate");
      actions[0].vm.$emit("remove");
      if (engine === "chatterbox") {
        expect(panel.moveDetailItem).toHaveBeenCalledWith(0, 1);
        expect(panel.regenerateItem).toHaveBeenCalledWith("item-1");
        expect(panel.removeBatchItem).toHaveBeenCalledWith("item-1");
        panel.regeneratingItemId = "item-1";
      } else {
        expect(panel.moveItem).toHaveBeenCalledWith(0, 1);
        expect(panel.regenerate).toHaveBeenCalledWith(items[0]);
        expect(panel.removeItem).toHaveBeenCalledWith("item-1");
        panel.busy = true;
      }
      await wrapper.vm.$nextTick();
      expect(actions[0].props("regenerating")).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
});
