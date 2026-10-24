import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { ImageAiOperation } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { FileMetadataRepository } from "../../database/file-metadata";
import { commitStagedFile } from "../../storage/file-commit-gateway";
import type { StoredImageAiTask } from "./types";
import type { createImageAiWorkerClient } from "./worker-client";
import type { createImageAiTaskPersistence } from "./task-persistence";

type InferenceTerminal = Parameters<ReturnType<typeof createImageAiTaskPersistence>["commitTerminal"]>[1];

// The manager retains state/queue ownership, terminal publication and product-image execution.
type InferenceHooks = {
  patchTask: (task: StoredImageAiTask, patch: Partial<StoredImageAiTask>) => void;
  persist: (task: StoredImageAiTask) => Promise<void>;
  unique: (values: string[]) => string[];
  processComposition: (task: StoredImageAiTask) => Promise<void>;
  finishInference: (task: StoredImageAiTask, terminal: InferenceTerminal) => void;
};

export function createImageAiInferenceExecutor(
  config: Pick<AppConfig, "imageAiOutputsDir">,
  worker: Pick<ReturnType<typeof createImageAiWorkerClient>, "process">,
  shutdownController: AbortController,
  { patchTask, persist, unique, processComposition, finishInference }: InferenceHooks,
  fileMetadata?: FileMetadataRepository
) {
  async function processTask(task: StoredImageAiTask) {
    if (task.operation === "product_image") return processComposition(task);
    // 每张图片独立记录结果和警告，部分失败仍可完成任务；服务关闭则显式标记为可重试的中断。
    patchTask(task, { status: "running", progress: 5, queuePosition: null });
    await persist(task);
    const outputDir = path.join(config.imageAiOutputsDir, task.id);
    await fs.mkdir(outputDir, { recursive: true });
    let failures = 0;

    for (let index = 0; index < task.inputs.length; index += 1) {
      if (task.cancelRequested) break;
      const input = task.inputs[index];
      const outputName = outputFileName(input.originalName, task.operation, index);
      const outputPath = path.join(outputDir, outputName);

      try {
        const inference = await worker.process({
          operation: task.operation,
          inputPath: input.path,
          outputPath,
          maskPath: task.maskPath,
          scale: task.scale,
          signal: shutdownController.signal
        });
        await sanitizePng(outputPath);
        const metadata = await sharp(outputPath).metadata();
        if (!metadata.width || !metadata.height) throw new Error("AI 输出图片尺寸无效");
        task.results.push({
          id: `${task.id}-${index + 1}`,
          originalName: input.originalName,
          outputName,
          outputPath,
          downloadUrl: `/api/v1/tools/image-ai/tasks/${task.id}/files/${task.id}-${index + 1}`,
          width: metadata.width,
          height: metadata.height,
          provider: inference.provider,
          model: inference.model,
          warnings: inference.warnings ?? []
        });
        task.warnings = unique([...task.warnings, ...(inference.warnings ?? [])]);
        await fileMetadata
          ?.registerIfExists({
            entityKind: "image-ai-result",
            entityId: task.id,
            filePath: outputPath,
            mediaType: "image/png",
            owner: "local",
            id: `${task.id}-${index + 1}`
          })
          .catch(() => undefined);
      } catch (error) {
        if (shutdownController.signal.aborted) {
          finishInference(task, {
            status: "failed",
            progress: 100,
            error: "任务因服务关闭而中断，请手动重试"
          });
          return;
        }
        failures += 1;
        task.warnings = unique([
          ...task.warnings,
          `${input.originalName}：${error instanceof Error ? error.message : "处理失败"}`
        ]);
      }

      patchTask(task, {
        progress: Math.min(95, Math.round(10 + ((index + 1) / task.inputs.length) * 85))
      });
      await persist(task);
    }

    let terminal: InferenceTerminal;
    if (task.cancelRequested) {
      terminal = { status: "canceled", progress: 100 };
    } else if (failures === task.inputs.length) {
      terminal = {
        status: "failed",
        progress: 100,
        error: "所有图片均处理失败，请检查本地模型与推理服务状态"
      };
    } else {
      if (failures > 0) task.warnings = unique([...task.warnings, `${failures} 张图片处理失败`]);
      terminal = { status: "completed", progress: 100 };
    }
    finishInference(task, terminal);
  }

  return processTask;
}

function outputFileName(originalName: string, operation: ImageAiOperation, index: number) {
  const stem =
    path
      .parse(path.basename(originalName))
      .name.replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .slice(0, 80) || `image-${index + 1}`;
  const suffix: Record<ImageAiOperation, string> = {
    watermark_remove: "clean",
    enhance: "enhanced",
    background_remove: "cutout",
    product_image: "product"
  };
  return `${stem}-${index + 1}-${suffix[operation]}.png`;
}

async function sanitizePng(outputPath: string) {
  const temporary = `${outputPath}.sanitized.png`;
  await sharp(outputPath, { limitInputPixels: 100_000_000 }).rotate().png({ compressionLevel: 9 }).toFile(temporary);
  await fs.rm(outputPath, { force: true });
  await commitStagedFile(temporary, outputPath);
}
