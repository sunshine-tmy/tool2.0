/** 流式统计真实音轨峰值，只向前端返回轻量采样，不下载或解码整个视频到浏览器。 */
import fs from "node:fs/promises";
import { probeMedia, runMediaProcess, VideoEditError, type MediaTools } from "./renderer";
type Waveform = { duration: number; hasAudio: boolean; peaks: number[] };
const cache = new Map<string, Waveform>();
let tail: Promise<unknown> = Promise.resolve(),
  queued = 0;
export function videoWaveform(tools: MediaTools, file: string, signal: AbortSignal): Promise<Waveform> {
  if (queued >= 24) return Promise.reject(new VideoEditError("ARCHIVE_WAVEFORM_BUSY", "波形读取繁忙，请稍后重试", 429));
  queued++;
  const task = tail
    .then(async () => {
      signal.throwIfAborted();
      const stat = await fs.stat(file),
        key = `${file}:${stat.size}:${stat.mtimeMs}`;
      if (cache.has(key)) return cache.get(key)!;
      const info = await probeMedia(tools, file, signal);
      const result: Waveform = { duration: info.duration, hasAudio: info.hasAudio, peaks: [] };
      if (info.hasAudio) {
        const samples = Math.max(1, Math.ceil((info.duration * 8000) / 1200));
        const output = await runMediaProcess(
          tools.ffmpeg,
          [
            "-hide_banner",
            "-v",
            "error",
            "-nostdin",
            "-threads",
            "1",
            "-protocol_whitelist",
            "file,pipe",
            "-i",
            file,
            "-map",
            "0:a:0",
            "-vn",
            "-af",
            `aresample=8000,asetnsamples=n=${samples}:p=0,astats=metadata=1:reset=1:measure_overall=Peak_level:measure_perchannel=none,ametadata=mode=print:key=lavfi.astats.Overall.Peak_level:file=-`,
            "-t",
            String(info.duration),
            "-f",
            "null",
            "-"
          ],
          signal,
          { timeoutMs: 180000 }
        );
        result.peaks = Array.from(output.matchAll(/lavfi\.astats\.Overall\.Peak_level=([^\s]+)/g), ([, value]) => {
          const db = Number(value);
          return Number.isFinite(db) ? Math.max(0, Math.min(1, 10 ** (db / 20))) : 0;
        }).slice(0, 1201);
        if (!result.peaks.length) throw new VideoEditError("ARCHIVE_WAVEFORM_EMPTY", "音轨波形读取失败，请重试");
      }
      signal.throwIfAborted();
      cache.set(key, result);
      if (cache.size > 24) cache.delete(cache.keys().next().value!);
      return result;
    })
    .finally(() => {
      queued--;
    });
  tail = task.catch(() => undefined);
  return task;
}
