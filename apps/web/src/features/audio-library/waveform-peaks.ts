/** 仅缓存轻量真实振幅，串行解码可见条目，避免列表同时占用大量音频内存。 */
import { decodeAudioSamples } from "./clip-audio";
export interface WaveformData {
  peaks: Float32Array;
  duration: number;
}
const cache = new Map<string, WaveformData>();
let tail: Promise<unknown> = Promise.resolve();
export function extractWaveformPeaks(
  audio: Pick<AudioBuffer, "length" | "numberOfChannels" | "getChannelData">,
  count = 1200
) {
  const peaks = new Float32Array(count);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  for (let i = 0; i < count; i++) {
    const first = Math.floor((i * audio.length) / count),
      last = Math.max(first + 1, Math.floor(((i + 1) * audio.length) / count));
    const step = Math.max(1, Math.floor((last - first) / 128));
    for (let frame = first; frame < last && frame < audio.length; frame += step)
      for (const channel of channels) peaks[i] = Math.max(peaks[i], Math.abs(channel[frame] || 0));
  }
  return peaks;
}
/** 缺少时长的归档快照先读元数据，仍沿用有界串行解码与轻量缓存。 */
function readDuration(url: string, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const audio = new Audio();
    const finish = (error?: Error) => {
      const duration = audio.duration;
      clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", ready);
      audio.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      audio.removeAttribute("src");
      audio.load();
      error ? reject(error) : resolve(duration);
    };
    const ready = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? finish() : failed());
    const failed = () => finish(new Error("音频时长读取失败"));
    const aborted = () => finish(new DOMException("已取消波形读取", "AbortError"));
    const timer = setTimeout(failed, 15000);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", ready, { once: true });
    audio.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    audio.src = url;
    audio.load();
  });
}
export function loadWaveformData(
  url: string,
  duration: number,
  signal: AbortSignal,
  version = ""
): Promise<WaveformData> {
  const key = `${url}:${duration}:${version}`;
  const task = tail.then(async () => {
    signal.throwIfAborted();
    const cached = cache.get(key);
    if (cached) return cached;
    const actualDuration = duration > 0 ? duration : await readDuration(url, signal);
    const decoded = await decodeAudioSamples(url, actualDuration, signal, () => undefined, 8000);
    signal.throwIfAborted();
    const peaks = extractWaveformPeaks(decoded);
    const data = { peaks, duration: decoded.length / decoded.sampleRate };
    cache.set(key, data);
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
    return data;
  });
  tail = task.catch(() => undefined);
  return task;
}

export async function loadWaveformPeaks(url: string, duration: number, signal: AbortSignal): Promise<Float32Array> {
  return (await loadWaveformData(url, duration, signal)).peaks;
}
