/**
 * 中文模块说明：测试 frontend/src/modules/image-ai/ImageAiTaskStatusCard.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ImageAiTask } from "@toolbox/shared";
import ImageAiTaskStatusCard from "./ImageAiTaskStatusCard.vue";

describe("image AI task status card", () => {
  it("shows progress and emits cancellation for running tasks", async () => {
    // running 任务显示队列位置和进度，并通过 cancel 事件交给页面调用后端取消接口。
    const task = {
      id: "task-1",
      status: "running",
      progress: 42,
      queuePosition: 2,
      warnings: []
    } as unknown as ImageAiTask;
    const wrapper = mount(ImageAiTaskStatusCard, {
      props: { task },
      global: {
        stubs: {
          NProgress: defineComponent({ template: '<div class="progress" />' }),
          NButton: defineComponent({ template: "<button><slot /></button>" }),
          Trash2: true
        }
      }
    });

    expect(wrapper.text()).toContain("AI 处理中");
    expect(wrapper.text()).toContain("队列第 2 位");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});
