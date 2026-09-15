import fs from "node:fs";
import fsp from "node:fs/promises";
import type { FastifyReply } from "fastify";
import { fail } from "@toolbox/shared";
import type { EdgeTtsTask } from "@toolbox/shared";
import type { TaskPaths } from "./types";
import { sanitizeFileName } from "./input";

type EdgeTtsFileStore = {
  get: (id: string) => EdgeTtsTask | undefined;
  paths: (id: string) => TaskPaths;
};

export async function sendTaskFile(
  store: EdgeTtsFileStore,
  taskId: string,
  kind: "audio" | "subtitle",
  reply: FastifyReply,
  download: boolean
) {
  const task = store.get(taskId);
  if (!task) return reply.code(404).send(fail("EDGE_TTS_TASK_NOT_FOUND", "语音任务不存在"));
  if (task.status !== "completed") {
    return reply.code(409).send(fail("EDGE_TTS_TASK_NOT_READY", "语音文件尚未生成完成"));
  }
  if (kind === "subtitle" && !task.includeSubtitles) {
    return reply.code(404).send(fail("EDGE_TTS_SUBTITLE_NOT_FOUND", "该任务没有字幕文件"));
  }
  const paths = store.paths(taskId);
  const filePath = kind === "audio" ? paths.audio : paths.subtitle;
  try {
    const stat = await fsp.stat(filePath);
    const extension = kind === "audio" ? ".mp3" : ".srt";
    const baseName = sanitizeFileName(task.fileName || `edge-tts-${task.id}`);
    reply.header("content-type", kind === "audio" ? "audio/mpeg" : "application/x-subrip; charset=utf-8");
    reply.header("content-length", String(stat.size));
    reply.header("x-content-type-options", "nosniff");
    if (download) {
      reply.header("content-disposition", contentDisposition(`${baseName}${extension}`));
    } else {
      reply.header("cache-control", "private, max-age=3600");
    }
    return reply.send(fs.createReadStream(filePath));
  } catch {
    return reply.code(404).send(fail("EDGE_TTS_FILE_NOT_FOUND", "生成文件不存在或已被清理"));
  }
}

function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
