/** doctor 与后端复用配置解析和错误分类；从不打开数据库、创建目录或下载模型。 */
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { getConfig } from "./config";
import { diagnosticFailure } from "@toolbox/shared";

type Check = { id: string; status: string; code: string; message: string };
const checks: Check[] = [];
try {
  const config = getConfig();
  const requireFrontend = createRequire(path.join(config.runtime.appRoot, "frontend/package.json"));
  const vite = (await import(pathToFileURL(requireFrontend.resolve("vite")).href)) as {
    loadEnv: (mode: string, dir: string, prefix: string) => Record<string, string>;
  };
  const env = vite.loadEnv("development", config.runtime.configRoot, "VITE_");
  const apiTarget = new URL(env.VITE_API_PROXY_TARGET?.trim() || `http://127.0.0.1:${config.port}`);
  if (process.argv.includes("--targets")) {
    process.stdout.write(
      JSON.stringify({
        backendPort: config.port,
        frontendPort: Number(env.VITE_DEV_PORT || 5173),
        backendHealth: new URL("/api/v1/health", apiTarget).href,
        backendReady: new URL("/health/ready", apiTarget).href,
        frontend: `http://127.0.0.1:${Number(env.VITE_DEV_PORT || 5173)}`
      })
    );
    process.exit(0);
  }
  checks.push({
    id: "node",
    status: Number(process.versions.node.split(".")[0]) === 24 ? "ok" : "failed",
    code: "NODE_VERSION",
    message: `Node ${process.versions.node}；要求 24.x`
  });
  let pnpmVersion = "";
  const pnpmEntry = process.env.npm_execpath;
  if (pnpmEntry && /pnpm/i.test(pnpmEntry))
    pnpmVersion = execFileSync(process.execPath, [pnpmEntry, "--version"], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true
    }).trim();
  checks.push({
    id: "pnpm",
    status: pnpmVersion.startsWith("11.") ? "ok" : "unknown",
    code: "PNPM_VERSION",
    message: pnpmVersion
      ? `pnpm ${pnpmVersion}；要求 11.x`
      : "无法从当前启动器确认 pnpm 版本；请自行检查 pnpm --version"
  });
  for (const [id, target] of [
    ["backend", apiTarget],
    ["frontend", new URL(`http://127.0.0.1:${env.VITE_DEV_PORT || 5173}`)]
  ] as const) {
    if (
      target.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
      target.username ||
      target.password
    ) {
      checks.push({
        id,
        status: "skipped",
        code: "NON_LOCAL_TARGET",
        message: "有效配置指向非本机服务，未探测外部地址"
      });
      continue;
    }
    try {
      const response = await fetch(new URL(id === "backend" ? "/api/v1/health" : "/@vite/client", target), {
        redirect: "error",
        signal: AbortSignal.timeout(3000)
      });
      const valid =
        id === "backend"
          ? await response
              .json()
              .then(
                (v: { success?: boolean; data?: { name?: string } }) =>
                  v.success === true && v.data?.name === "toolbox-api"
              )
              .catch(() => false)
          : (await response.text()).includes("vite");
      checks.push({
        id,
        status: response.ok && valid ? "ok" : "failed",
        code: valid ? "SERVICE_IDENTITY_OK" : "WRONG_SERVICE",
        message: valid ? `${id} 服务身份检查通过` : `${id} 端口有响应，但不是预期服务；未终止占用进程`
      });
      if (id === "backend" && valid) {
        const ready = await fetch(new URL("/health/ready", target), {
          signal: AbortSignal.timeout(3000),
          redirect: "error"
        });
        const payload = (await ready.json()) as { data?: { status?: string } };
        checks.push({
          id: "readiness",
          status: ready.ok && payload.data?.status === "ready" ? "ok" : "failed",
          code: "SERVICE_READINESS",
          message: ready.ok && payload.data?.status === "ready" ? "数据库和存储就绪" : "服务存活但存储或数据库尚未就绪"
        });
      }
    } catch (error) {
      const failure = diagnosticFailure(error);
      checks.push({ id, status: "failed", ...failure });
    }
  }
  for (const [id, file] of [
    ["edge-python", config.edgeTtsPythonPath],
    ["edge-script", config.edgeTtsScriptPath],
    ["storage", config.storageRoot]
  ] as const) {
    try {
      await fsp.access(file);
      checks.push({ id, status: "ok", code: "PATH_PRESENT", message: "配置路径存在；未加载模型或扫描内容" });
    } catch {
      checks.push({
        id,
        status: id === "storage" ? "warning" : "not-installed",
        code: "PATH_NOT_AVAILABLE",
        message: "配置路径不存在或无法访问；未创建目录或安装环境"
      });
    }
  }
  if (env.VITE_API_BASE && /^https?:/i.test(env.VITE_API_BASE))
    checks.push({
      id: "api-base",
      status: "warning",
      code: "DIRECT_API_BASE",
      message: "浏览器设置了直接 API 基地址，不经过开发代理；请核对其与后端监听配置是否一致"
    });
} catch (error) {
  checks.push({ id: "configuration", status: "failed", ...diagnosticFailure(error) });
}
const report = {
  application: "ecommerce-toolbox",
  schemaVersion: 1,
  mode: "development",
  checkedAt: new Date().toISOString(),
  checks
};
if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
else {
  process.stdout.write(
    "电商工具箱 · 启动与环境诊断（只读）\n" +
      checks.map((c) => `[${c.status}] ${c.id}: ${c.message} (${c.code})`).join("\n") +
      "\n使用 pnpm run doctor --json 获取脱敏 JSON。\n"
  );
}
process.exitCode = checks.some((c) => c.status === "failed") ? 1 : 0;
