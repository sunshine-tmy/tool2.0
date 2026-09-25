/** 中文模块说明：启动固定本地翻译 Worker 并通过回环 HTTP 完成一条实际中英翻译样本。 */
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function testXhsTranslationSmoke({ pythonExecutablePath, workerPath, modelDirectory }) {
  const python = path.resolve(pythonExecutablePath);
  const worker = path.resolve(workerPath);
  const model = path.resolve(modelDirectory);
  const port = await availableLoopbackPort();
  const token = crypto.randomBytes(32).toString("hex");
  const child = spawn(python, ["-B", worker], {
    cwd: path.dirname(worker),
    env: {
      ...cleanEnvironment(),
      XHS_TRANSLATION_MODEL_DIR: model,
      XHS_TRANSLATION_PORT: String(port),
      XHS_TRANSLATION_TOKEN: token
    },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true
  });
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr = (stderr + String(chunk)).slice(-4000);
  });
  try {
    const endpoint = "http://127.0.0.1:" + port;
    await waitForHealth(child, endpoint, token, 30_000, () => stderr);
    const response = await fetch(endpoint + "/translate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-toolbox-worker-token": token },
      body: JSON.stringify({ texts: ["你好，这是小红书离线翻译能力测试。"] }),
      signal: AbortSignal.timeout(120_000)
    });
    if (!response.ok) throw new Error("翻译 Worker 返回 HTTP " + response.status + "：" + (await response.text()));
    const result = await response.json();
    const translation = Array.isArray(result.translations) ? result.translations[0] : undefined;
    if (typeof translation !== "string" || !translation.trim()) throw new Error("翻译样本没有返回有效英文文本");
    return { modelDirectory: model, sourceText: "你好，这是小红书离线翻译能力测试。", translation };
  } finally {
    await stopChild(child);
  }
}

async function waitForHealth(child, endpoint, token, timeoutMs, stderr) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("翻译 Worker 在启动阶段退出（" + child.exitCode + "）：" + stderr());
    }
    try {
      const response = await fetch(endpoint + "/health", {
        headers: { "x-toolbox-worker-token": token },
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) return;
    } catch {
      // Wait for the loopback service to bind before submitting the smoke sample.
    }
    await delay(250);
  }
  throw new Error("翻译 Worker 启动超时：" + stderr());
}

async function availableLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("无法分配翻译 Worker 回环端口");
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined))));
  return address.port;
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, delay(5000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exited, delay(2000)]);
  }
}

function cleanEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE", "HF_TOKEN", "HF_ENDPOINT"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  return environment;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  if (values.size !== 3 || !values.has("python") || !values.has("worker") || !values.has("model")) {
    throw new Error(
      "用法：pnpm components:test-xhs-translation-smoke -- --python <Python 环境> --worker <翻译 Worker> --model <固定模型目录>"
    );
  }
  return {
    pythonExecutablePath: values.get("python"),
    workerPath: values.get("worker"),
    modelDirectory: values.get("model")
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await testXhsTranslationSmoke(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "小红书翻译 smoke test 失败");
    process.exitCode = 1;
  }
}
