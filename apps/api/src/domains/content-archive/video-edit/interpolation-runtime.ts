import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ComponentManager } from "../../../modules/components/component-manager";
export type RifeRuntime = { executable: string; model: string; version: string };

/** 桌面只解析受签名目录；源码调试允许显式指定原生 RIFE 路径。 */
export async function resolveRifeRuntime(
  managed: boolean,
  components?: ComponentManager
): Promise<RifeRuntime | undefined> {
  try {
    if (components) {
      const [exe, param, weights] = await Promise.all([
        components.resolveInstalledAsset(
          "video-interpolation",
          `bin/rife-ncnn-vulkan${process.platform === "win32" ? ".exe" : ""}`
        ),
        components.resolveInstalledAsset("video-interpolation", "models/rife-v4.6/flownet.param"),
        components.resolveInstalledAsset("video-interpolation", "models/rife-v4.6/flownet.bin")
      ]);
      return {
        executable: exe.path,
        model: path.dirname(param.path),
        version: `${exe.manifest.version}:${weights.manifest.files.find((file) => file.path.endsWith("flownet.bin"))?.sha256.slice(0, 16)}`
      };
    }
  } catch {
    /* 未安装能力时兼容引擎仍可使用。 */
  }
  if (!managed && process.env.TOOLBOX_RIFE_PATH && process.env.TOOLBOX_RIFE_MODEL_DIR) {
    try {
      const executable = await fs.realpath(process.env.TOOLBOX_RIFE_PATH),
        model = await fs.realpath(process.env.TOOLBOX_RIFE_MODEL_DIR);
      const files = await Promise.all([
        fs.readFile(executable),
        fs.readFile(path.join(model, "flownet.param")),
        fs.readFile(path.join(model, "flownet.bin"))
      ]);
      return {
        executable,
        model,
        version: `rife-v4.6:${createHash("sha256").update(Buffer.concat(files)).digest("hex").slice(0, 16)}`
      };
    } catch {
      return undefined;
    }
  }
  return undefined;
}
