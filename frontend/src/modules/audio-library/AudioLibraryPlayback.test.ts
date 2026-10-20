// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioLibraryItemView } from "@toolbox/shared";
import AudioLibraryPlayback from "./AudioLibraryPlayback.vue";
import AudioLibraryPlayer from "./AudioLibraryPlayer.vue";
import { audioLibraryPlayer as player } from "./player";
import { audioLibraryApi } from "./api";
import { apiBaseUrl } from "../../config/runtime";

vi.mock("./api", () => ({
  audioLibraryApi: { resolve: vi.fn().mockResolvedValue([]) },
  formatDuration: (value: number) => String(value)
}));
const item = {
  id: "one",
  title: "开场话术",
  duration: 10,
  chineseText: "欢迎光临",
  foreignText: "Selamat datang",
  audioUrl: "/audio/one",
  available: true
} as AudioLibraryItemView;
const storageKey = `toolbox-audio-player:${apiBaseUrl}`;
let host: VueWrapper | undefined;
let controls: VueWrapper | undefined;
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.mocked(audioLibraryApi.resolve).mockResolvedValue([]);
  player.clear();
});
afterEach(() => {
  controls?.unmount();
  controls = undefined;
  host?.unmount();
  host = undefined;
  player.clear();
  vi.restoreAllMocks();
  localStorage.clear();
});
function savedQueue() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      queue: [
        { entryId: "first", itemId: "one" },
        { entryId: "second", itemId: "one" }
      ],
      currentId: "second",
      position: 4,
      mode: "list",
      gap: 3,
      volume: 0.6
    })
  );
}
describe("音频播放引擎与模块控件分离", () => {
  it("全局承载节点没有可见控件，卸载模块控件不停止播放或清空队列", async () => {
    host = mount(AudioLibraryPlayback);
    await flushPromises();
    expect(host.element.tagName).toBe("AUDIO");
    expect(host.find(".library-player").exists()).toBe(false);
    player.add([item]);
    controls = mount(AudioLibraryPlayer);
    await player.play();
    expect(controls.find(".library-player").exists()).toBe(true);
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    pause.mockClear();
    controls.unmount();
    controls = undefined;
    await flushPromises();
    expect(player.phase).toBe("playing");
    expect(player.queue).toHaveLength(1);
    expect(pause).not.toHaveBeenCalled();
    controls = mount(AudioLibraryPlayer);
    expect(controls.text()).toContain("开场话术");
    expect(controls.text()).toContain("暂停");
    expect(document.body.classList.contains("audio-player-visible")).toBe(false);
  });
  it("重启恢复队列顺序、重复项及设置，但不自动出声", async () => {
    savedQueue();
    vi.mocked(audioLibraryApi.resolve).mockResolvedValue([item]);
    host = mount(AudioLibraryPlayback);
    await flushPromises();
    expect(player.queue.map((x) => x.entryId)).toEqual(["first", "second"]);
    expect(player.currentId).toBe("second");
    expect(player.position).toBe(4);
    expect(player.mode).toBe("list");
    expect(player.gap).toBe(3);
    expect(player.volume).toBe(0.6);
    expect(player.phase).toBe("paused");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it("异步恢复不能覆盖用户在页面上新加载的队列", async () => {
    savedQueue();
    let finish!: (items: AudioLibraryItemView[]) => void;
    vi.mocked(audioLibraryApi.resolve).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    host = mount(AudioLibraryPlayback);
    player.replaceQueue([{ ...item, id: "new" }], { mode: "single", gap: 7 });
    finish([item]);
    await flushPromises();
    expect(player.queue.map((x) => x.item.id)).toEqual(["new"]);
    expect(player.mode).toBe("single");
    expect(player.gap).toBe(7);
  });
  it("播放引擎退出后未完成的恢复不能重新注入队列", async () => {
    savedQueue();
    let finish!: (items: AudioLibraryItemView[]) => void;
    vi.mocked(audioLibraryApi.resolve).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    host = mount(AudioLibraryPlayback);
    host.unmount();
    host = undefined;
    finish([item]);
    await flushPromises();
    expect(player.queue).toHaveLength(0);
  });
});
