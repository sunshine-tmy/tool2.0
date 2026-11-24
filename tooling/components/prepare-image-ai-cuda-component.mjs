/** Prepare a complete, isolated image CUDA environment; model weights remain in the base capability. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import crypto from "node:crypto";
import { prepareImageAiComponent } from "./prepare-image-ai-component.mjs";
import { splitFileIntoParts } from "./prepare-chatterbox-cuda-component.mjs";
import { groupVideoAiCudaWheelhouseAssets } from "./prepare-video-ai-cuda-component.mjs";
import { stripPnpmSeparator } from "./cli-arguments.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
export function validateImageAiCudaLock(text) {
  for (const pin of [
    "torch==2.6.0+cu124",
    "torchvision==0.21.0+cu124",
    "onnxruntime-gpu==1.20.2",
    "kornia==0.8.2",
    "timm==1.0.15"
  ]) {
    if (!text.split(/\r?\n/).some((line) => line.startsWith(pin + " ") || line === pin))
      throw new Error(`图片 GPU 锁文件缺少固定依赖：${pin}`);
  }
  if (/^onnxruntime==|^nvidia[-_\w]*==/m.test(text))
    throw new Error("Windows 图片 GPU 环境不能混入 CPU ONNX 或 Linux NVIDIA 依赖");
}

export async function prepareImageAiCudaComponent(options) {
  if (process.platform !== "win32" || process.arch !== "x64")
    throw new Error("图片 CUDA 包仅支持 Windows x64 原生制包");
  const lockFilePath = options.lockFilePath ?? path.join(root, "scripts/image-ai-cuda.lock.txt");
  validateImageAiCudaLock(await fs.readFile(lockFilePath, "utf8"));
  const result = await prepareImageAiComponent({ ...options, lockFilePath, runtime: "cuda", assets: [] });
  const stage = result.stagingDirectory;
  const definition = JSON.parse(
    await fs.readFile(path.join(root, "scripts/component-definitions/image-ai-cuda.json"), "utf8")
  );
  const entries = [];
  const assembledFiles = [];
  for (const filename of await fs.readdir(path.join(stage, "wheelhouse"))) {
    if (!filename.endsWith(".whl")) continue;
    const source = path.join(stage, "wheelhouse", filename);
    const bytes = (await fs.stat(source)).size;
    if (filename.startsWith("torch-") && bytes > 1_500_000_000) {
      const digest = crypto.createHash("sha256");
      for await (const chunk of createReadStream(source)) digest.update(chunk);
      const parts = await splitFileIntoParts(source, path.join(stage, "wheelhouse/.parts"));
      const relative = parts.map((part) => path.relative(stage, part.path).split(path.sep).join("/"));
      assembledFiles.push({ path: `wheelhouse/${filename}`, bytes, sha256: digest.digest("hex"), parts: relative });
      parts.forEach((part, i) => entries.push({ name: part.filename, path: relative[i] }));
      await fs.unlink(source);
    } else entries.push({ name: filename, path: `wheelhouse/${filename}` });
  }
  definition.additionalArchives = groupVideoAiCudaWheelhouseAssets(entries);
  definition.assembledFiles = assembledFiles;
  const generatedDefinitionPath =
    options.generatedDefinitionPath ?? path.join(path.dirname(stage), "image-ai-cuda-definition.generated.json");
  await fs.writeFile(generatedDefinitionPath, JSON.stringify(definition, null, 2) + "\n", { flag: "wx" });
  return { ...result, generatedDefinitionPath };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(root, "scripts/prepare-image-ai-cuda-component.mjs")
) {
  try {
    const args = stripPnpmSeparator(process.argv.slice(2));
    const values = new Map();
    for (let i = 0; i < args.length; i += 2) {
      if (!args[i]?.startsWith("--") || !args[i + 1] || values.has(args[i])) throw new Error("命令行参数无效");
      values.set(args[i], args[i + 1]);
    }
    if (
      !values.has("--python") ||
      !values.has("--stage") ||
      [...values.keys()].some((key) => !["--python", "--stage", "--definition-output", "--find-links"].includes(key))
    )
      throw new Error(
        "用法：pnpm components:prepare-image-ai-cuda -- --python <Python 3.12> --stage <新目录> [--find-links <离线 wheelhouse>] [--definition-output <新 JSON>]"
      );
    console.log(
      await prepareImageAiCudaComponent({
        pythonExecutablePath: values.get("--python"),
        stagingDirectory: values.get("--stage"),
        generatedDefinitionPath: values.get("--definition-output"),
        findLinks: values.has("--find-links") ? [values.get("--find-links")] : []
      })
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "图片 GPU 制包失败");
    process.exitCode = 1;
  }
}
