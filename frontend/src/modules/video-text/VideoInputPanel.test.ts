/**
 * 中文模块说明：测试 frontend/src/modules/video-text/VideoInputPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import VideoInputPanel from "./VideoInputPanel.vue";

describe("video input panel", () => {
  it("renders source status and delegates upload actions", async () => {
    // 输入面板只管理文件/拖拽事件的派发，实际上传和任务创建由页面容器负责。
    const submit = vi.fn();
    const wrapper = mount(VideoInputPanel, {
      props: {
        isDragging: false,
        selectedVideo: new File(["video"], "demo.mp4", { type: "video/mp4" }),
        remoteVideo: null,
        videoPreviewUrl: "",
        submitting: false,
        uploadProgress: 0,
        currentTask: null,
        result: null,
        statusLabel: "等待上传",
        sourceLabel: "未生成",
        recognitionQualityRows: [],
        onVideoDrop: vi.fn(),
        onVideoChange: vi.fn(),
        submit
      },
      global: {
        stubs: {
          NButton: defineComponent({ template: '<button v-bind="$attrs"><slot /></button>' }),
          NProgress: true,
          UploadCloud: true,
          Wand2: true
        }
      }
    });

    expect(wrapper.text()).toContain("demo.mp4");
    expect(wrapper.text()).toContain("等待上传");
    await wrapper.get("button").trigger("click");
    await wrapper.get("label").trigger("dragenter");
    expect(submit).toHaveBeenCalledOnce();
    expect(wrapper.emitted("update:isDragging")).toEqual([[true]]);
  });
});
