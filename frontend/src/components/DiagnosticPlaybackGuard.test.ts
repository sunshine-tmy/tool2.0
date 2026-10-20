// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiagnosticPlaybackGuard from "./DiagnosticPlaybackGuard.vue";
import { audioLibraryPlayer } from "../modules/audio-library/player";
const mock = vi.hoisted(() => ({ post: vi.fn(), local: true }));
vi.mock("../services/http", () => ({ httpClient: mock }));
vi.mock("../services/diagnostics", () => ({
  get localDiagnosticsAvailable() {
    return mock.local;
  }
}));
afterEach(() => {
  mock.local = true;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.body.innerHTML = "";
  audioLibraryPlayer.phase = "idle";
});
describe("diagnostic playback protection", () => {
  it("reports remote playback without exposing diagnostics and releases it when leaving", async () => {
    mock.local = false;
    mock.post.mockResolvedValue({});
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(DiagnosticPlaybackGuard);
    audioLibraryPlayer.phase = "playing";
    await flushPromises();
    expect(mock.post).toHaveBeenLastCalledWith(
      "/lan-access/playback",
      expect.anything(),
      expect.objectContaining({ active: true }),
      expect.anything()
    );
    wrapper.unmount();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/lan-access/playback",
      expect.objectContaining({ keepalive: true, body: expect.stringContaining('"active":false') })
    );
  });
  it("reports independent native playback even if the queue is idle", async () => {
    mock.post.mockResolvedValue({});
    const wrapper = mount(DiagnosticPlaybackGuard);
    await flushPromises();
    const audio = document.createElement("audio");
    Object.defineProperty(audio, "paused", { value: false, configurable: true });
    document.body.append(audio);
    audio.dispatchEvent(new Event("play"));
    await flushPromises();
    expect(mock.post).toHaveBeenLastCalledWith(
      "/diagnostics/playback",
      expect.anything(),
      expect.objectContaining({ active: true }),
      expect.anything()
    );
    wrapper.unmount();
  });
  it("protects queue gap waiting as well as audible playback", async () => {
    mock.post.mockResolvedValue({});
    const wrapper = mount(DiagnosticPlaybackGuard);
    await flushPromises();
    audioLibraryPlayer.phase = "waiting";
    await flushPromises();
    expect(mock.post).toHaveBeenLastCalledWith(
      "/diagnostics/playback",
      expect.anything(),
      expect.objectContaining({ active: true }),
      expect.anything()
    );
    wrapper.unmount();
  });
  it("does not pause playback just because a heartbeat encounters a network failure", async () => {
    mock.post.mockRejectedValue(new Error("network unavailable"));
    const pause = vi.spyOn(audioLibraryPlayer, "pause");
    const wrapper = mount(DiagnosticPlaybackGuard);
    audioLibraryPlayer.phase = "playing";
    await flushPromises();
    expect(pause).not.toHaveBeenCalled();
    wrapper.unmount();
    pause.mockRestore();
  });
});
