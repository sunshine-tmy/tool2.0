import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { Value } from "@sinclair/typebox/value";
import {
  defaultProductImageRecipe,
  ProductImageRecipeSchema,
  ProductImageSourceSchema,
  ImageAiResultParamsSchema,
  ImageAiTaskSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ImageAiResultParams,
  type ProductImageRecipe
} from "@toolbox/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppConfig } from "../../config";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { ownedImageFile, requireProductSpace, validateProductAsset } from "./product-image-files";
import { createImageAiTaskManager, type StoredImageAiTask } from "./task-manager";
import type { ProductImageAssets } from "./product-image-renderer";
import { validationError } from "./image-validation";

type Manager = ReturnType<typeof createImageAiTaskManager>;
type Asset = keyof ProductImageAssets;
const roles: Asset[] = ["foreground", "original", "background", "erase", "restore"];

function productFailure(reply: FastifyReply, error: unknown) {
  const reported = error as { code?: string; statusCode?: number; message?: string };
  const code = reported?.code ?? "PRODUCT_IMAGE_FAILED";
  const known = /^(INVALID_|MASK_|BACKGROUND_|RESTORE_|ASSET_|INSUFFICIENT_|FILE_TOO_LARGE|IMAGE_AI_TASK_BUSY)/.test(
    code
  );
  const message =
    code === "ENOSPC"
      ? "磁盘空间不足，请先释放空间"
      : code === "ENOENT"
        ? "来源素材已缺失，请重新抠图"
        : known
          ? reported.message!
          : "商品图素材读取或保存失败，请检查图片格式和本机存储状态";
  return reply
    .code(code === "IMAGE_AI_TASK_BUSY" ? 409 : reported.statusCode === 413 ? 413 : 400)
    .send(fail(known ? code : code === "ENOSPC" ? "INSUFFICIENT_DISK_SPACE" : "PRODUCT_IMAGE_FAILED", message));
}

async function sourceFiles(config: AppConfig, task: StoredImageAiTask, resultId: string) {
  const result = task.results.find((item) => item.id === resultId);
  if (!result || !["background_remove", "product_image"].includes(task.operation))
    throw validationError("INVALID_EDIT_SOURCE", "只能编辑已留档的抠图或商品图结果");
  let assets: ProductImageAssets;
  if (task.operation === "product_image" && task.assets) assets = { ...task.assets };
  else {
    const index = Number(resultId.slice(task.id.length + 1)) - 1;
    assets = { foreground: await ownedImageFile(config.imageAiOutputsDir, task.id, result.outputPath) };
    const input = task.inputs[index];
    if (input) {
      try {
        assets.original = await ownedImageFile(config.imageAiInputsDir, task.id, input.path);
      } catch {
        /* Missing originals must not disable background editing. */
      }
    }
  }
  for (const role of roles) {
    if (assets[role]) {
      try {
        assets[role] = await ownedImageFile(
          task.operation === "product_image"
            ? config.imageAiInputsDir
            : role === "foreground"
              ? config.imageAiOutputsDir
              : config.imageAiInputsDir,
          task.id,
          assets[role]!
        );
      } catch (error) {
        if (role === "original") delete assets.original;
        else throw error;
      }
    }
  }
  const info = await validateProductAsset(assets.foreground);
  let canRestore = false;
  if (assets.original) {
    try {
      const original = await validateProductAsset(assets.original);
      canRestore =
        (original.orientation ?? 1) === 1 && original.width === info.width && original.height === info.height;
    } catch {
      canRestore = false;
    }
    if (!canRestore) delete assets.original;
  }
  return { assets, width: info.width!, height: info.height!, canRestore };
}

export function registerProductImageRoutes(app: FastifyInstance, config: AppConfig, manager: Manager) {
  const prefix = "/api/v1/tools/image-ai/tasks/:taskId/files/:resultId";
  app.get<{ Params: ImageAiResultParams }>(
    `${prefix}/edit-source`,
    { schema: { params: ImageAiResultParamsSchema, response: { 200: apiSuccessSchema(ProductImageSourceSchema) } } },
    async (request, reply) => {
      let lease: ReturnType<Manager["leaseSource"]> | undefined;
      try {
        lease = manager.leaseSource(request.params.taskId);
        const source = await sourceFiles(config, lease.task, request.params.resultId);
        const url = `/api/v1/tools/image-ai/tasks/${lease.task.id}/files/${encodeURIComponent(request.params.resultId)}/edit-assets/`;
        return ok({
          taskId: lease.task.id,
          resultId: request.params.resultId,
          width: source.width,
          height: source.height,
          canRestore: source.canRestore,
          reason: source.canRestore ? undefined : "原图缺失或坐标不一致，仅支持擦除、换背景和标准化",
          foregroundUrl: `${url}foreground`,
          originalUrl: source.assets.original ? `${url}original` : undefined,
          backgroundUrl: source.assets.background ? `${url}background` : undefined,
          eraseUrl: source.assets.erase ? `${url}erase` : undefined,
          restoreUrl: source.assets.restore ? `${url}restore` : undefined,
          recipe: lease.task.recipe ?? defaultProductImageRecipe()
        });
      } catch (error) {
        return productFailure(reply, error);
      } finally {
        lease?.release();
      }
    }
  );

  app.get<{ Params: ImageAiResultParams & { asset: string } }>(
    `${prefix}/edit-assets/:asset`,
    { config: REQUEST_QUOTAS.mediaPreview },
    async (request, reply) => {
      const { taskId, resultId, asset } = request.params;
      let lease: ReturnType<Manager["leaseSource"]> | undefined;
      try {
        if (!roles.includes(asset as Asset) || !/^[A-Za-z0-9_-]{1,128}$/.test(resultId))
          throw validationError("INVALID_ASSET", "不支持的编辑素材");
        lease = manager.leaseSource(taskId);
        const source = await sourceFiles(config, lease.task, resultId);
        const file = source.assets[asset as Asset];
        if (!file) throw validationError("ASSET_NOT_FOUND", "该编辑素材不可用");
        const preview = await sharp(file, { limitInputPixels: 40000000 })
          .autoOrient()
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        return reply
          .header("Cache-Control", "no-store")
          .header("X-Content-Type-Options", "nosniff")
          .type("image/png")
          .send(preview);
      } catch (error) {
        return productFailure(reply, error);
      } finally {
        lease?.release();
      }
    }
  );

  app.post(
    "/api/v1/tools/image-ai/compositions",
    { config: REQUEST_QUOTAS.ai, schema: { response: { 202: apiSuccessSchema(ImageAiTaskSchema) } } },
    async (request, reply) => {
      const reservation = manager.tryReserveSlot();
      if (!reservation)
        throw Object.assign(new Error("图片任务队列已满或正在关闭"), { statusCode: 429, code: "IMAGE_AI_QUEUE_FULL" });
      const id = nanoid(12),
        directory = path.join(config.imageAiInputsDir, id);
      let lease: ReturnType<Manager["leaseSource"]> | undefined;
      let retained = false,
        created = false;
      try {
        await requireProductSpace(config.imageAiInputsDir, 16000000);
        await fs.mkdir(directory, { recursive: false });
        created = true;
        const fields: Record<string, string> = {},
          uploads: Partial<Record<Asset, string>> = {};
        let total = 0;
        for await (const part of request.parts({
          limits: { files: 3, fields: 4, parts: 7, fieldSize: 16384, fileSize: 20 * 1024 * 1024 }
        })) {
          if (part.type === "field") {
            if (
              !["taskId", "resultId", "recipe", "submissionKey"].includes(part.fieldname) ||
              fields[part.fieldname] !== undefined ||
              part.valueTruncated
            )
              throw validationError("INVALID_FIELD", "编辑参数重复或无效");
            fields[part.fieldname] = String(part.value);
          } else {
            const role = part.fieldname as Asset;
            if (!["background", "erase", "restore"].includes(role) || uploads[role])
              throw validationError("INVALID_ASSET", "编辑附件重复或无效");
            const file = path.join(directory, `upload-${role}.bin`),
              handle = await fs.open(file, "wx");
            let size = 0;
            try {
              for await (const chunk of part.file) {
                size += chunk.length;
                total += chunk.length;
                if (size > (role === "background" ? 20 : 10) * 1024 * 1024 || total > 40 * 1024 * 1024)
                  throw validationError("FILE_TOO_LARGE", "编辑附件超过大小限制");
                await handle.write(chunk);
              }
            } finally {
              await handle.close();
            }
            if (part.file.truncated) throw validationError("FILE_TOO_LARGE", "编辑附件超过大小限制");
            await validateProductAsset(file, role !== "background");
            uploads[role] = file;
          }
        }
        if (
          !/^[A-Za-z0-9_-]{12,64}$/.test(fields.submissionKey ?? "") ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(fields.resultId ?? "")
        )
          throw validationError("INVALID_SUBMISSION", "编辑提交标识无效");
        let recipe: ProductImageRecipe;
        try {
          recipe = JSON.parse(fields.recipe);
        } catch {
          throw validationError("INVALID_RECIPE", "商品图配方不是有效 JSON");
        }
        if (!Value.Check(ProductImageRecipeSchema, recipe) || recipe.canvas.width * recipe.canvas.height > 16000000)
          throw validationError("INVALID_RECIPE", "商品图配方、颜色或尺寸无效");
        const digest = createHash("sha256").update(JSON.stringify([fields.taskId, fields.resultId, recipe]));
        for (const role of ["background", "erase", "restore"] as const) {
          digest.update(role);
          if (uploads[role]) digest.update(await fs.readFile(uploads[role]!));
        }
        const submissionKey = `${fields.submissionKey}:${digest.digest("hex")}`;
        const previous = manager.findSubmission(submissionKey);
        if (previous) return reply.code(202).send(ok(manager.get(previous.id)!));
        lease = manager.leaseSource(fields.taskId);
        const source = await sourceFiles(config, lease.task, fields.resultId);
        if (uploads.restore && !source.canRestore)
          throw validationError("RESTORE_UNAVAILABLE", "原图缺失或坐标不一致，不能恢复区域");
        for (const role of ["erase", "restore"] as const) {
          if (uploads[role]) {
            const mask = await validateProductAsset(uploads[role]!, true);
            const expectedWidth = Math.max(
              1,
              Math.round(source.width * Math.min(1, 2048 / Math.max(source.width, source.height)))
            );
            const expectedHeight = Math.max(
              1,
              Math.round(source.height * Math.min(1, 2048 / Math.max(source.width, source.height)))
            );
            if (mask.width !== expectedWidth || mask.height !== expectedHeight)
              throw validationError("MASK_DIMENSIONS_MISMATCH", "精修蒙版尺寸与编辑代理不一致");
          }
        }
        const assets: ProductImageAssets = { foreground: "" };
        for (const role of roles) {
          const from = uploads[role] ?? source.assets[role];
          if (!from) continue;
          const to = path.join(directory, `${role}.png`);
          await sharp(from, { limitInputPixels: 40000000 }).autoOrient().toColourspace("srgb").png().toFile(to);
          assets[role] = to;
        }
        if (recipe.background.kind === "image" && !assets.background)
          throw validationError("BACKGROUND_REQUIRED", "请选择背景图片");
        for (const file of Object.values(uploads)) await fs.rm(file, { force: true });
        const inputPath = assets.original ?? assets.foreground;
        const size = (await fs.stat(inputPath)).size;
        const again = manager.findSubmission(submissionKey);
        if (again) return reply.code(202).send(ok(manager.get(again.id)!));
        const task = await manager.create({
          id,
          operation: "product_image",
          files: [
            {
              path: inputPath,
              originalName:
                lease.task.inputs[Number(fields.resultId.slice(lease.task.id.length + 1)) - 1]?.originalName ??
                lease.task.inputs[0]?.originalName ??
                "product.png",
              mimetype: "image/png",
              size,
              width: source.width,
              height: source.height
            }
          ],
          assets,
          recipe,
          source: { taskId: fields.taskId, resultId: fields.resultId },
          submissionKey
        });
        retained = true;
        return reply.code(202).send(ok(task));
      } catch (error) {
        return productFailure(reply, error);
      } finally {
        lease?.release();
        try {
          if (created && !retained) await fs.rm(directory, { recursive: true, force: true });
        } finally {
          reservation();
        }
      }
    }
  );
}
