// @vitest-environment happy-dom
import { defineComponent, ref } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NSelect } from "naive-ui";
import type { AudioLibraryItemView } from "@toolbox/shared";
import AudioLibraryItemPlayer from "./AudioLibraryItemPlayer.vue";
import AudioLibraryPlayback from "./AudioLibraryPlayback.vue";
import AudioWaveform from "./AudioWaveform.vue";
import { audioLibraryPlayer as queue } from "./player";
import { onItemPlay } from "./item-playback";
import { audioLibraryApi } from "./api";
import { cropAudio } from "./clip-audio";
vi.mock("./clip-audio", () => ({ cropAudio: vi.fn() }));
vi.mock("./api", () => ({
  audioLibraryApi: { resolve: vi.fn().mockResolvedValue([]), clip: vi.fn() },
  formatDuration: (value: number) => String(value)
}));
function item(id = "one", available = true) {
  return { id, title: id, revision: 1, audioUrl: `/audio/${id}`, available, duration: 10 } as AudioLibraryItemView;
}
let host: VueWrapper | undefined, wrapper: VueWrapper | undefined;
const items = ref<AudioLibraryItemView[]>([]);
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  });
  queue.clear();
  queue.mode = "sequence";
  queue.gap = 1;
  queue.setVolume(1);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  host?.unmount();
  host = undefined;
  queue.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
async function open() {
  items.value = [item("one"), item("two")];
  host = mount(AudioLibraryPlayback, { attachTo: document.body });
  wrapper = mount(
    defineComponent({
      components: { AudioLibraryItemPlayer },
      setup: () => ({ items, onItemPlay }),
      template:
        '<section @play.capture="onItemPlay"><AudioLibraryItemPlayer v-for="item in items" :key="item.id" :item="item" /></section>'
    }),
    { attachTo: document.body, global: { stubs: { AudioWaveform: true } } }
  );
  await flushPromises();
  return wrapper.findAllComponents(AudioLibraryItemPlayer);
}
function queueState() {
  return {
    ids: queue.queue.map((x) => x.entryId),
    currentId: queue.currentId,
    phase: queue.phase,
    position: queue.position,
    remaining: queue.remaining,
    mode: queue.mode,
    gap: queue.gap,
    volume: queue.volume,
    preview: queue.preview
  };
}
describe("分组内独立播放", () => {
  it("波形定位、前后跳转和倍速仅改变当前条目，选段计时随倍速调整", async () => {
    const [one] = await open();
    queue.add([item("queue")]);
    await queue.play();
    const before = queueState();
    one.getComponent(AudioWaveform).vm.$emit("seek", 4);
    await flushPromises();
    await one.get('[aria-label="后退 3 秒"]').trigger("click");
    expect((one.get("audio").element as HTMLAudioElement).currentTime).toBe(1);
    await one.get('[aria-label="前进 3 秒"]').trigger("click");
    expect((one.get("audio").element as HTMLAudioElement).currentTime).toBe(4);
    const rateSelect = one.getComponent(NSelect);
    expect(rateSelect.props("consistentMenuWidth")).toBe(false);
    expect(rateSelect.props("menuProps")).toEqual({ style: { minWidth: "112px" } });
    expect(rateSelect.props("options")?.map((option) => option.label)).toEqual([
      "0.5x",
      "0.75x",
      "1x",
      "1.25x",
      "1.5x",
      "2x"
    ]);
    rateSelect.vm.$emit("update:value", 2);
    await flushPromises();
    await one
      .findAll("button")
      .find((x) => x.text() === "裁剪")!
      .trigger("click");
    one.getComponent(AudioWaveform).vm.$emit("update:range", [1, 3]);
    await flushPromises();
    vi.useFakeTimers();
    await one
      .findAll("button")
      .find((x) => x.text() === "播放选段")!
      .trigger("click");
    await flushPromises();
    expect((one.get("audio").element as HTMLAudioElement).playbackRate).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(one.get(".library-item-play").text()).toBe("播放");
    expect(queueState()).toEqual(before);
    await one.get('[aria-label="重置选区"]').trigger("click");
    expect(one.getComponent(AudioWaveform).props("range")).toEqual([0, 10]);
  });
  it("中间编辑器始终显示，选区可验证并另存，原音频与队列不变", async () => {
    const [one] = await open();
    queue.add([item("queue")]);
    await queue.play();
    const before = queueState();
    expect(one.findComponent(AudioWaveform).exists()).toBe(true);
    await one
      .findAll("button")
      .find((x) => x.text() === "裁剪")!
      .trigger("click");
    const range = one.getComponent(AudioWaveform);
    expect(one.find('[aria-label="裁剪开始时间"]').exists()).toBe(false);
    expect(one.find('[aria-label="裁剪结束时间"]').exists()).toBe(false);
    expect(one.text()).not.toContain("当前设为起点");
    expect(one.text()).not.toContain("当前设为终点");
    expect(one.findAll(".library-item-trim-actions button").map((button) => button.text())).toEqual([
      "播放选段",
      "另存裁剪音频"
    ]);
    range.vm.$emit("update:range", [3, 1]);
    await flushPromises();
    const save = one.findAll("button").find((x) => x.text() === "另存裁剪音频")!;
    expect(save.attributes("disabled")).toBeDefined();
    range.vm.$emit("update:range", [1, 3.5]);
    await flushPromises();
    const file = new Blob(["clip"], { type: "audio/wav" });
    vi.mocked(cropAudio).mockResolvedValueOnce(file);
    vi.mocked(audioLibraryApi.clip).mockResolvedValueOnce({ item: item("new"), existing: false });
    await save.trigger("click");
    await flushPromises();
    expect(audioLibraryApi.clip).toHaveBeenCalledWith("one", file, 1, 3.5, 1, expect.any(AbortSignal));
    expect(one.emitted("saved")?.[0]).toEqual([item("new")]);
    expect(one.props("item").id).toBe("one");
    expect(queueState()).toEqual(before);
  });
  it("播放选段在终点停止，不改变队列；保存失败保留原内容并可重试", async () => {
    const [one] = await open();
    const before = queueState();
    await one
      .findAll("button")
      .find((x) => x.text() === "裁剪")!
      .trigger("click");
    one.getComponent(AudioWaveform).vm.$emit("update:range", [1, 2.5]);
    await flushPromises();
    vi.useFakeTimers();
    await one
      .findAll("button")
      .find((x) => x.text() === "播放选段")!
      .trigger("click");
    await flushPromises();
    expect((one.get("audio").element as HTMLAudioElement).currentTime).toBe(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(one.get(".library-item-play").text()).toBe("播放");
    expect((one.get("audio").element as HTMLAudioElement).currentTime).toBe(2.5);
    vi.mocked(cropAudio).mockRejectedValueOnce(new Error("裁剪失败"));
    await one
      .findAll("button")
      .find((x) => x.text() === "另存裁剪音频")!
      .trigger("click");
    await flushPromises();
    expect(one.get('[role="alert"]').text()).toContain("裁剪失败");
    expect(queueState()).toEqual(before);
  });
  it("离开列表取消未完成裁剪，不继续上传或改变队列", async () => {
    const [one] = await open();
    queue.add([item("queue")]);
    await queue.play();
    const before = queueState();
    let finish!: (blob: Blob) => void;
    vi.mocked(cropAudio).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    vi.mocked(audioLibraryApi.clip).mockClear();
    await one
      .findAll("button")
      .find((x) => x.text() === "裁剪")!
      .trigger("click");
    await one
      .findAll("button")
      .find((x) => x.text() === "另存裁剪音频")!
      .trigger("click");
    wrapper!.unmount();
    wrapper = undefined;
    finish(new Blob(["wav"]));
    await flushPromises();
    expect(audioLibraryApi.clip).not.toHaveBeenCalled();
    expect(queueState()).toEqual(before);
  });
  it("未点击时不加载文件；独立播放不创建队列，暂停、拖动、停止只作用于当前条目", async () => {
    const [one] = await open();
    expect(one.get("audio").attributes("src")).toBeUndefined();
    expect(one.get("audio").attributes("preload")).toBe("none");
    const before = queueState();
    await one.get(".library-item-play").trigger("click");
    await flushPromises();
    expect(one.get(".library-item-play").text()).toBe("暂停");
    one.getComponent(AudioWaveform).vm.$emit("seek", 4);
    await flushPromises();
    expect((one.get("audio").element as HTMLAudioElement).currentTime).toBe(4);
    await one.get(".library-item-play").trigger("click");
    expect(one.get(".library-item-play").text()).toBe("播放");
    await one
      .findAll("button")
      .find((x) => x.text() === "停止")!
      .trigger("click");
    expect((one.get("audio").element as HTMLAudioElement).currentTime).toBe(0);
    expect(queueState()).toEqual(before);
  });
  it("队列与单条双向播放不互相暂停，队列顺序、设置和进度保持不变", async () => {
    const [one] = await open();
    queue.add([item("queue"), item("queue2")]);
    await queue.play();
    queue.seek(3);
    queue.mode = "list";
    queue.gap = 7;
    queue.setVolume(0.6);
    const before = queueState();
    await one.get(".library-item-play").trigger("click");
    await flushPromises();
    expect(queueState()).toEqual(before);
    const inlineAudio = one.get("audio").element;
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    await queue.play();
    await flushPromises();
    expect(vi.mocked(HTMLMediaElement.prototype.pause).mock.contexts).not.toContain(inlineAudio);
    expect(one.get(".library-item-play").text()).toBe("暂停");
    expect(queueState()).toEqual(before);
    items.value[0] = { ...items.value[0], revision: 2 };
    await flushPromises();
    expect(one.get(".library-item-play").text()).toBe("暂停");
  });
  it("列表只播放一条，播放结束不自动切换，卸载列表不影响队列", async () => {
    const [one, two] = await open();
    queue.add([item("queue")]);
    await queue.play();
    const before = queueState();
    await one.get(".library-item-play").trigger("click");
    await flushPromises();
    await two.get(".library-item-play").trigger("click");
    await flushPromises();
    expect(one.get(".library-item-play").text()).toBe("播放");
    expect(two.get(".library-item-play").text()).toBe("暂停");
    const plays = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    await two.get("audio").trigger("ended");
    await flushPromises();
    expect(two.get(".library-item-play").text()).toBe("播放");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(plays);
    wrapper!.unmount();
    wrapper = undefined;
    expect(queueState()).toEqual(before);
  });
  it("队列等待下一条的计时不被分组播放打断", async () => {
    const [one] = await open();
    vi.useFakeTimers();
    queue.add([item("queue"), item("queue2")]);
    queue.gap = 2;
    await queue.play();
    await host!.get("audio").trigger("ended");
    expect(queue.phase).toBe("waiting");
    const nextId = queue.currentId;
    await one.get(".library-item-play").trigger("click");
    await flushPromises();
    expect(queue.phase).toBe("waiting");
    await vi.advanceTimersByTimeAsync(2000);
    expect(queue.phase).toBe("playing");
    expect(queue.currentId).toBe(nextId);
    expect(one.get(".library-item-play").text()).toBe("暂停");
  });
  it("播放失败可重试，不影响队列；失效素材不能播放", async () => {
    const [one] = await open();
    const before = queueState();
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("decode"));
    await one.get(".library-item-play").trigger("click");
    await flushPromises();
    expect(one.get('[role="alert"]').text()).toContain("播放失败");
    const failedAudio = one.get("audio").element;
    await one.get(".library-item-play").trigger("click");
    await flushPromises();
    expect(one.find('[role="alert"]').exists()).toBe(false);
    expect(one.get("audio").element).not.toBe(failedAudio);
    expect(one.get(".library-item-play").text()).toBe("暂停");
    items.value[0] = item("one", false);
    await flushPromises();
    expect(one.get(".library-item-play").attributes("disabled")).toBeDefined();
    expect(one.get("audio").attributes("src")).toBeUndefined();
    expect(queueState()).toEqual(before);
  });
  it("停止后迟到的播放结果和事件不恢复播放状态", async () => {
    const [one] = await open();
    let finish!: () => void;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    await one.get(".library-item-play").trigger("click");
    await flushPromises();
    await one
      .findAll("button")
      .find((x) => x.text() === "停止")!
      .trigger("click");
    finish();
    await flushPromises();
    await one.get("audio").trigger("playing");
    expect(one.get(".library-item-play").text()).toBe("播放");
  });
});
