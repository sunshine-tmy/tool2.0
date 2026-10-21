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
    taskToolIds: ["edge-tts"],
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

function mountCard(props: {
  component: ComponentPackageStatus;
  job?: ComponentJob;
  offlineUploading?: boolean;
  offlineUploadProgress?: number;
}) {
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
        Trash2: true,
        Upload: true
      }
    }
  });
}

describe("DesktopComponentCard", () => {
  it("makes a newer approved capability version discoverable without reinstalling automatically", async () => {
    const wrapper = mountCard({
      component: component({ installed: true, installedVersion: "old", version: "new", state: "ready" })
    });
    expect(wrapper.text()).toContain("待更新");
    const button = wrapper.findAll("button").find((item) => item.text() === "更新");
    await button?.trigger("click");
    expect(wrapper.emitted("reinstall")?.[0]?.[0]).toMatchObject({ id: "ffmpeg" });
  });

  it("offers only uninstall for a retired installed runtime", async () => {
    const wrapper = mountCard({
      component: component({ id: "python-311", retired: true, installed: true, state: "ready", downloadBytes: 0 })
    });
    expect(wrapper.text()).toContain("旧版 · 仅供卸载");
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["卸载"]);
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("uninstall")?.[0]?.[0]).toMatchObject({ id: "python-311" });
  });

  it("offers installation for an approved uninstalled component", async () => {
    const wrapper = mountCard({ component: component() });
    const install = wrapper.findAll("button").find((button) => button.text().includes("安装"));
    expect(install?.attributes("disabled")).toBeUndefined();
    await install?.trigger("click");
    expect(wrapper.emitted("install")?.[0]?.[0]).toMatchObject({ id: "ffmpeg" });
  });

  it("shows internal-use metadata when license details are omitted", () => {
    const wrapper = mountCard({ component: component({ licenseName: "内部使用", licenseUrl: undefined }) });
    expect(wrapper.text()).toContain("内部使用");
    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("prevents an unresolved dependency installation", () => {
    const wrapper = mountCard({
      component: component({ state: "blocked", blockedReason: "缺少依赖：python-311" })
    });
    const install = wrapper.findAll("button").find((button) => button.text().includes("安装"));
    expect(install?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("缺少依赖：python-311");
  });

  it("offers generic offline import and displays signed archive basenames", async () => {
    const wrapper = mountCard({
      component: component({
        archiveFileNames: ["ffmpeg-8.1.2.tar.gz", "ffmpeg-8.1.2.spdx.json"],
        releasePageUrl: "https://github.com/sunshine-tmy/tool2.0/releases/tag/components-v1"
      })
    });
    expect(wrapper.text()).toContain("ffmpeg-8.1.2.tar.gz");
    expect(wrapper.text()).toContain("ffmpeg-8.1.2.spdx.json");
    expect(wrapper.find(".offline-import-source a").attributes()).toMatchObject({
      href: "https://github.com/sunshine-tmy/tool2.0/releases/tag/components-v1",
      target: "_blank",
      rel: "noopener noreferrer"
    });
    const button = wrapper.findAll("button").find((item) => item.text().includes("离线导入"));
    await button?.trigger("click");
    expect(wrapper.emitted("offlineImport")?.[0]?.[0]).toMatchObject({ id: "ffmpeg" });
  });

  it("shows cancellable upload progress during offline import", async () => {
    const wrapper = mountCard({ component: component(), offlineUploading: true, offlineUploadProgress: 42 });
    expect(wrapper.text()).toContain("正在传输离线安装包");
    expect(wrapper.text()).toContain("42%");
    const cancel = wrapper.findAll("button").find((button) => button.text().includes("取消导入"));
    await cancel?.trigger("click");
    expect(wrapper.emitted("cancelOfflineImport")?.[0]?.[0]).toMatchObject({ id: "ffmpeg" });
  });

  it("prevents removing a shared dependency while another package depends on it", () => {
    const wrapper = mountCard({
      component: component({ installed: true, state: "ready", health: "healthy", dependentIds: ["edge-tts"] })
    });
    const uninstall = wrapper.findAll("button").find((button) => button.text().includes("卸载"));
    expect(uninstall?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("被其他能力依赖：edge-tts");
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
