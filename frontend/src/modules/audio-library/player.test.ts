/** 不依赖真实音频设备的播放时序测试，重点防止停止后自动播放和试听叠音。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioLibraryItemView } from "@toolbox/shared";
import { AudioLibraryPlayer, type AudioPort } from "./player";

function item(id: string): AudioLibraryItemView {
  return {
    id,
    title: id,
    revision: 1,
    language: "ms",
    foreignText: "Text",
    chineseText: "中文",
    note: "",
    groupId: null,
    fileName: "audio.wav",
    mimeType: "audio/wav",
    bytes: 1644,
    duration: 10,
    sha256: "a".repeat(64),
    source: { kind: "upload" },
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    audioUrl: `/api/v1/tools/audio-library/items/${id}/audio`,
    available: true
  };
}
let player: AudioLibraryPlayer, audio: AudioPort;
const ended = () => {
  (audio.onended as (() => void) | null)?.();
};
beforeEach(() => {
  vi.useFakeTimers();
  player = new AudioLibraryPlayer();
  audio = {
    src: "",
    currentTime: 0,
    volume: 1,
    duration: 10,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    onended: null,
    ontimeupdate: null,
    onerror: null,
    onplaying: null
  };
  player.attach(audio);
  player.add([item("one"), item("two")]);
});
afterEach(() => {
  player.dispose();
  vi.useRealTimers();
});
describe("全局直播音频播放器", () => {
  it("加载预设保留顺序及重复项，停止旧音频和倒计时，不会自动播放", async () => {
    await player.play();
    ended();
    expect(player.phase).toBe("waiting");
    player.replaceQueue([item("two"), item("one"), item("two")], { mode: "list", gap: 7 });
    expect(player.queue.map((x) => x.item.id)).toEqual(["two", "one", "two"]);
    expect(new Set(player.queue.map((x) => x.entryId)).size).toBe(3);
    expect(player.current?.id).toBe("two");
    expect(player.position).toBe(0);
    expect(player.mode).toBe("list");
    expect(player.gap).toBe(7);
    expect(player.phase).toBe("paused");
    await vi.advanceTimersByTimeAsync(10000);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
  it("顺序播放等待默认一秒；停止取消倒计时，不会再自动播放", async () => {
    await player.play();
    ended();
    expect(player.phase).toBe("waiting");
    expect(player.current?.id).toBe("two");
    await vi.advanceTimersByTimeAsync(400);
    player.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(player.phase).toBe("paused");
    expect(player.position).toBe(0);
    expect(player.remaining).toBe(0);
  });
  it("暂停等待保留剩余时间，手动继续后再播放下一条", async () => {
    await player.play();
    player.gap = 3;
    ended();
    await vi.advanceTimersByTimeAsync(1000);
    player.pause();
    expect(player.remaining).toBe(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await player.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(player.phase).toBe("playing");
  });
  it("试听保存原队列位置，结束后不自动恢复；用户继续回到原位置", async () => {
    await player.play();
    audio.currentTime = 4;
    (audio.ontimeupdate as () => void)();
    await player.audition(item("preview"));
    expect(audio.pause).toHaveBeenCalled();
    expect(player.preview?.id).toBe("preview");
    ended();
    await vi.advanceTimersByTimeAsync(5000);
    expect(player.phase).toBe("paused");
    expect(audio.play).toHaveBeenCalledTimes(2);
    await player.resumeQueue();
    expect(player.preview).toBeUndefined();
    expect(player.current?.id).toBe("one");
    expect(audio.currentTime).toBe(4);
  });
  it("单曲/列表循环、零间隔和顺序末尾停止", async () => {
    player.mode = "single";
    player.gap = 0;
    await player.play();
    ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(player.current?.id).toBe("one");
    player.mode = "list";
    await player.select(player.queue[1].entryId);
    await player.resumeQueue();
    ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(player.current?.id).toBe("one");
    player.mode = "sequence";
    await player.select(player.queue[1].entryId);
    await player.resumeQueue();
    ended();
    expect(player.phase).toBe("paused");
    expect(player.position).toBe(0);
  });
  it.each([
    ["sequence", 0],
    ["sequence", 3],
    ["list", 0],
    ["list", 3],
    ["single", 0],
    ["single", 3]
  ] as const)("单次播放仅播一次，%s 模式及 %s 秒间隔也不继续后续播放", async (mode, gap) => {
    player.mode = mode;
    player.gap = gap;
    const selected = player.queue[0].entryId;
    const entries = player.queue.map((entry) => entry.entryId);
    await player.playOnce(selected);
    expect(player.selectionOnly).toBe(true);
    ended();
    await vi.advanceTimersByTimeAsync(10000);
    // 重复、迟到的 ended 事件不能再次触发下一条或循环。
    ended();
    await vi.advanceTimersByTimeAsync(10000);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(player.phase).toBe("paused");
    expect(player.remaining).toBe(0);
    expect(player.position).toBe(0);
    expect(player.currentId).toBe(selected);
    expect(player.mode).toBe(mode);
    expect(player.gap).toBe(gap);
    expect(player.queue.map((entry) => entry.entryId)).toEqual(entries);
  });
  it("等待期间单次播放取消旧倒计时，暂停再继续仍只播该条", async () => {
    player.gap = 3;
    await player.play();
    ended();
    expect(player.phase).toBe("waiting");
    await player.playOnce(player.queue[0].entryId);
    await vi.advanceTimersByTimeAsync(5000);
    expect(audio.play).toHaveBeenCalledTimes(2);
    player.pause();
    await player.play();
    expect(player.selectionOnly).toBe(true);
    ended();
    await vi.advanceTimersByTimeAsync(5000);
    expect(audio.play).toHaveBeenCalledTimes(3);
    expect(player.phase).toBe("paused");
    expect(player.remaining).toBe(0);
  });
  it("主动继续队列或加载预设后恢复正常规则，不残留单条播放限制", async () => {
    await player.playOnce(player.queue[0].entryId);
    audio.currentTime = 4;
    (audio.ontimeupdate as () => void)();
    await player.resumeQueue();
    expect(player.selectionOnly).toBe(false);
    expect(audio.currentTime).toBe(4);
    ended();
    await vi.advanceTimersByTimeAsync(1000);
    expect(player.current?.id).toBe("two");
    expect(player.phase).toBe("playing");
    await player.playOnce(player.queue[0].entryId);
    player.replaceQueue([item("one"), item("two")], { mode: "sequence", gap: 0 });
    expect(player.selectionOnly).toBe(false);
    await player.play();
    ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(player.current?.id).toBe("two");
  });
  it("点击标题只定位到开头保持暂停，取消旧播放/倒计时且不修改队列规则", async () => {
    player.mode = "list";
    player.gap = 3;
    const entries = player.queue.map((entry) => entry.entryId);
    await player.play();
    player.seek(4);
    player.select(entries[1]);
    expect(player.currentId).toBe(entries[1]);
    expect(player.position).toBe(0);
    expect(player.phase).toBe("paused");
    expect(player.selectionOnly).toBe(false);
    ended();
    await vi.advanceTimersByTimeAsync(5000);
    expect(audio.play).toHaveBeenCalledTimes(1);
    // 主播放器的播放仍按队列规则执行，定位本身不会启动播放。
    await player.play();
    ended();
    expect(player.phase).toBe("waiting");
    player.select(entries[1]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(player.currentId).toBe(entries[1]);
    expect(player.phase).toBe("paused");
    expect(player.remaining).toBe(0);
    expect(player.queue.map((entry) => entry.entryId)).toEqual(entries);
    expect(player.mode).toBe("list");
    expect(player.gap).toBe(3);
  });
  it("单次播放启动中定位其他条目，迟到的播放结果不会恢复播放", async () => {
    let resolve!: () => void;
    vi.mocked(audio.play).mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    const pending = player.playOnce(player.queue[0].entryId);
    player.select(player.queue[1].entryId);
    resolve();
    await pending;
    ended();
    await vi.advanceTimersByTimeAsync(10000);
    expect(player.current?.id).toBe("two");
    expect(player.phase).toBe("paused");
    expect(player.selectionOnly).toBe(false);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
  it("重复加入、队列重排不改变当前播放项；删除当前素材立即停止", async () => {
    player.add([item("one")]);
    const entry = player.queue[0].entryId;
    await player.play();
    player.reorder(0, 2);
    expect(player.currentId).toBe(entry);
    expect(player.index).toBe(2);
    player.removeItem("one");
    expect(player.queue.map((x) => x.item.id)).toEqual(["two"]);
    expect(player.phase).toBe("paused");
  });
  it("解码/启动失败进入错误，停止能压制尚未完成的播放承诺", async () => {
    vi.mocked(audio.play).mockRejectedValueOnce(new Error("decode"));
    await player.play();
    expect(player.phase).toBe("error");
    expect(player.error).toContain("重试");
    let resolve!: () => void;
    vi.mocked(audio.play).mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    const pending = player.play();
    player.stop();
    resolve();
    await pending;
    expect(player.phase).toBe("paused");
  });
  it("数值越界安全，清空队列取消所有等待", async () => {
    player.setVolume(9);
    expect(audio.volume).toBe(1);
    player.setVolume(-1);
    expect(audio.volume).toBe(0);
    player.setVolume(NaN);
    expect(audio.volume).toBe(1);
    player.seek(NaN);
    expect(player.position).toBe(0);
    await player.play();
    ended();
    player.clear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(player.current).toBeUndefined();
    expect(player.phase).toBe("idle");
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
});
