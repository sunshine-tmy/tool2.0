/** 分片段速度和声音处理：顺序生成无损中间片段，避免多路解码缓存和二次有损编码。 */
import fs from "node:fs/promises";
import path from "node:path";
import { prepareFreeLayout } from "./free-layout";
import { archiveClipDuration, archiveCutDuration, archiveTransitionDuration } from "@toolbox/shared";
import { probeMedia, runMediaProcess, VideoEditError, type RenderVideoOptions } from "./renderer";

export async function prepareClipEffects(options: RenderVideoOptions) {
  const directory = await fs.mkdtemp(`${options.output}.clips-`);
  try {
    const info = await probeMedia(options.tools, options.source, options.signal, true, true);
    const clips = options.cut!;
    const total = archiveCutDuration(clips);
    const free = clips.some((clip) => clip.at !== undefined);
    const normalize = free || clips.some((clip) => clip.sourceId || clip.transition);
    const width = Math.max(2, Math.floor(info.width / 2) * 2),
      height = Math.max(2, Math.floor(info.height / 2) * 2);
    const probed = new Map([[options.source, info]]);
    if (!clips.length || total <= 0 || total > 7200)
      throw new VideoEditError("ARCHIVE_CUT_TOO_LONG", "剪辑后视频时长须在 0～2 小时之间");
    let occupied = 0,
      processed = 0;
    const lines = ["ffconcat version 1.0"];
    for (const [i, clip] of clips.entries()) {
      options.signal.throwIfAborted();
      const sourceFile = clip.sourceId ? options.clipSources?.[clip.sourceId] : options.source;
      if (!sourceFile) throw new VideoEditError("ARCHIVE_SOURCE_MISSING", "拼接片段的来源素材不存在");
      let sourceInfo = probed.get(sourceFile);
      if (!sourceInfo) {
        sourceInfo = await probeMedia(options.tools, sourceFile, options.signal, true, true);
        probed.set(sourceFile, sourceInfo);
      }
      if (clip.start < 0 || clip.end <= clip.start || clip.end > sourceInfo.duration + 0.001)
        throw new VideoEditError("ARCHIVE_CUT_RANGE_INVALID", "剪辑片段超出原片范围");
      const duration = archiveClipDuration(clip),
        speed = clip.speed ?? 1;
      const name = `clip-${i}.mkv`,
        output = path.join(directory, name);
      const fades = [
        clip.fadeIn ? `afade=t=in:st=0:d=${Math.min(clip.fadeIn, duration / 2)}` : "",
        clip.fadeOut
          ? `afade=t=out:st=${duration - Math.min(clip.fadeOut, duration / 2)}:d=${Math.min(clip.fadeOut, duration / 2)}`
          : ""
      ].filter(Boolean);
      // atempo 保持音高；拆成 0.5～2 倍的链以兼容现有 FFmpeg 运行时。
      let tempo = speed;
      const tempos: number[] = [];
      while (tempo > 2) {
        tempos.push(2);
        tempo /= 2;
      }
      while (tempo < 0.5) {
        tempos.push(0.5);
        tempo /= 0.5;
      }
      tempos.push(tempo);
      const audio = sourceInfo.hasAudio
        ? `[0:a:0]atrim=duration=${clip.end - clip.start},asetpts=PTS-STARTPTS,${tempos.map((value) => `atempo=${value}`).join(",")},volume=${(clip.volume ?? 100) / 100}${fades.length ? "," + fades.join(",") : ""},aresample=48000,apad,atrim=duration=${duration},aformat=sample_fmts=s16:channel_layouts=stereo[a]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${duration}[a]`;
      const remaining = options.maxBytes - occupied;
      if (remaining < 1024 * 1024)
        throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "剪辑处理中间空间不足，原成品保留", 507);
      await runMediaProcess(
        options.tools.ffmpeg,
        [
          "-hide_banner",
          "-v",
          "error",
          "-nostdin",
          "-y",
          "-protocol_whitelist",
          "file,pipe",
          "-ss",
          String(clip.start),
          "-i",
          sourceFile,
          "-filter_complex",
          `[0:v:0]trim=duration=${clip.end - clip.start},setpts=(PTS-STARTPTS)/${speed},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1${normalize ? ",fps=30,format=yuv420p" : ""}[v];${audio}`,
          "-map",
          "[v]",
          "-map",
          "[a]",
          "-t",
          String(duration),
          "-fps_mode",
          "vfr",
          "-c:v",
          "ffv1",
          "-level",
          "3",
          "-c:a",
          "pcm_s16le",
          "-metadata:s:v:0",
          "rotate=0",
          "-progress",
          "pipe:1",
          "-nostats",
          output
        ],
        options.signal,
        {
          output,
          maxBytes: remaining,
          onOutput: (chunk) => {
            for (const match of chunk.matchAll(/out_time_us=(\d+)/g))
              options.onProgress(
                Math.min(
                  free ? 35 : 60,
                  ((processed + Number(match[1]) / 1000000) /
                    Math.max(
                      total,
                      clips.reduce((sum, clip) => sum + archiveClipDuration(clip), 0)
                    )) *
                    (free ? 35 : 60)
                )
              );
          }
        }
      );
      occupied += (await fs.stat(output)).size;
      // 所有片段准备完成后，再输出主体与转场列表。
      processed += duration;
    }
    if (free) return await prepareFreeLayout(options, directory, info, occupied);
    for (const [i, clip] of clips.entries()) {
      const length = archiveClipDuration(clip),
        head = i > 0 ? archiveTransitionDuration(clips, i - 1) : 0,
        tail = archiveTransitionDuration(clips, i);
      if (length - head - tail > 0.00001)
        lines.push(
          `file 'clip-${i}.mkv'`,
          `inpoint ${head}`,
          `outpoint ${length - tail}`,
          `duration ${length - head - tail}`
        );
      if (tail > 0) {
        const name = `transition-${i}.mkv`,
          output = path.join(directory, name);
        const remaining = options.maxBytes - occupied;
        if (remaining < 1024 * 1024) throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "转场处理中间空间不足", 507);
        await runMediaProcess(
          options.tools.ffmpeg,
          [
            "-hide_banner",
            "-v",
            "error",
            "-nostdin",
            "-y",
            "-ss",
            String(length - tail),
            "-i",
            path.join(directory, `clip-${i}.mkv`),
            "-i",
            path.join(directory, `clip-${i + 1}.mkv`),
            "-filter_complex",
            `[0:v]trim=duration=${tail},setpts=PTS-STARTPTS,settb=AVTB[a];[1:v]trim=duration=${tail},setpts=PTS-STARTPTS,settb=AVTB[b];[a][b]xfade=transition=${clip.transition!.type}:duration=${tail}:offset=0[v];[0:a]atrim=duration=${tail},asetpts=PTS-STARTPTS[aa];[1:a]atrim=duration=${tail},asetpts=PTS-STARTPTS[ab];[aa][ab]acrossfade=d=${tail}[audio]`,
            "-map",
            "[v]",
            "-map",
            "[audio]",
            "-t",
            String(tail),
            "-c:v",
            "ffv1",
            "-level",
            "3",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "pcm_s16le",
            output
          ],
          options.signal,
          { output, maxBytes: remaining }
        );
        occupied += (await fs.stat(output)).size;
        lines.push(`file '${name}'`, `duration ${tail}`);
      }
    }
    const list = path.join(directory, "clips.ffconcat");
    await fs.writeFile(list, lines.join("\n"), "utf8");
    return { directory, list, duration: total, occupied, info };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}
