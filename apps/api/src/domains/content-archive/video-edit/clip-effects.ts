/** 分片段速度和声音处理：顺序生成无损中间片段，避免多路解码缓存和二次有损编码。 */
import fs from "node:fs/promises";
import path from "node:path";
import { audioTempo } from "./audio-tempo";
import { prepareFreeLayout } from "./free-layout";
import {
  archiveClipDuration,
  archiveCutDuration,
  archiveTransitionDuration,
  archiveClipRangeValid,
  archiveOutputFps,
  archivePreviewClip,
  defaultArchiveFrame
} from "@toolbox/shared";
import { prepareReverseMedia } from "./reverse-media";
import { renderInterpolation } from "./interpolation";
import { interpolationCacheKey } from "./interpolation-cache";
import { probeMedia, runMediaProcess, renderArchiveVideo, VideoEditError, type RenderVideoOptions } from "./renderer";

export async function prepareClipEffects(options: RenderVideoOptions) {
  const directory = await fs.mkdtemp(`${options.output}.clips-`);
  try {
    const info = await probeMedia(options.tools, options.source, options.signal, true, true);
    const clips = options.cut!;
    const fps = archiveOutputFps(options.frame);
    const total = archiveCutDuration(clips);
    const free = clips.some((clip) => clip.at !== undefined || clip.transform !== undefined);
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
      if (!archiveClipRangeValid(clip, sourceInfo.duration))
        throw new VideoEditError("ARCHIVE_CUT_RANGE_INVALID", "剪辑片段超出原片范围");
      const duration = archiveClipDuration(clip),
        speed = clip.speed ?? 1;
      const name = `clip-${i}.mkv`,
        finalOutput = path.join(directory, name),
        output =
          clip.interpolation && clip.freezeAt === undefined ? path.join(directory, `input-${i}.mkv`) : finalOutput;
      options.onStatus?.(`准备片段 ${i + 1}/${clips.length}`);
      const fades = [
        clip.fadeIn ? `afade=t=in:st=0:d=${Math.min(clip.fadeIn, duration)}` : "",
        clip.fadeOut
          ? `afade=t=out:st=${duration - Math.min(clip.fadeOut, duration)}:d=${Math.min(clip.fadeOut, duration)}`
          : ""
      ].filter(Boolean);
      const audio =
        sourceInfo.hasAudio && clip.freezeAt === undefined
          ? `[0:a:0]atrim=duration=${clip.end - clip.start},asetpts=PTS-STARTPTS,${audioTempo(speed)},volume=${(clip.muted ? 0 : (clip.volume ?? 100)) / 100}${fades.length ? "," + fades.join(",") : ""},aresample=48000,apad,atrim=duration=${duration},aformat=sample_fmts=s16:channel_layouts=stereo[a]`
          : `anullsrc=r=48000:cl=stereo,atrim=duration=${duration}[a]`;
      const remaining = options.maxBytes - occupied;
      if (remaining < 1024 * 1024)
        throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "剪辑处理中间空间不足，原成品保留", 507);
      let pictureSource = sourceFile,
        pictureSeek = clip.freezeAt ?? clip.start;
      let sampleFile: string | undefined,
        sampleSize = 0;
      if (clip.freezeSample) {
        sampleFile = path.join(directory, `sample-${i}.mp4`);
        const sample = archivePreviewClip(clip);
        await renderArchiveVideo({
          ...options,
          ignoreClipInterpolation: false,
          outputSettings: undefined,
          lossless: false,
          output: sampleFile,
          cut: [
            {
              ...sample,
              at: undefined,
              lane: 0,
              hidden: false,
              muted: false,
              locked: false,
              transform: undefined,
              transition: undefined,
              volume: 100,
              fadeIn: 0,
              fadeOut: 0
            }
          ],
          frame: { ...defaultArchiveFrame(), fps: clip.freezeSample.fps },
          studio: { sources: options.studio?.sources ?? [], subtitles: [], musicTracks: [] },
          music: undefined,
          watermark: undefined,
          settings: { ...options.settings, originalVolume: 100, musicVolume: 0 },
          preview: false,
          maxBytes: remaining,
          onProgress: () => {},
          onStatus: (message) => options.onStatus?.(`准备定格取帧 · ${message}`)
        });
        pictureSource = sampleFile;
        pictureSeek = Math.max(0, clip.freezeSample.time - 0.25 / clip.freezeSample.fps);
        sampleSize = (await fs.stat(sampleFile)).size;
      }
      const reverseDirectory = path.join(directory, `reverse-${i}`);
      const reversed =
        clip.reverse && clip.freezeAt === undefined
          ? await prepareReverseMedia(
              options,
              sourceFile,
              clip.start,
              clip.end,
              sourceInfo.hasAudio,
              reverseDirectory,
              remaining - sampleSize
            )
          : undefined;
      const input = reversed
        ? ["-f", "concat", "-safe", "1", "-i", reversed.list]
        : ["-ss", String(pictureSeek), "-i", pictureSource];
      const picture =
        clip.freezeAt !== undefined
          ? `trim=end_frame=1,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${duration},trim=duration=${duration}`
          : `trim=duration=${clip.end - clip.start},setpts=(PTS-STARTPTS)/${speed}`;
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
          ...input,
          "-filter_complex",
          `[0:v:0]${picture},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1${normalize || options.frame?.fps ? `${clip.interpolation && clip.freezeAt === undefined ? "" : `,fps=${fps}`},format=yuv420p` : ""}[v];${audio}`,
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
          maxBytes: remaining - (reversed?.occupied ?? 0) - sampleSize,
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
      if (reversed) await fs.rm(reverseDirectory, { recursive: true, force: true });
      if (sampleFile) await fs.rm(sampleFile, { force: true });
      if (clip.interpolation && clip.freezeAt === undefined) {
        const baseSize = (await fs.stat(output)).size;
        await renderInterpolation(
          {
            ...options,
            onStatus: (message) => options.onStatus?.(`片段 ${i + 1}/${clips.length} · ${message}`),
            onProgress: (value) =>
              options.onProgress(((processed + (duration * value) / 100) / total) * (free ? 35 : 60))
          },
          output,
          finalOutput,
          clip.interpolation,
          fps,
          duration,
          (sourceInfo.fps ?? 30) * speed,
          remaining - baseSize,
          (
            clip.sourceId
              ? options.studio?.sources.find((source) => source.id === clip.sourceId)?.checksum
              : options.sourceChecksum
          )
            ? interpolationCacheKey(
                (clip.sourceId
                  ? options.studio?.sources.find((source) => source.id === clip.sourceId)?.checksum
                  : options.sourceChecksum)!,
                clip,
                fps,
                clip.interpolation.engine === "rife" ? (options.tools.rife?.version ?? "rife-unavailable") : "flow-v1"
              )
            : undefined
        );
        await fs.rm(output, { force: true });
      }
      occupied += (await fs.stat(finalOutput)).size;
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
    return {
      directory,
      list,
      duration: total,
      occupied,
      info: { ...info, fps: normalize || options.frame?.fps ? fps : info.fps },
      frameApplied: false
    };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}
