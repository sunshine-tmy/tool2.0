/** 中文模块说明：验证桌面能力卡片的安装状态、依赖保护和可取消下载。 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ComponentJob, ComponentPackageStatus } from "@toolbox/shared";
import DesktopComponentCard from "./DesktopComponentCard.vue";

const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: { disabled: Boolean, loading: Boolean },
  emits: ["click"],
  template:
    '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
});

function component(overrides: Partial<ComponentPackageStatus> = {}): ComponentPackageStatus {
  return {
    id: "ffmpeg",
    moduleId: "ffmpeg",
    displayName: "FFmpeg",
    groupId: "shared",
    purpose: "媒体编解码",
    taskToolIds: ["video-text"],
    dependencyIds: [],
    dependentIds: [],
    installConditions: [],
    version: "7.0.0",
    platform: "win32-x64",
    downloadBytes: 1024,
    installedBytes: 2048,
    installed: false,
    state: "not-installed",
    health: "unknown",
    licenseName: "LGPL-3.0",
    licenseUrl: "https://example.test/license",
    ...overrides
  };
}

function mountCard(props: { component: ComponentPackageStatus; job?: ComponentJob }) {
  return mount(DesktopComponentCard, {
    props,
    global: {
      stubs: {
        NAlert: defineComponent({ template: "<div role='alert'><slot /></div>" }),
        NButton: ButtonStub,
        NCard: defineComponent({ template: "<article><slot /></article>" }),
        NProgress: true,
        NSpace: defineComponent({ template: "<div><slot /></div>" }),
        NTag: defineComponent({ template: "<span><slot /></span>" }),
        Download: true,
        RefreshCw: true,
        Trash2: true
      }
    }
  });
}

describe("DesktopComponentCard", () => {
  it("offers installation for an approved uninstalled component", async () => {
    const wrapper = mountCard({ component: component() });
    const install = wrapper.findAll("button").find((button) => button.text().includes("安装"));
    expect(install?.attributes("disabled")).toBeUndefined();
    await install?.trigger("click");
    expect(wrapper.emitted("install")?.[0]?.[0]).toMatchObject({ id: "ffmpeg" });
  });

  it("prevents an unresolved dependency installation", () => {
    const wrapper = mountCard({
      component: component({ state: "blocked", blockedReason: "缺少依赖：python-311" })
    });
    const install = wrapper.findAll("button").find((button) => button.text().includes("安装"));
    expect(install?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("缺少依赖：python-311");
  });

  it("prevents removing a shared dependency while another package depends on it", () => {
    const wrapper = mountCard({
      component: component({ installed: true, state: "ready", health: "healthy", dependentIds: ["video-text"] })
    });
    const uninstall = wrapper.findAll("button").find((button) => button.text().includes("卸载"));
    expect(uninstall?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("被其他能力依赖：video-text");
  });

  it("shows download progress and exposes cancel only during download", async () => {
    const job: ComponentJob = {
      id: "00000000-0000-4000-8000-000000000001",
      componentId: "ffmpeg",
      operation: "install",
      state: "running",
      phase: "downloading",
      progress: { downloadedBytes: 512, totalDownloadBytes: 1024, processedFiles: 0, totalFiles: 1, percentage: 50 },
      createdAt: "2026-09-24T00:00:00Z",
      updatedAt: "2026-09-24T00:00:01Z"
    };
    const wrapper = mountCard({ component: component({ state: "downloading" }), job });
    expect(wrapper.text()).toContain("50%");
    expect(wrapper.text()).toContain("512 B / 1.0 KB");
    const cancel = wrapper.findAll("button").find((button) => button.text().includes("取消下载"));
    await cancel?.trigger("click");
    expect(wrapper.emitted("cancel")?.[0]?.[0]).toEqual(job);
  });
});
