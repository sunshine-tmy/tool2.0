/** 仅缓存轻量真实振幅，串行解码可见条目，避免列表同时占用大量音频内存。 */
import { decodeAudioSamples } from "./clip-audio";
const cache = new Map<string, Float32Array>();
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
export function loadWaveformPeaks(url: string, duration: number, signal: AbortSignal): Promise<Float32Array> {
  const key = `${url}:${duration}`;
  const task = tail.then(async () => {
    signal.throwIfAborted();
    const cached = cache.get(key);
    if (cached) return cached;
    const decoded = await decodeAudioSamples(url, duration, signal, () => undefined, 8000);
    signal.throwIfAborted();
    const peaks = extractWaveformPeaks(decoded);
    cache.set(key, peaks);
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
    return peaks;
  });
  tail = task.catch(() => undefined);
  return task;
}
