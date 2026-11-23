/** 两秒窗口逐段推理，保留一帧上下文；切镜处只延续原帧，不生成跨镜头画面。 */
import fs from "node:fs/promises";
import path from "node:path";
import type { ArchiveInterpolation } from "@toolbox/shared";
import { runMediaProcess, VideoEditError, type RenderVideoOptions } from "./renderer";

export function sceneGroups(gray: Uint8Array, count: number, protect: boolean, forced: number[] = []) {
  const cuts = [0];
  if (protect)
    for (let i = 1; i < count; i++) {
      let difference = 0;
      for (let p = 0; p < 64; p++) difference += Math.abs(gray[i * 64 + p] - gray[(i - 1) * 64 + p]);
      if (difference / (64 * 255) > 0.3) cuts.push(i);
    }
  if (protect) cuts.push(...forced.filter((value) => value > 0 && value < count));
  const ordered = [...new Set([...cuts, count])].sort((a, b) => a - b);
  return ordered.slice(0, -1).map((start, i) => ({ start, end: ordered[i + 1] }));
}
async function link(source: string, target: string) {
  try {
    await fs.link(source, target);
  } catch {
    await fs.copyFile(source, target);
  }
}
async function directoryBytes(root: string): Promise<number> {
  let total = 0;
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    total += entry.isDirectory() ? await directoryBytes(file) : (await fs.stat(file)).size;
  }
  return total;
}
export async function renderRifeInterpolation(
  options: RenderVideoOptions,
  input: string,
  output: string,
  settings: ArchiveInterpolation,
  fps: number,
  duration: number,
  nativeFps: number,
  maxBytes: number
) {
  const runtime = options.tools.rife!;
  if (!(nativeFps > 0)) throw new VideoEditError("ARCHIVE_INTERPOLATION_FPS_INVALID", "无法确定补帧源帧率");
  // 高倍速时有效帧率可达数千 FPS；无需插帧的片段直接采样，避免先解出海量 PNG。
  if (nativeFps >= fps) {
    options.onStatus?.("源画面帧率已足够，按目标帧率输出");
    await runMediaProcess(
      options.tools.ffmpeg,
      [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-i",
        input,
        "-vf",
        `fps=${fps},tpad=stop_mode=clone:stop=${Math.ceil(duration * fps)},trim=duration=${duration},setpts=PTS-STARTPTS`,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-t",
        String(duration),
        "-r",
        String(fps),
        "-c:v",
        "ffv1",
        "-level",
        "3",
        "-c:a",
        "copy",
        output
      ],
      options.signal,
      { output, maxBytes }
    );
    return;
  }
  const directory = await fs.mkdtemp(`${output}.rife-`),
    quota = new AbortController();
  const signal = AbortSignal.any([options.signal, quota.signal]);
  let checking = false,
    tooLarge = false;
  const timer = setInterval(() => {
    if (checking) return;
    checking = true;
    void directoryBytes(directory)
      .then((bytes) => {
        if (bytes > maxBytes) {
          tooLarge = true;
          quota.abort();
        }
      })
      .catch(() => {})
      .finally(() => {
        checking = false;
      });
  }, 500);
  timer.unref();
  const run = (executable: string, args: string[], target?: string) =>
    runMediaProcess(executable, args, signal, { output: target, maxBytes, timeoutMs: 600_000 });
  try {
    const frameCount = Math.max(1, Math.ceil(duration * fps - 1e-7));
    const lines = ["ffconcat version 1.0"];
    for (let first = 0, part = 0; first < frameCount; first += fps * 2, part++) {
      signal.throwIfAborted();
      const last = Math.min(frameCount, first + fps * 2),
        start = first / fps;
      const firstNative = Math.floor(start * nativeFps + 1e-7);
      const lastNative = Math.min(Math.ceil(duration * nativeFps - 1e-7) - 1, Math.ceil((last / fps) * nativeFps) + 1);
      const count = Math.max(1, lastNative - firstNative + 1);
      const block = path.join(directory, `block-${part}`),
        originals = path.join(block, "original"),
        targets = path.join(block, "target");
      await fs.mkdir(originals, { recursive: true });
      await fs.mkdir(targets);
      options.onStatus?.(
        `AI 补帧 · ${Math.floor((first / frameCount) * 100)}% · ${settings.quality === "high" ? "高质量" : settings.quality === "fast" ? "快速" : "均衡"}`
      );
      await run(options.tools.ffmpeg, [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-ss",
        String(firstNative / nativeFps),
        "-i",
        input,
        "-vf",
        `tpad=stop_mode=clone:stop_duration=1,fps=${nativeFps}`,
        "-frames:v",
        String(count),
        "-start_number",
        "0",
        path.join(originals, "%08d.png")
      ]);
      const files = (await fs.readdir(originals)).filter((name) => /^\d{8}\.png$/.test(name)).sort();
      if (!files.length) throw new VideoEditError("ARCHIVE_INTERPOLATION_DECODE_FAILED", "补帧源画面读取失败");
      const grayFile = path.join(block, "gray.bin");
      await run(
        options.tools.ffmpeg,
        [
          "-v",
          "error",
          "-nostdin",
          "-y",
          "-start_number",
          "0",
          "-i",
          path.join(originals, "%08d.png"),
          "-vf",
          "scale=8:8,format=gray",
          "-f",
          "rawvideo",
          grayFile
        ],
        grayFile
      );
      const groups = sceneGroups(
        await fs.readFile(grayFile),
        files.length,
        settings.sceneProtection,
        (options.interpolationBoundaries ?? []).map((time) => Math.ceil(time * nativeFps - 1e-7) - firstNative)
      );
      const generated: { start: number; end: number; files: string[] }[] = [];
      for (const [g, group] of groups.entries()) {
        const size = group.end - group.start;
        if (size === 1 || nativeFps >= fps) {
          generated.push({ ...group, files: [] });
          continue;
        }
        const sourceDir = path.join(block, `in-${g}`),
          resultDir = path.join(block, `out-${g}`);
        await fs.mkdir(sourceDir);
        await fs.mkdir(resultDir);
        for (let i = 0; i < size; i++)
          await link(
            path.join(originals, files[group.start + i]),
            path.join(sourceDir, `${String(i).padStart(8, "0")}.png`)
          );
        const wanted = Math.max(size, Math.ceil(((size - 1) * fps) / nativeFps) + 1);
        const common = [
          "-i",
          sourceDir,
          "-o",
          resultDir,
          "-n",
          String(wanted),
          "-m",
          runtime.model,
          "-j",
          "1:1:1",
          "-f",
          "%08d.png"
        ];
        const quality = settings.quality === "high" ? ["-x", "-z"] : settings.quality === "balanced" ? ["-z"] : [];
        let diagnostics = "";
        try {
          await runMediaProcess(runtime.executable, [...common, ...quality], signal, {
            timeoutMs: 600_000,
            onDiagnostic: (text) => {
              diagnostics = (diagnostics + text).slice(-8192);
            }
          });
        } catch {
          signal.throwIfAborted();
          if (!/memory|allocation|vulkan|vkCreate|gpu|device/i.test(diagnostics))
            throw new VideoEditError("ARCHIVE_INTERPOLATION_ENGINE_FAILED", "AI 补帧失败，请检查补帧能力包与模型", 503);
          options.onStatus?.("显存或设备资源不足，使用低占用 CPU 模式重试");
          for (const name of await fs.readdir(resultDir)) await fs.rm(path.join(resultDir, name), { force: true });
          await run(runtime.executable, [...common, ...quality, "-g", "-1"]);
        }
        const names = (await fs.readdir(resultDir)).filter((name) => /^\d{8}\.png$/.test(name)).sort();
        if (names.length !== wanted)
          throw new VideoEditError("ARCHIVE_INTERPOLATION_ENGINE_OUTPUT", "AI 补帧输出帧数不正确，原片保留");
        generated.push({ ...group, files: names.map((name) => path.join(resultDir, name)) });
      }
      for (let frame = first; frame < last; frame++) {
        const offset = Math.max(0, (frame / fps) * nativeFps - firstNative),
          base = Math.min(files.length - 1, Math.floor(offset + 1e-7));
        const group = generated.find((entry) => base >= entry.start && base < entry.end)!;
        const source =
          group.files.length && offset < group.end - 1
            ? group.files[
                Math.min(
                  group.files.length - 1,
                  Math.round(((offset - group.start) / (group.end - group.start - 1)) * (group.files.length - 1))
                )
              ]
            : path.join(originals, files[base]);
        await link(source, path.join(targets, `${String(frame - first).padStart(8, "0")}.png`));
      }
      const name = `part-${part}.mkv`,
        file = path.join(directory, name);
      await run(
        options.tools.ffmpeg,
        [
          "-v",
          "error",
          "-nostdin",
          "-y",
          "-framerate",
          String(fps),
          "-start_number",
          "0",
          "-i",
          path.join(targets, "%08d.png"),
          "-frames:v",
          String(last - first),
          "-c:v",
          "ffv1",
          "-level",
          "3",
          "-pix_fmt",
          "yuv420p",
          file
        ],
        file
      );
      lines.push(`file '${name}'`);
      await fs.rm(block, { recursive: true, force: true });
      if ((await directoryBytes(directory)) > maxBytes)
        throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "补帧临时文件超过可用空间", 507);
      options.onProgress((last / frameCount) * 100);
    }
    const list = path.join(directory, "parts.ffconcat");
    await fs.writeFile(list, lines.join("\n"));
    await run(
      options.tools.ffmpeg,
      [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        list,
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "1:a?",
        "-t",
        String(duration),
        "-c",
        "copy",
        output
      ],
      output
    );
  } catch (error) {
    if (tooLarge) throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "补帧临时空间不足，原视频保留", 507);
    throw error;
  } finally {
    clearInterval(timer);
    await fs.rm(directory, { recursive: true, force: true });
  }
}
