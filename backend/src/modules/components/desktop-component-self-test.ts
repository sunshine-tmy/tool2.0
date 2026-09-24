/** 中文模块说明：桌面能力包安装前的固定自检，禁止依赖 PATH、用户 Python 或联网下载。 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ComponentPackageManifest } from "./component-manager";

type ProcessRunner = (
  executable: string,
  args: string[],
  cwd: string,
  environment: Record<string, string>
) => Promise<string>;

const requiredFiles: Record<string, string[]> = {
  ffmpeg: ["bin/ffmpeg.exe", "bin/ffprobe.exe"],
  "python-311": ["python/python.exe"],
  "video-text": ["scripts/video-transcribe-faster-whisper.py"],
  "whisper-small": ["model/config.json", "model/model.bin", "model/tokenizer.json"],
  "edge-tts": ["scripts/edge-tts-generate.py"],
  "image-ai": [
    "scripts/image-ai-worker.py",
    "models/image-ai/torch/hub/checkpoints/big-lama.pt",
    "models/image-ai/RealESRGAN_x2plus.pth",
    "models/image-ai/RealESRGAN_x4plus.pth",
    "models/image-ai/rembg/models/birefnet-general/birefnet-general.onnx",
    "models/image-ai/ocr/detection/inference.yml",
    "models/image-ai/ocr/recognition/inference.yml"
  ],
  chatterbox: [
    "scripts/chatterbox-worker.py",
    "scripts/worker_lifecycle.py",
    "models/chatterbox/ve.pt",
    "models/chatterbox/t3_mtl23ls_v3.safetensors",
    "models/chatterbox/s3gen.pt",
    "models/chatterbox/grapheme_mtl_merged_expanded_v1.json"
  ]
};

export function createDesktopComponentSelfTest(runProcess: ProcessRunner = runProcessDefault) {
  return async (manifest: ComponentPackageManifest, generationRoot: string) => {
    const required = requiredFiles[manifest.id];
    if (!required) throw new Error(`桌面能力 ${manifest.id} 尚未注册安装自检`);
    await verifyRequiredFiles(manifest, generationRoot, required);

    if (manifest.id === "ffmpeg") {
      await runProcess(
        path.join(generationRoot, "bin", "ffmpeg.exe"),
        ["-version"],
        generationRoot,
        cleanEnvironment()
      );
      await runProcess(
        path.join(generationRoot, "bin", "ffprobe.exe"),
        ["-version"],
        generationRoot,
        cleanEnvironment()
      );
      return;
    }

    if (manifest.id === "python-311") {
      const output = await runProcess(
        path.join(generationRoot, "python", "python.exe"),
        ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
        generationRoot,
        cleanEnvironment()
      );
      if (output.trim() !== "3.11") throw new Error("Python 3.11 共享运行时自检失败");
      return;
    }

    if (manifest.id === "whisper-small") {
      JSON.parse(await fs.readFile(path.join(generationRoot, "model", "config.json"), "utf8"));
      return;
    }

    if (!manifest.pythonEnvironment) throw new Error(`能力 ${manifest.id} 缺少受管 Python 环境`);
    const pythonPath = path.join(generationRoot, "venv", "Scripts", "python.exe");
    const environment = cleanEnvironment();
    environment.PYTHONNOUSERSITE = "1";
    environment.PYTHONUNBUFFERED = "1";
    environment.HF_HUB_OFFLINE = "1";
    environment.TRANSFORMERS_OFFLINE = "1";

    if (manifest.id === "edge-tts") {
      const output = await runProcess(
        pythonPath,
        [path.join(generationRoot, "scripts", "edge-tts-generate.py"), "check"],
        generationRoot,
        environment
      );
      assertJsonAvailable(output, "Edge-TTS");
      return;
    }

    if (manifest.id === "video-text") {
      const output = await runProcess(
        pythonPath,
        [path.join(generationRoot, "scripts", "video-transcribe-faster-whisper.py"), "--check"],
        generationRoot,
        environment
      );
      assertJsonAvailable(output, "faster-whisper");
      return;
    }

    if (manifest.id === "image-ai") {
      const modelRoot = path.join(generationRoot, "models", "image-ai");
      environment.TOOLBOX_DESKTOP_MANAGED = "1";
      environment.IMAGE_AI_MODELS_ROOT = modelRoot;
      environment.TORCH_HOME = path.join(modelRoot, "torch");
      environment.U2NET_HOME = path.join(modelRoot, "rembg");
      environment.IMAGE_AI_OCR_DETECTION_MODEL_DIR = path.join(modelRoot, "ocr", "detection");
      environment.IMAGE_AI_OCR_RECOGNITION_MODEL_DIR = path.join(modelRoot, "ocr", "recognition");
      environment.IMAGE_AI_DEVICE = "cpu";
      const output = await runProcess(
        pythonPath,
        [path.join(generationRoot, "scripts", "image-ai-worker.py"), "--check"],
        generationRoot,
        environment
      );
      assertJsonAvailable(output, "AI 图片处理");
      return;
    }

    environment.TOOLBOX_DESKTOP_MANAGED = "1";
    environment.CHATTERBOX_MODELS_ROOT = path.join(generationRoot, "models", "chatterbox");
    environment.CHATTERBOX_DEVICE = "cpu";
    const output = await runProcess(
      pythonPath,
      [path.join(generationRoot, "scripts", "chatterbox-worker.py"), "--check"],
      generationRoot,
      environment
    );
    assertJsonAvailable(output, "参考音色克隆");
  };
}

async function verifyRequiredFiles(manifest: ComponentPackageManifest, generationRoot: string, required: string[]) {
  const listed = new Set(manifest.files.map((file) => file.path));
  for (const relativePath of required) {
    if (!listed.has(relativePath)) throw new Error(`能力 ${manifest.id} 的签名清单缺少必需文件：${relativePath}`);
    const candidate = path.resolve(generationRoot, ...relativePath.split("/"));
    const relative = path.relative(generationRoot, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("能力包自检路径越界");
    const stat = await fs.stat(candidate);
    if (!stat.isFile() || stat.size === 0)
      throw new Error(`能力 ${manifest.id} 的必需文件为空或不存在：${relativePath}`);
  }
}

function assertJsonAvailable(output: string, label: string) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  let result: unknown;
  try {
    result = JSON.parse(lines.at(-1) ?? "");
  } catch {
    throw new Error(`${label}安装自检没有返回有效结果`);
  }
  if (!result || typeof result !== "object" || (result as { available?: unknown }).available !== true) {
    throw new Error(`${label}安装自检未通过`);
  }
}

function cleanEnvironment() {
  const environment = { ...process.env } as Record<string, string>;
  for (const key of ["PYTHONPATH", "PYTHONHOME", "HF_TOKEN", "HF_ENDPOINT", "PIP_INDEX_URL", "PIP_EXTRA_INDEX_URL"]) {
    delete environment[key];
  }
  return environment;
}

function runProcessDefault(executable: string, args: string[], cwd: string, environment: Record<string, string>) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(
      () => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error("桌面能力安装自检超时"));
      },
      5 * 60 * 1000
    );
    timeout.unref();
    const collect = (chunk: Buffer) => {
      if (output.length < 32_000) output += chunk.toString("utf8").slice(0, 32_000 - output.length);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) resolve(output);
      else reject(new Error(`桌面能力安装自检失败（exit ${code}）：${output.trim().slice(-800)}`));
    });
  });
}
