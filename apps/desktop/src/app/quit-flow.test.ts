import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopBackend } from "./backend-port";
import { createDesktopQuitFlow } from "./quit-flow";
const mock = vi.hoisted(() => ({
  dialog: vi.fn(),
  exit: vi.fn(),
  quit: vi.fn(),
  show: vi.fn(),
  events: [] as string[]
}));
vi.mock("electron", () => ({ app: { exit: mock.exit, quit: mock.quit }, dialog: { showMessageBox: mock.dialog } }));
vi.mock("../windows/shutdown-window", () => ({
  ShutdownWindow: class {
    constructor(readonly retry: () => void) {}
    show = mock.show;
  }
}));
const drain = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function setup() {
  let critical = false,
    playing = false,
    quitting = false;
  const backend = {
    inspectShutdown: vi
      .fn<DesktopBackend["inspectShutdown"]>()
      .mockResolvedValue({ busy: false, blocked: false, prepared: true }),
    stop: vi.fn(async () => {
      mock.events.push("stop");
      return { clean: true };
    })
  };
  const destroy = vi.fn(() => mock.events.push("destroy"));
  let window: BrowserWindow | undefined = { destroy } as unknown as BrowserWindow;
  const flow = createDesktopQuitFlow({
    getBackend: () => backend,
    getMainWindow: () => window,
    clearMainWindow: () => {
      window = undefined;
      mock.events.push("clear-window");
    },
    isOperation: () => critical,
    isPlaybackActive: () => playing,
    setPlaybackActive: (active) => {
      playing = active;
      mock.events.push("playback-" + active);
    },
    isQuitting: () => quitting,
    setQuitting: (active) => {
      quitting = active;
      mock.events.push("quitting-" + active);
    },
    clearAutomaticUpdateTimer: () => {
      mock.events.push("clear-timer");
    }
  });
  const close = () => {
    const event = { preventDefault: vi.fn() };
    flow.beforeQuit(event);
    return event;
  };
  return {
    flow,
    backend,
    destroy,
    close,
    setCritical: () => {
      critical = true;
    },
    setPlaying: () => {
      playing = true;
    }
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.events.length = 0;
  mock.dialog.mockResolvedValue({ response: 1 });
  mock.exit.mockImplementation(() => mock.events.push("exit"));
  mock.show.mockImplementation(() => mock.events.push("shutdown-window"));
});
describe("desktop shutdown assembly", () => {
  it("coalesces close requests, stops rendering immediately after confirmation, and exits only after backend shutdown", async () => {
    const s = setup();
    const event = s.close();
    s.close();
    await drain();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(s.backend.stop).toHaveBeenCalledOnce();
    expect(mock.events).toEqual([
      "clear-timer",
      "shutdown-window",
      "destroy",
      "clear-window",
      "playback-false",
      "stop",
      "quitting-true",
      "exit"
    ]);
    expect(mock.exit).toHaveBeenCalledWith(0);
    const completed = s.close();
    expect(completed.preventDefault).not.toHaveBeenCalled();
  });
  it("does not destroy or stop while a migration is active or playback close is cancelled", async () => {
    const critical = setup();
    critical.setCritical();
    critical.close();
    await drain();
    expect(critical.backend.inspectShutdown).not.toHaveBeenCalled();
    expect(critical.destroy).not.toHaveBeenCalled();
    const playing = setup();
    playing.setPlaying();
    mock.dialog.mockResolvedValueOnce({ response: 0 });
    playing.close();
    await drain();
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(playing.backend.stop).not.toHaveBeenCalled();
    expect(mock.exit).not.toHaveBeenCalled();
  });
  it("retains committed shutdown state after a stop failure and retries without recreating the renderer", async () => {
    const s = setup();
    s.backend.stop.mockRejectedValueOnce(new Error("unconfirmed"));
    s.close();
    await drain();
    expect(mock.exit).not.toHaveBeenCalled();
    expect(s.destroy).toHaveBeenCalledOnce();
    s.close();
    await drain();
    expect(s.backend.stop).toHaveBeenCalledTimes(2);
    expect(s.destroy).toHaveBeenCalledOnce();
    expect(mock.exit).toHaveBeenCalledOnce();
  });
  it("shows only existing shutdown stages and warns on an unclean backend stop before final exit", async () => {
    const s = setup();
    s.flow.showStage("workers");
    expect(mock.show).not.toHaveBeenCalled();
    s.backend.stop.mockResolvedValueOnce({ clean: false });
    s.close();
    await drain();
    expect(mock.dialog).toHaveBeenCalledWith(expect.objectContaining({ title: "后台服务已回收" }));
    expect(mock.exit).toHaveBeenCalledOnce();
    s.flow.showStage("verify");
    expect(mock.show).toHaveBeenLastCalledWith("verify");
  });
});
