/**
 * 中文模块说明：桌面能力运行时只从 ComponentManager 验签后的 generation 解析程序、脚本和模型，
 * 并在退出时停止它启动的 loopback Worker。
 */
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { ComponentJobOperation } from "@toolbox/shared";
import type { AppConfig } from "../config";
import { ComponentManager, ComponentManagerError } from "../modules/components/component-manager";
import { workerAuthHeaders } from "../security/worker-auth";

type ManagedWorker = { componentId: string; url: string; token: string; stop: () => Promise<void> };

/**
 * Configure all optional desktop runtimes from fixed component ids and asset paths.
 * Missing/unapproved packages leave the feature unavailable; desktop never falls back
 * to a developer venv, PATH command, configured URL, or an automatic package download.
 */
export async function configureDesktopCapabilityRuntime(config: AppConfig, components: ComponentManager) {
  const workers: ManagedWorker[] = [];
  if (!config.desktopManagedCapabilities) {
    return {
      beforeUninstall: async (_componentId: string) => undefined,
      afterMutation: async (_componentId: string) => undefined,
      close: async () => undefined
    };
  }

  const resetVideoConfiguration = () => {
    config.videoTextCapabilityReady = false;
    config.videoTextAudioExtractCommand = "";
    config.videoTextTranscribeCommand = undefined;
  };
  const resetEdgeTtsConfiguration = () => {
    config.edgeTtsCapabilityReady = false;
    config.edgeTtsPythonPath = "";
    config.edgeTtsScriptPath = "";
  };
  const resetImageConfiguration = () => {
    config.imageAiCapabilityReady = false;
    config.imageAiWorkerUrl = "http://127.0.0.1:1";
    config.imageAiWorkerToken = undefined;
  };
  const resetChatterboxConfiguration = () => {
    config.chatterboxCapabilityReady = false;
    config.chatterboxWorkerUrl = "http://127.0.0.1:1";
    config.chatterboxWorkerToken = undefined;
    config.chatterboxFfmpegPath = "";
    config.chatterboxFfprobePath = "";
  };
  const resetConfiguration = () => {
    resetVideoConfiguration();
    resetEdgeTtsConfiguration();
    resetImageConfiguration();
    resetChatterboxConfiguration();
  };
  resetConfiguration();

  const controllers = new Map<string, AbortController>();
  const startup = new AbortController();
  controllers.set("startup", startup);
  let initializing: Promise<void> = Promise.resolve();
  let closed = false;
  let refreshQueue: Promise<void> = Promise.resolve();
  const resolveMediaTools = async () =>
    Promise.all([
      optionalAsset(components, "ffmpeg", "bin/ffmpeg.exe"),
      optionalAsset(components, "ffmpeg", "bin/ffprobe.exe")
    ]);

  const configureVideo = async (signal: AbortSignal, ffmpeg?: Awaited<ReturnType<typeof optionalAsset>>) => {
    resetVideoConfiguration();
    await tryConfigure(
      "视频文本解析",
      async () => {
        const [python, script, model] = await Promise.all([
          optionalPython(components, "video-text"),
          optionalAsset(components, "video-text", "scripts/video-transcribe-faster-whisper.py"),
          optionalAsset(components, "whisper-small", "model/config.json")
        ]);
        if (signal.aborted || !python || !script || !model || !ffmpeg) return;
        config.videoTextAudioExtractCommand = [
          quote(ffmpeg.path),
          "-nostdin -y -i {input} -vn -acodec pcm_s16le -ar 16000 -ac 1 {output}"
        ].join(" ");
        config.videoTextTranscribeCommand = [
          quote(python.path),
          quote(script.path),
          "--input {input} --output {output} --metadata-output {output}.meta.json",
          "--model",
          quote(path.dirname(model.path)),
          "--device cpu --compute-type int8"
        ].join(" ");
        config.videoTextCapabilityReady = true;
      },
      signal
    );
  };

  const configureEdgeTts = async (signal: AbortSignal) => {
    resetEdgeTtsConfiguration();
    await tryConfigure(
      "Edge-TTS",
      async () => {
        const [python, script] = await Promise.all([
          optionalPython(components, "edge-tts"),
          optionalAsset(components, "edge-tts", "scripts/edge-tts-generate.py")
        ]);
        if (signal.aborted || !python || !script) return;
        config.edgeTtsPythonPath = python.path;
        config.edgeTtsScriptPath = script.path;
        config.edgeTtsCapabilityReady = true;
      },
      signal
    );
  };

  const configureImageAi = async (signal: AbortSignal) => {
    resetImageConfiguration();
    await tryConfigure(
      "AI 图片处理",
      async () => {
        const [python, script, lama, realesrgan2, realesrgan4, birefnet, ocrDetection, ocrRecognition] =
          await Promise.all([
            optionalPython(components, "image-ai"),
            optionalAsset(components, "image-ai", "scripts/image-ai-worker.py"),
            optionalAsset(components, "image-ai", "models/image-ai/torch/hub/checkpoints/big-lama.pt"),
            optionalAsset(components, "image-ai", "models/image-ai/RealESRGAN_x2plus.pth"),
            optionalAsset(components, "image-ai", "models/image-ai/RealESRGAN_x4plus.pth"),
            optionalAsset(
              components,
              "image-ai",
              "models/image-ai/rembg/models/birefnet-general/birefnet-general.onnx"
            ),
            optionalAsset(components, "image-ai", "models/image-ai/ocr/detection/inference.yml"),
            optionalAsset(components, "image-ai", "models/image-ai/ocr/recognition/inference.yml")
          ]);
        if (
          signal.aborted ||
          !python ||
          !script ||
          !lama ||
          !realesrgan2 ||
          !realesrgan4 ||
          !birefnet ||
          !ocrDetection ||
          !ocrRecognition
        )
          return;
        const generationRoot = script.generationRoot;
        const modelRoot = path.join(generationRoot, "models", "image-ai");
        const worker = await startWorker({
          pythonPath: python.path,
          scriptPath: script.path,
          componentId: "image-ai",
          generationRoot,
          healthUrlPath: "/health",
          tempDirectory: config.tempDir,
          signal,
          environment: {
            TOOLBOX_DESKTOP_MANAGED: "1",
            IMAGE_AI_WORKER_HOST: "127.0.0.1",
            IMAGE_AI_STORAGE_ROOT: config.imageAiDir,
            IMAGE_AI_MODELS_ROOT: modelRoot,
            PADDLE_PDX_CACHE_HOME: path.join(config.imageAiDir, "cache", "paddlex"),
            PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: "True",
            PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT: "False",
            IMAGE_AI_BRIA_MODEL_DIR: path.join(config.runtime.modelsRoot, "image-ai", "BRIA-RMBG-2.0"),
            TORCH_HOME: path.join(modelRoot, "torch"),
            U2NET_HOME: path.join(modelRoot, "rembg"),
            IMAGE_AI_OCR_DETECTION_MODEL_DIR: path.dirname(ocrDetection.path),
            IMAGE_AI_OCR_RECOGNITION_MODEL_DIR: path.dirname(ocrRecognition.path),
            IMAGE_AI_DEVICE: "cpu",
            DEPLOYMENT_USAGE: config.deploymentUsage,
            HF_HUB_OFFLINE: "1",
            TRANSFORMERS_OFFLINE: "1"
          },
          available: (payload) => payload.available === true
        });
        workers.push(worker);
        if (signal.aborted) return;
        config.imageAiWorkerUrl = worker.url;
        config.imageAiWorkerToken = worker.token;
        config.imageAiCapabilityReady = true;
      },
      signal
    );
  };

  const configureChatterbox = async (
    signal: AbortSignal,
    ffmpeg?: Awaited<ReturnType<typeof optionalAsset>>,
    ffprobe?: Awaited<ReturnType<typeof optionalAsset>>
  ) => {
    resetChatterboxConfiguration();
    await tryConfigure(
      "参考音色克隆",
      async () => {
        const [python, script, lifecycle, ve, t3, s3gen, tokenizer] = await Promise.all([
          optionalPython(components, "chatterbox"),
          optionalAsset(components, "chatterbox", "scripts/chatterbox-worker.py"),
          optionalAsset(components, "chatterbox", "scripts/worker_lifecycle.py"),
          optionalAsset(components, "chatterbox", "models/chatterbox/ve.pt"),
          optionalAsset(components, "chatterbox", "models/chatterbox/t3_mtl23ls_v3.safetensors"),
          optionalAsset(components, "chatterbox", "models/chatterbox/s3gen.pt"),
          optionalAsset(components, "chatterbox", "models/chatterbox/grapheme_mtl_merged_expanded_v1.json")
        ]);
        if (
          signal.aborted ||
          !python ||
          !script ||
          !lifecycle ||
          !ffmpeg ||
          !ffprobe ||
          !ve ||
          !t3 ||
          !s3gen ||
          !tokenizer
        )
          return;
        const generationRoot = script.generationRoot;
        const worker = await startWorker({
          pythonPath: python.path,
          scriptPath: script.path,
          componentId: "chatterbox",
          generationRoot,
          healthUrlPath: "/health",
          tempDirectory: config.tempDir,
          signal,
          environment: {
            TOOLBOX_DESKTOP_MANAGED: "1",
            CHATTERBOX_WORKER_HOST: "127.0.0.1",
            CHATTERBOX_STORAGE_ROOT: config.chatterboxDir,
            CHATTERBOX_MODELS_ROOT: path.join(generationRoot, "models", "chatterbox"),
            CHATTERBOX_DEVICE: "cpu",
            CHATTERBOX_MODEL_IDLE_MINUTES: "10",
            HF_HOME: path.join(config.runtime.modelsRoot, "chatterbox", "huggingface"),
            HF_HUB_OFFLINE: "1",
            TRANSFORMERS_OFFLINE: "1"
          },
          available: (payload) => payload.available === true
        });
        workers.push(worker);
        if (signal.aborted) return;
        config.chatterboxWorkerUrl = worker.url;
        config.chatterboxWorkerToken = worker.token;
        config.chatterboxFfmpegPath = ffmpeg.path;
        config.chatterboxFfprobePath = ffprobe.path;
        config.chatterboxCapabilityReady = true;
      },
      signal
    );
  };

  const configureAll = async (signal: AbortSignal) => {
    await fsp.mkdir(config.tempDir, { recursive: true });
    const [ffmpeg, ffprobe] = await resolveMediaTools();
    await configureVideo(signal, ffmpeg);
    await configureEdgeTts(signal);
    await configureImageAi(signal);
    await configureChatterbox(signal, ffmpeg, ffprobe);
  };
  initializing = configureAll(startup.signal);
  void initializing.catch((error) => {
    if (!startup.signal.aborted) {
      console.warn(`桌面能力运行时初始化失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  });

  const stopManagedWorker = async (componentId: string) => {
    const workerIndex = workers.findIndex((worker) => worker.componentId === componentId);
    if (workerIndex < 0) return;
    const [worker] = workers.splice(workerIndex, 1);
    await worker.stop();
  };

  return {
    beforeUninstall: async (componentId: string) => {
      await initializing.catch(() => undefined);
      await stopManagedWorker(componentId);
      if (componentId === "image-ai") {
        config.imageAiCapabilityReady = false;
        config.imageAiWorkerUrl = "http://127.0.0.1:1";
        config.imageAiWorkerToken = undefined;
      }
      if (componentId === "chatterbox") {
        config.chatterboxCapabilityReady = false;
        config.chatterboxWorkerUrl = "http://127.0.0.1:1";
        config.chatterboxWorkerToken = undefined;
      }
    },
    afterMutation: async (componentId: string, operation: ComponentJobOperation) => {
      const refresh = refreshQueue.then(async () => {
        if (closed) return;
        await initializing.catch(() => undefined);
        if (closed) return;

        const controller = new AbortController();
        controllers.set(componentId, controller);
        if (["ffmpeg", "video-text", "whisper-small"].includes(componentId)) {
          await configureVideo(controller.signal, (await resolveMediaTools())[0]);
          if (
            operation !== "uninstall" &&
            (await areInstalled(components, ["ffmpeg", "video-text", "whisper-small"])) &&
            !config.videoTextCapabilityReady
          ) {
            throw new Error("视频文本解析依赖已安装，但运行时自检未就绪");
          }
          if (componentId === "ffmpeg" && config.chatterboxCapabilityReady) {
            const [ffmpeg, ffprobe] = await resolveMediaTools();
            if (ffmpeg && ffprobe) {
              config.chatterboxFfmpegPath = ffmpeg.path;
              config.chatterboxFfprobePath = ffprobe.path;
            }
          }
        } else if (componentId === "edge-tts") {
          await configureEdgeTts(controller.signal);
          if (
            operation !== "uninstall" &&
            (await isInstalled(components, componentId)) &&
            !config.edgeTtsCapabilityReady
          ) {
            throw new Error("Edge-TTS 依赖已安装，但运行时自检未就绪");
          }
        } else if (componentId === "image-ai") {
          await stopManagedWorker(componentId);
          await configureImageAi(controller.signal);
          if (
            operation !== "uninstall" &&
            (await isInstalled(components, componentId)) &&
            !config.imageAiCapabilityReady
          ) {
            throw new Error("AI 图片处理依赖已安装，但 Worker 健康检查未通过");
          }
        } else if (componentId === "chatterbox") {
          await stopManagedWorker(componentId);
          const [ffmpeg, ffprobe] = await resolveMediaTools();
          await configureChatterbox(controller.signal, ffmpeg, ffprobe);
          if (
            operation !== "uninstall" &&
            (await isInstalled(components, componentId)) &&
            !config.chatterboxCapabilityReady
          ) {
            throw new Error("参考音色克隆依赖已安装，但 Worker 健康检查未通过");
          }
        }
      });
      refreshQueue = refresh.catch(() => undefined);
      await refresh;
    },
    close: async () => {
      closed = true;
      for (const controller of controllers.values()) controller.abort();
      await initializing.catch(() => undefined);
      await Promise.allSettled(workers.splice(0).map((worker) => worker.stop()));
    }
  };
}

async function isInstalled(components: ComponentManager, componentId: string) {
  return (await components.list()).some((component) => component.id === componentId && component.installed);
}

async function areInstalled(components: ComponentManager, componentIds: string[]) {
  const statuses = await components.list();
  return componentIds.every((componentId) =>
    statuses.some((component) => component.id === componentId && component.installed)
  );
}

async function optionalAsset(components: ComponentManager, componentId: string, assetPath: string) {
  try {
    return await components.resolveInstalledAsset(componentId, assetPath);
  } catch (error) {
    if (isUnavailableComponent(error)) return undefined;
    throw error;
  }
}

async function optionalPython(components: ComponentManager, componentId: string) {
  try {
    return await components.resolveInstalledPython(componentId);
  } catch (error) {
    if (isUnavailableComponent(error)) return undefined;
    throw error;
  }
}

async function tryConfigure(label: string, configure: () => Promise<void>, signal: AbortSignal) {
  if (signal.aborted) return;
  try {
    await configure();
  } catch (error) {
    if (!signal.aborted) {
      console.warn(`${label} 桌面运行时不可用：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }
}

function isUnavailableComponent(error: unknown) {
  return (
    error instanceof ComponentManagerError &&
    (error.code === "COMPONENT_NOT_FOUND" || error.code === "COMPONENT_NOT_INSTALLED")
  );
}

function quote(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

async function startWorker(options: {
  pythonPath: string;
  scriptPath: string;
  componentId: string;
  generationRoot: string;
  healthUrlPath: string;
  tempDirectory: string;
  signal: AbortSignal;
  environment: Record<string, string>;
  available: (payload: Record<string, unknown>) => boolean;
}): Promise<ManagedWorker> {
  const port = await reserveLoopbackPort();
  const token = crypto.randomBytes(32).toString("base64url");
  const url = `http://127.0.0.1:${port}`;
  const environment = { ...process.env };
  for (const key of ["PYTHONPATH", "PYTHONHOME", "HF_TOKEN"]) delete environment[key];
  Object.assign(environment, options.environment, {
    IMAGE_AI_WORKER_PORT: String(port),
    CHATTERBOX_WORKER_PORT: String(port),
    IMAGE_AI_WORKER_TOKEN: token,
    CHATTERBOX_WORKER_TOKEN: token,
    PYTHONNOUSERSITE: "1",
    PYTHONUNBUFFERED: "1",
    TEMP: options.tempDirectory,
    TMP: options.tempDirectory
  });
  const child = spawn(options.pythonPath, [options.scriptPath, "--host", "127.0.0.1", "--port", String(port)], {
    cwd: options.generationRoot,
    env: environment,
    stdio: "ignore",
    windowsHide: true
  });
  const exit = new Promise<{ code: number | null; error?: Error }>((resolve) => {
    child.once("error", (error) => resolve({ code: null, error }));
    child.once("close", (code) => resolve({ code }));
  });
  try {
    await waitForWorker(`${url}${options.healthUrlPath}`, token, exit, options.available, options.signal);
  } catch (error) {
    await stopChild(child, exit);
    throw error;
  }
  return { componentId: options.componentId, url, token, stop: () => stopChild(child, exit) };
}

async function waitForWorker(
  healthUrl: string,
  token: string,
  exit: Promise<{ code: number | null; error?: Error }>,
  available: (payload: Record<string, unknown>) => boolean,
  signal: AbortSignal
) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("Worker 启动已取消");
    const exited = await Promise.race([exit, delay(100).then(() => undefined)]);
    if (exited) throw exited.error ?? new Error(`Worker 在健康检查前退出（${String(exited.code)}）`);
    try {
      const response = await fetch(healthUrl, {
        headers: workerAuthHeaders(token),
        signal: AbortSignal.timeout(1500)
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        if (isRecord(payload) && payload.success === true && isRecord(payload.data) && available(payload.data)) return;
      }
    } catch {
      // Startup imports can take several seconds; retry until the bounded deadline.
    }
    await delay(400);
  }
  throw new Error("Worker 启动健康检查超时或依赖/模型不完整");
}

async function stopChild(child: ChildProcess, exit: Promise<{ code: number | null; error?: Error }>) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const stopped = await Promise.race([exit.then(() => true), delay(5000).then(() => false)]);
  if (!stopped) child.kill("SIGKILL");
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string" || address.port < 1) throw new Error("无法分配 Worker 本地端口");
    return address.port;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
