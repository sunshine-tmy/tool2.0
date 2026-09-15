import path from "node:path";
import { normalizeImageOptions } from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { FileMetadataRepository } from "../database/file-metadata";
import type { Task, TaskStore } from "../tasks/task-store";
import { ImageFileGateway } from "./image-compress-file-gateway";
import { parseImageOptions } from "./image-compress-input";

export class ImageCompressionService {
  private readonly files: ImageFileGateway;

  constructor(
    private readonly config: AppConfig,
    private readonly taskStore: TaskStore,
    private readonly fileMetadata?: FileMetadataRepository
  ) {
    this.files = new ImageFileGateway(config);
  }

  async process(task: Task, input: Buffer, originalName: string, fields: Record<string, unknown>) {
    const options = normalizeImageOptions(parseImageOptions(fields));
    const originalSize = input.length;
    const outputName = `${task.id}.${options.outputFormat}`;
    const outputPath = path.join(this.config.outputDir, outputName);
    const result = await this.files.compress(input, outputPath, options);
    await this.fileMetadata
      ?.registerIfExists({
        entityKind: "image-compress",
        entityId: task.id,
        filePath: outputPath,
        mediaType: `image/${options.outputFormat}`,
        owner: "local"
      })
      .catch(() => undefined);
    const completed = this.taskStore.update(task.id, {
      status: "completed",
      progress: 100,
      outputPath: outputName
    });
    if (!completed) throw new Error("Image task disappeared during processing");
    return {
      task: completed,
      downloadUrl: `/api/v1/files/${outputName}`,
      originalName,
      outputName,
      outputFormat: options.outputFormat,
      originalSize,
      outputSize: result.outputSize,
      savedBytes: originalSize - result.outputSize,
      compressionRatio: originalSize > 0 ? result.outputSize / originalSize : 1,
      width: result.width,
      height: result.height
    };
  }

  fail(taskId: string, message: string) {
    this.taskStore.update(taskId, { status: "failed", progress: 100, error: message });
  }
}
