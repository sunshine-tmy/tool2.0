/**
 * 中文模块说明：测试 frontend/src/modules/video-text/VideoResultPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { VideoTextResult } from "./types";
import VideoResultPanel from "./VideoResultPanel.vue";

const result = {
  id: "result-1",
  source: "transcriber",
  fullText: "一段测试文案",
  summary: ["测试摘要"],
  segments: [{ index: 1, text: "一段测试文案", startSeconds: 0, endSeconds: 2 }]
} as unknown as VideoTextResult;

describe("video result panel", () => {
  it("renders transcript output and delegates copy/export actions", async () => {
    const copyFullText = vi.fn();
    const wrapper = mount(VideoResultPanel, {
      props: {
        result,
        lowConfidenceSegments: [],
        copyFullText,
        exportUrl: (format: "txt" | "srt" | "json") => `/export.${format}`,
        formatSeconds: (seconds?: number) => `${seconds ?? 0}s`
      },
      global: {
        stubs: {
          NButton: defineComponent({ template: '<button v-bind="$attrs"><slot /></button>' })
        }
      }
    });

    expect(wrapper.text()).toContain("一段测试文案");
    expect(wrapper.text()).toContain("测试摘要");
    await wrapper.get("button").trigger("click");
    expect(copyFullText).toHaveBeenCalledOnce();
  });
});
