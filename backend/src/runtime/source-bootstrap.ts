/** 串行安装全功能 CPU 基线；每个已完成的签名 generation 是独立续跑点，不信任额外成功标记。 */
import type { ComponentManager } from "../modules/components/component-manager";
import { installFailureAdvice } from "../modules/components/install-diagnostics";

export const sourceComponentIds = [
  "python-312",
  "ffmpeg",
  "edge-tts",
  "image-ai",
  "chatterbox",
  "xhs-browser",
  "xhs-archive",
  "xhs-translation",
  "douyin-archive"
] as const;

type Manager = Pick<
  ComponentManager,
  "list" | "startInstall" | "getJob" | "resolveInstalledAsset" | "resolveInstalledPython"
>;
const anchors: Record<string, string> = {
  "python-312": "python/python.exe",
  ffmpeg: "bin/ffmpeg.exe",
  "xhs-browser": "browser/chrome.exe",
  "douyin-archive": "adapter/manifest.json"
};
const phases: Record<string, string> = {
  queued: "等待安装",
  downloading: "下载能力包",
  verifying: "校验签名及文件",
  extracting: "解压能力包",
  "building-python": "创建隔离 Python 环境",
  "self-test": "执行安装自检",
  switching: "切换已验证版本",
  complete: "完成"
};

export async function prepareSourceComponents(
  manager: Manager,
  report: (message: string) => void,
  signal: AbortSignal = new AbortController().signal,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1000)),
  withCuda = false
) {
  const ids: readonly string[] = withCuda ? [...sourceComponentIds, "chatterbox-cuda"] : sourceComponentIds;
  const initial = await manager.list();
  if (initial.some((entry) => entry.activeJobId)) throw new Error("能力安装作业尚未完成，拒绝并发初始化");
  for (const id of ids) {
    if (!initial.some((entry) => entry.id === id)) throw new Error(`当前平台缺少签名能力：${id}`);
  }
  for (const [index, id] of ids.entries()) {
    signal.throwIfAborted();
    const status = initial.find((entry) => entry.id === id);
    if (!status) throw new Error(`当前平台缺少签名能力：${id}`);
    const prefix = `[${index + 1}/${ids.length}] ${status.displayName}`;
    if (status.installed && status.installedVersion === status.version && status.health === "healthy") {
      // Resolve through the manager: validate signature/current generation and a critical asset or venv.
      if (anchors[id]) await manager.resolveInstalledAsset(id, anchors[id]);
      else await manager.resolveInstalledPython(id);
      report(`${prefix}：已安装，复用（未重新全量校验模型）`);
      continue;
    }
    report(`${prefix}：准备安装；已完成 ${index} 项`);
    const startedAt = Date.now();
    const job = await manager.startInstall(id);
    while (true) {
      signal.throwIfAborted();
      const current = await manager.getJob(job.id);
      const p = current.progress;
      const label =
        current.state === "failed"
          ? "失败"
          : current.state === "cancelled"
            ? "已取消"
            : (phases[current.phase] ?? current.phase);
      report(
        `${prefix}：${label}；耗时 ${Math.floor((Date.now() - startedAt) / 1000)} 秒；下载 ${p.downloadedBytes}/${p.totalDownloadBytes} 字节；文件 ${p.processedFiles}/${p.totalFiles}`
      );
      if (current.state === "completed") break;
      if (current.state === "failed" || current.state === "cancelled") {
        // Avoid persisting/raw-printing unknown Worker output, URL credentials or user paths.
        throw new Error(
          `${status.displayName} 安装未完成（${current.errorCode ?? current.state}）；${installFailureAdvice(current.errorCode, current.errorMessage)}。停止后续步骤，已完成能力保留。`
        );
      }
      await wait();
    }
  }
}
