import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../config";
import type { FileMetadataRepository } from "../../database/file-metadata";
import { commitStagedFile } from "../../storage/file-commit-gateway";
import { renderProductImage } from "./product-image-renderer";
import { ownedImageFile, requireProductSpace } from "./product-image-files";
import type { StoredImageAiTask } from "./types";

type CompositionHooks = {
  patchTask: (task: StoredImageAiTask, patch: Partial<StoredImageAiTask>) => void;
  persist: (task: StoredImageAiTask) => Promise<void>;
};

// The manager retains task ownership, scheduling and lifecycle; this adapter only executes its existing composition.
export function createProductImageExecutor(
  config: Pick<AppConfig, "imageAiInputsDir" | "imageAiOutputsDir">,
  shutdownController: AbortController,
  { patchTask, persist }: CompositionHooks,
  fileMetadata?: FileMetadataRepository
) {
  async function processComposition(task: StoredImageAiTask) {
    const outputDir = path.join(config.imageAiOutputsDir, task.id);
    const staging = path.join(outputDir, ".product.staging.png");
    const outputPath = path.join(outputDir, "product.png");
    let terminal: Partial<StoredImageAiTask> = { status: "failed", phase: "保存失败" };
    patchTask(task, { status: "running", phase: "准备素材", progress: 0, queuePosition: null });
    await persist(task);
    try {
      if (!task.recipe || !task.assets) throw new Error("商品图配方或素材缺失");
      for (const file of Object.values(task.assets))
        if (file) await ownedImageFile(config.imageAiInputsDir, task.id, file);
      await requireProductSpace(config.imageAiOutputsDir, task.recipe.canvas.width * task.recipe.canvas.height);
      await fs.mkdir(outputDir, { recursive: true });
      const rendered = await renderProductImage(task.assets, task.recipe, staging, (phase) => {
        patchTask(task, { phase });
        void persist(task).catch(() => undefined);
      });
      if (task.cancelRequested || shutdownController.signal.aborted) {
        terminal = { status: "canceled", phase: "已取消" };
      } else {
        patchTask(task, { phase: "保存记录" });
        await commitStagedFile(staging, outputPath);
        await fileMetadata?.registerIfExists({
          entityKind: "image-ai-result",
          entityId: task.id,
          id: `${task.id}-1`,
          filePath: outputPath,
          mediaType: "image/png",
          owner: "local"
        });
        task.results = [
          {
            id: `${task.id}-1`,
            originalName: task.inputs[0].originalName,
            outputName: "product.png",
            outputPath,
            downloadUrl: `/api/v1/tools/image-ai/tasks/${task.id}/files/${task.id}-1`,
            width: task.recipe.canvas.width,
            height: task.recipe.canvas.height,
            provider: "sharp",
            model: "商品图渲染器 v1",
            warnings: rendered.enlarged ? ["商品经过普通插值放大，不等同于 AI 清晰度增强"] : []
          }
        ];
        terminal = { status: "completed", progress: 100, phase: "已留档" };
      }
    } catch (error) {
      task.results = [];
      fileMetadata?.removeForEntity("image-ai-result", task.id);
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      terminal = {
        status: "failed",
        phase: "保存失败",
        error:
          code === "ENOSPC"
            ? "磁盘空间不足，请先释放空间"
            : error instanceof Error &&
                /^(没有可见商品主体|原图缺失|原图与抠图|请选择背景图片|可用磁盘空间不足)/.test(error.message)
              ? error.message
              : "商品图保存失败，请检查素材是否完整、磁盘空间及目录访问权限"
      };
      await fs.rm(outputPath, { force: true }).catch(() => {
        task.warnings.push("临时输出清理失败，稍后可删除此失败记录");
      });
    } finally {
      await fs.rm(staging, { force: true }).catch(() => {
        task.warnings.push("临时渲染文件清理失败，稍后可删除此记录");
      });
    }
    if ((task.cancelRequested || shutdownController.signal.aborted) && terminal.status === "completed") {
      task.results = [];
      fileMetadata?.removeForEntity("image-ai-result", task.id);
      await fs.rm(outputPath, { force: true }).catch(() => {
        task.warnings.push("取消后的输出清理失败，稍后可删除此记录");
      });
      terminal = { status: "canceled", phase: "已取消" };
    }
    // Publish terminal status only after all file operations finish. Persist synchronously
    // in the same turn so readers/deletion cannot observe a success with the old TTL.
    const previousExpiry = task.expiresAt;
    patchTask(task, terminal);
    try {
      await persist(task);
    } catch {
      // Do not claim success if the archive transaction could not be persisted.
      patchTask(task, { status: "running", phase: "回收未留档输出" });
      task.results = [];
      task.expiresAt = previousExpiry;
      await fs.rm(outputPath, { force: true }).catch(() => {
        task.warnings.push("未留档输出清理失败，稍后可删除此失败记录");
      });
      fileMetadata?.removeForEntity("image-ai-result", task.id);
      patchTask(task, { status: "failed", phase: "保存失败", error: "写入留档记录失败，请检查数据库及磁盘空间后重试" });
      await persist(task).catch(() => undefined);
    }
  }

  return processComposition;
}
