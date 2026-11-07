/**
 * 中文模块说明：视频去字幕领域，负责任务队列、Worker 调用和本机结果文件
 */
import type { VideoAiTask } from "@toolbox/shared";

export type StoredVideoAiTask = Omit<VideoAiTask, "output"> & {
  inputPath: string;
  outputPath?: string;
  outputBytes?: number;
  outputWidth?: number;
  outputHeight?: number;
  outputDurationMs?: number | null;
  /** Worker progress hand-off file; deleted with the task directory. */
  progressPath?: string;
  cancelFlagPath?: string;
  cancelRequested?: boolean;
};
