/** 全局单音轨播放器；定时器、音频与路由生命周期分离，停止后不会再触发下一条。 */
import { markRaw, reactive } from "vue";
import type { AudioLibraryItemView } from "@toolbox/shared";
import { resolveBackendUrl } from "../../config/runtime";
import { createLocalId } from "../../utils/local-id";
type QueueEntry = { entryId: string; item: AudioLibraryItemView };
export type AudioPort = Pick<
  HTMLAudioElement,
  | "src"
  | "currentTime"
  | "volume"
  | "play"
  | "pause"
  | "onended"
  | "ontimeupdate"
  | "onerror"
  | "onplaying"
  | "duration"
>;
export class AudioLibraryPlayer {
  queue: QueueEntry[] = [];
  currentId = "";
  preview?: AudioLibraryItemView;
  selectionOnly = false;
  phase: "idle" | "loading" | "playing" | "paused" | "waiting" | "error" = "idle";
  mode: "sequence" | "list" | "single" = "sequence";
  gap = 1;
  volume = 1;
  position = 0;
  remaining = 0;
  error = "";
  private audio?: AudioPort;
  private timer?: ReturnType<typeof setInterval>;
  private deadline = 0;
  private generation = 0;
  private queuePosition = 0;
  get savedPosition() {
    return this.preview ? this.queuePosition : this.position;
  }
  get current() {
    return this.preview ?? this.queue.find((x) => x.entryId === this.currentId)?.item;
  }
  get index() {
    return this.queue.findIndex((x) => x.entryId === this.currentId);
  }
  attach(audio: AudioPort) {
    this.audio = markRaw(audio);
    audio.onended = () => this.ended();
    audio.ontimeupdate = () => {
      this.position = audio.currentTime;
    };
    audio.onerror = () => this.fail("音频无法播放，请检查文件或服务连接后重试");
    audio.onplaying = () => {
      if (this.phase === "loading") this.phase = "playing";
    };
  }
  add(items: AudioLibraryItemView[]) {
    for (const item of items) {
      if (this.queue.length >= 200) break;
      this.queue.push({ entryId: createLocalId("audio-queue"), item });
    }
    if (!this.currentId) this.currentId = this.queue[0]?.entryId ?? "";
  }
  replaceQueue(items: AudioLibraryItemView[], settings: { mode: "sequence" | "list" | "single"; gap: number }) {
    this.clear();
    this.error = "";
    this.add(items);
    this.mode = settings.mode;
    this.gap = Number.isFinite(settings.gap) ? Math.max(0, Math.min(300, settings.gap)) : 1;
    this.phase = "paused";
  }
  async play() {
    if (!this.audio || !this.current) return;
    if (this.remaining > 0 && !this.preview) {
      this.wait(this.remaining);
      return;
    }
    this.cancelTimer();
    const token = ++this.generation;
    this.error = "";
    this.phase = "loading";
    const source = resolveBackendUrl(this.current.audioUrl);
    if (this.audio.src !== source && !this.audio.src.endsWith(source)) {
      this.audio.src = source;
    }
    try {
      this.audio.currentTime = this.position;
      this.audio.volume = this.volume;
      await this.audio.play();
      if (token === this.generation) this.phase = "playing";
    } catch {
      if (token === this.generation) this.fail("播放未启动，请点击播放重试，或检查音频是否可用");
    }
  }
  pause() {
    ++this.generation;
    this.audio?.pause();
    if (this.phase === "waiting") this.remaining = Math.max(0, (this.deadline - Date.now()) / 1000);
    this.cancelTimer();
    this.phase = "paused";
  }
  stop() {
    this.pause();
    this.selectionOnly = false;
    this.remaining = 0;
    this.position = 0;
    if (this.audio) this.audio.currentTime = 0;
  }
  toggle() {
    if (["playing", "loading", "waiting"].includes(this.phase)) this.pause();
    else void this.play();
  }
  async audition(item: AudioLibraryItemView) {
    if (!this.preview) this.queuePosition = this.position;
    this.pause();
    this.selectionOnly = false;
    this.preview = item;
    this.position = 0;
    this.remaining = 0;
    await this.play();
  }
  async resumeQueue() {
    this.pause();
    if (this.preview) this.position = this.queuePosition;
    this.preview = undefined;
    this.selectionOnly = false;
    this.remaining = 0;
    await this.play();
  }
  select(entryId: string) {
    if (!this.queue.some((entry) => entry.entryId === entryId)) return false;
    this.stop();
    this.preview = undefined;
    this.currentId = entryId;
    this.error = "";
    return true;
  }
  async playOnce(entryId: string) {
    if (!this.queue.some((entry) => entry.entryId === entryId && entry.item.available)) return;
    if (!this.select(entryId)) return;
    // 单次播放由独立按钮触发，不改动队列顺序或用户保存的循环设置。
    this.selectionOnly = true;
    await this.play();
  }
  step(delta: number) {
    this.stop();
    this.preview = undefined;
    let next = this.index + delta;
    if (this.mode === "list" && this.queue.length) next = (next + this.queue.length) % this.queue.length;
    if (next < 0 || next >= this.queue.length) return;
    this.currentId = this.queue[next].entryId;
    void this.play();
  }
  seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    this.position = Math.max(0, seconds);
    if (this.audio) this.audio.currentTime = this.position;
  }
  setVolume(value: number) {
    this.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    if (this.audio) this.audio.volume = this.volume;
  }
  reorder(from: number, to: number) {
    if (from < 0 || to < 0 || from >= this.queue.length || to >= this.queue.length) return;
    const [entry] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, entry);
  }
  remove(entryId: string) {
    if (this.currentId === entryId) {
      this.stop();
      this.currentId = "";
    }
    this.queue = this.queue.filter((x) => x.entryId !== entryId);
    if (!this.currentId) this.currentId = this.queue[0]?.entryId ?? "";
  }
  removeItem(id: string) {
    if (this.current?.id === id) this.stop();
    if (this.preview?.id === id) this.preview = undefined;
    for (const entry of [...this.queue]) if (entry.item.id === id) this.remove(entry.entryId);
  }
  clear() {
    this.stop();
    this.queue = [];
    this.currentId = "";
    this.preview = undefined;
    this.phase = "idle";
  }
  private ended() {
    // 已停止/暂停或仍在等待时忽略迟到的结束事件，避免重新调度后续音频。
    if (this.phase !== "playing") return;
    if (this.preview) {
      this.pause();
      return;
    }
    if (this.selectionOnly) {
      this.stop();
      return;
    }
    const next = this.mode === "single" ? this.index : this.index + 1;
    if (next >= this.queue.length && this.mode !== "list") {
      this.stop();
      return;
    }
    const nextId = this.queue[next % this.queue.length]?.entryId;
    if (!nextId) {
      this.stop();
      return;
    }
    this.position = 0;
    this.currentId = nextId;
    this.wait(Number.isFinite(this.gap) ? Math.max(0, Math.min(300, this.gap)) : 1);
  }
  private wait(seconds: number) {
    this.cancelTimer();
    this.remaining = seconds;
    if (!seconds) {
      this.remaining = 0;
      void this.play();
      return;
    }
    this.phase = "waiting";
    this.deadline = Date.now() + seconds * 1000;
    this.timer = setInterval(() => {
      this.remaining = Math.max(0, (this.deadline - Date.now()) / 1000);
      if (!this.remaining) {
        this.cancelTimer();
        void this.play();
      }
    }, 200);
  }
  private cancelTimer() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
  private fail(message: string) {
    this.pause();
    this.remaining = 0;
    this.error = message;
    this.phase = "error";
  }
  dispose() {
    this.stop();
    if (this.audio) {
      this.audio.onended = null;
      this.audio.ontimeupdate = null;
      this.audio.onerror = null;
      this.audio.onplaying = null;
    }
  }
}
export const audioLibraryPlayer = reactive(new AudioLibraryPlayer());
