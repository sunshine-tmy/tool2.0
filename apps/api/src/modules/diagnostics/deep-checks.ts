import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { DiagnosticCheck } from "@toolbox/shared";
import { createDesktopComponentSelfTest } from "../components/desktop-component-self-test";
import type { DiagnosticsService } from "./service";
import { diagnosticError } from "./errors";

/** 输出只在进程结束后用于判别固定错误码，不写日志、不返回原始内容。 */
export function diagnosticProcess(
  executable: string,
  args: string[],
  signal: AbortSignal,
  cwd?: string,
  env?: NodeJS.ProcessEnv
) {
  signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "",
      timedOut = false,
      processError: Error | undefined;
    const stop = () => {
      child.kill();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, 300_000);
    signal.addEventListener("abort", stop, { once: true });
    const collect = (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(-32_000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      processError = error;
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      if (signal.aborted) return reject(signal.reason);
      if (processError) return reject(processError);
      if (timedOut) return reject(Object.assign(new Error("检查超时"), { code: "ETIMEDOUT" }));
      if (code !== 0)
        return reject(
          diagnosticError(
            /(?:\b403\b|Invalid response status.*403)/i.test(output) ? "ONLINE_FORBIDDEN" : "SELF_TEST_FAILED",
            "检查子进程未成功完成",
            422
          )
        );
      resolve(output);
    });
  });
}
export async function executeDeepCheck(
  service: DiagnosticsService,
  target: string,
  signal: AbortSignal
): Promise<DiagnosticCheck> {
  const config = service.config;
  let title = target;
  if (target.startsWith("integrity-")) {
    const id = target.slice(10);
    title = `能力包完整性 · ${id}`;
    const tester = createDesktopComponentSelfTest((executable, args, cwd, environment) =>
      diagnosticProcess(executable, args, signal, cwd, environment)
    );
    await service.components.verifyCurrent(id, signal, tester);
  } else if (target === "image-ai" || target === "chatterbox") {
    title = target === "image-ai" ? "AI 图片模型加载" : "参考音色克隆模型加载";
    // 模型加载不可安全中断；取消时保留维护锁直至本次调用结束，不误杀用户 Worker。
    const result = await service.worker(target, true);
    if (!result.available)
      throw Object.assign(new Error("模型自检未通过"), {
        code: result.code === "CUDA_OUT_OF_MEMORY" ? result.code : "MODEL_SELF_TEST_FAILED"
      });
  } else {
    const root = await fsp.mkdtemp(path.join(config.tempDir, "diagnostic-"));
    try {
      if (target === "edge-tts") {
        title = "在线自然音色真实合成";
        const input = path.join(root, "request.json"),
          audio = path.join(root, "sample.mp3");
        await fsp.writeFile(
          input,
          JSON.stringify({
            protocolVersion: 1,
            text: "Hello. This is a voice test.",
            language: "en-US",
            voice: "en-US-AriaNeural",
            rate: 0,
            volume: 0,
            pitch: 0
          })
        );
        await diagnosticProcess(
          config.edgeTtsPythonPath,
          [config.edgeTtsScriptPath, "generate", "--input", input, "--audio", audio],
          signal
        );
        if ((await fsp.stat(audio)).size < 16) throw diagnosticError("EMPTY_TEST_AUDIO", "测试音频为空", 422);
      }
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  }
  signal.throwIfAborted();
  return {
    id: target,
    title,
    category: target === "edge-tts" ? "external" : "capability",
    status: "ok",
    code: "DEEP_CHECK_PASSED",
    message: "本次实际检查已通过",
    impact: "仅反映本次检查结果",
    suggestion: "无需处理",
    modules: [target === "chatterbox" ? "edge-tts" : target]
  };
}
