/**
 * 中文模块说明：测试 frontend/src/modules/xhs-archive/ArchiveTaskPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { XhsArchiveTask } from "@toolbox/shared";
import ArchiveTaskPanel from "./ArchiveTaskPanel.vue";

const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: { disabled: Boolean, loading: Boolean },
  emits: ["click"],
  template:
    '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
});

const InputStub = defineComponent({
  inheritAttrs: false,
  props: { value: String },
  emits: ["update:value", "keyup"],
  template:
    '<input v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" @keyup="$emit(\'keyup\', $event)" />'
});

function task(overrides: Partial<XhsArchiveTask> = {}): XhsArchiveTask {
  return {
    id: "task-1",
    status: "running",
    stage: "downloading",
    progress: 60,
    message: "正在下载媒体",
    createdAt: "2026-09-14T08:00:00.000Z",
    updatedAt: "2026-09-14T08:00:01.000Z",
    ...overrides
  };
}

function mountPanel(overrides: Partial<{ inputUrl: string; task: XhsArchiveTask; authWaiting: boolean }> = {}) {
  return mount(ArchiveTaskPanel, {
    props: {
      inputUrl: "https://www.xiaohongshu.com/explore/note-1",
      authWaiting: false,
      ...overrides
    },
    global: {
      stubs: {
        NButton: ButtonStub,
        NInput: InputStub,
        NProgress: true,
        Archive: true,
        Box: true,
        Check: true,
        Download: true,
        FileSearch: true,
        HardDriveDownload: true
      }
    }
  });
}

describe("XHS archive task panel", () => {
  it("renders task progress and emits submit without owning request behavior", async () => {
    // 面板只负责展示阶段和派发事件，不应在组件内部直接发起网络请求。
    const wrapper = mountPanel({ task: task() });

    expect(wrapper.text()).toContain("正在处理");
    expect(wrapper.text()).toContain("正在下载媒体");
    expect(wrapper.text()).toContain("60%");
    expect(wrapper.findAll(".stage-step.complete")).toHaveLength(2);
    expect(wrapper.findAll(".stage-step.active")).toHaveLength(1);

    await wrapper.setProps({
      task: task({ status: "completed", stage: "completed", progress: 100, message: "归档完成" })
    });
    const submitButton = wrapper.findAll("button").find((button) => button.text().includes("获取并存档"));
    expect(submitButton).toBeDefined();
    await submitButton?.trigger("click");
    expect(wrapper.emitted("submit")).toHaveLength(1);
  });

  it("routes authentication failures to the login action", async () => {
    // 后端返回 XHS_AUTH_REQUIRED 时必须展示登录入口，并把动作交给页面任务层处理。
    const wrapper = mountPanel({
      task: task({ status: "failed", errorCode: "XHS_AUTH_REQUIRED", error: "需要登录" })
    });

    expect(wrapper.text()).toContain("处理失败");
    expect(wrapper.text()).toContain("需要登录");
    const loginButton = wrapper.findAll("button").find((button) => button.text().includes("登录小红书"));
    expect(loginButton).toBeDefined();
    await loginButton?.trigger("click");
    expect(wrapper.emitted("login")).toHaveLength(1);
  });
});
