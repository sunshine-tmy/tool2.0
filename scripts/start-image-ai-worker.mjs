/** Source-only launcher for the local Image AI worker; never installs packages or downloads models. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

export function startImageAiWorker({
  args = process.argv.slice(2),
  environment = process.env,
  launch = spawn,
  owner = process
} = {}) {
  const python = path.join(
    root,
    ".venv-image-ai",
    ...(process.platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"])
  );
  const child = launch(python, [path.join(root, "scripts/image-ai-worker.py"), ...args], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...environment,
      TOOLBOX_DESKTOP_MANAGED: "1",
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: "True",
      PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT: "False"
    }
  });
  const stop = () => child.kill();
  owner.once("SIGINT", stop);
  owner.once("SIGTERM", stop);
  child.once("error", () => {
    owner.exitCode = 1;
    console.error("图片 AI Worker 无法启动；请先准备 .venv-image-ai 和本地模型，不会自动安装或下载。");
  });
  child.once("close", (code) => {
    owner.removeListener("SIGINT", stop);
    owner.removeListener("SIGTERM", stop);
    owner.exitCode = code === 0 ? 0 : 1;
  });
  return child;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startImageAiWorker();
