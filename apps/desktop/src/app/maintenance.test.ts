import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopBackend } from "./backend-port";
import { createDesktopMaintenance } from "./maintenance";
const mock = vi.hoisted(() => ({ install: vi.fn() }));
vi.mock("../updates/desktop-updater", () => ({ getDesktopAutoUpdater: () => ({ quitAndInstall: mock.install }) }));
function setup() {
  let critical = false,
    playing = false,
    quitting = false,
    origin = "http://127.0.0.1:43210";
  const events: string[] = [];
  const backend = {
    inspectShutdown: vi
      .fn<DesktopBackend["inspectShutdown"]>()
      .mockResolvedValue({ busy: false, blocked: false, prepared: true }),
    stop: vi.fn<DesktopBackend["stop"]>().mockImplementation(async () => {
      events.push("stop");
      return { clean: true };
    }),
    start: vi.fn<DesktopBackend["start"]>().mockImplementation(async () => {
      events.push("start");
      return "http://127.0.0.1:43211";
    }),
    monitorUnexpectedExit: vi.fn(() => {
      events.push("monitor");
    })
  };
  const load = vi.fn(async () => {
      events.push("load");
    }),
    window = { loadURL: load } as unknown as BrowserWindow;
  let current: DesktopBackend | undefined = backend;
  const flow = createDesktopMaintenance({
    getBackend: () => current,
    getMainWindow: () => window,
    getBackendOrigin: () => origin,
    setBackendOrigin: (value) => {
      origin = value;
    },
    isOperation: () => critical,
    setOperation: (value) => {
      critical = value;
    },
    isPlaybackActive: () => playing,
    setQuitting: (value) => {
      quitting = value;
    }
  });
  return {
    flow,
    backend,
    load,
    events,
    critical: () => critical,
    quitting: () => quitting,
    origin: () => origin,
    setCritical: () => {
      critical = true;
    },
    setPlaying: () => {
      playing = true;
    },
    noBackend: () => {
      current = undefined;
    }
  };
}
beforeEach(() => vi.clearAllMocks());
describe("desktop maintenance order", () => {
  it("freezes/stops, performs migration, then restarts/monitors/reloads before releasing the guard", async () => {
    const s = setup();
    expect(
      await s.flow.withBackendStopped(async () => {
        expect(s.critical()).toBe(true);
        s.events.push("operation");
        return "result";
      })
    ).toBe("result");
    expect(s.events).toEqual(["stop", "operation", "start", "monitor", "load"]);
    expect(s.backend.inspectShutdown).toHaveBeenCalledWith(false);
    expect(s.load).toHaveBeenCalledWith("http://127.0.0.1:43211");
    expect(s.origin()).toBe("http://127.0.0.1:43211");
    expect(s.critical()).toBe(false);
  });
  it("restarts after an operation failure and preserves the operation error unless restart itself fails", async () => {
    const s = setup(),
      failure = new Error("migration failed");
    await expect(
      s.flow.withBackendStopped(async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
    expect(s.events).toEqual(["stop", "start", "monitor", "load"]);
    expect(s.critical()).toBe(false);
    s.backend.start.mockRejectedValueOnce(new Error("restart failed"));
    await expect(
      s.flow.withBackendStopped(async () => {
        throw failure;
      })
    ).rejects.toThrow("本地服务重启失败：restart failed");
    expect(s.critical()).toBe(false);
  });
  it("does not execute or restart an operation when preparation or shutdown is unsafe", async () => {
    const s = setup(),
      operation = vi.fn();
    s.backend.inspectShutdown.mockResolvedValueOnce({ busy: true, blocked: true, prepared: false, reason: "busy" });
    await expect(s.flow.withBackendStopped(operation)).rejects.toThrow("busy");
    expect(s.backend.stop).not.toHaveBeenCalled();
    s.backend.stop.mockResolvedValueOnce({ clean: false });
    await expect(s.flow.withBackendStopped(operation)).rejects.toThrow("已停止迁移");
    expect(operation).not.toHaveBeenCalled();
    expect(s.backend.start).not.toHaveBeenCalled();
    expect(s.critical()).toBe(false);
  });
  it("refuses concurrent maintenance and missing backend without touching other processes", async () => {
    const s = setup();
    s.setCritical();
    await expect(s.flow.withBackendStopped(vi.fn())).rejects.toThrow("已有桌面维护操作");
    expect(s.backend.stop).not.toHaveBeenCalled();
    const missing = setup();
    missing.noBackend();
    await expect(missing.flow.withBackendStopped(vi.fn())).rejects.toThrow("尚未启动");
    expect(missing.backend.stop).not.toHaveBeenCalled();
  });
  it("protects playback and maintenance before update install, then stops cleanly before quitAndInstall", async () => {
    const blocked = setup();
    blocked.setPlaying();
    await expect(blocked.flow.installDownloadedUpdate()).rejects.toThrow("音频播放");
    expect(mock.install).not.toHaveBeenCalled();
    const s = setup();
    mock.install.mockImplementationOnce(() => {
      expect(s.critical()).toBe(true);
      expect(s.quitting()).toBe(true);
      s.events.push("install");
    });
    await s.flow.installDownloadedUpdate();
    expect(s.events).toEqual(["stop", "install"]);
    expect(s.critical()).toBe(false);
  });
  it("does not install updates after an unprepared/unclean stop and always releases critical state", async () => {
    const s = setup();
    s.backend.inspectShutdown.mockResolvedValueOnce({ busy: true, blocked: false, prepared: false });
    await expect(s.flow.installDownloadedUpdate()).rejects.toThrow("后台任务");
    expect(s.critical()).toBe(false);
    s.backend.stop.mockResolvedValueOnce({ clean: false });
    await expect(s.flow.installDownloadedUpdate()).rejects.toThrow("已停止更新安装");
    expect(mock.install).not.toHaveBeenCalled();
    expect(s.quitting()).toBe(false);
    expect(s.critical()).toBe(false);
  });
});
