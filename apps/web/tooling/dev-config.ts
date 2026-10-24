/** Node-only build configuration; no application source or browser runtime imports. */
import fs from "node:fs";
import path from "node:path";
import { parseDotEnv, readInteger } from "@toolbox/runtime-core";

export function resolveApiProxyTarget(
  repositoryRoot: string,
  viteEnvironment: Record<string, string | undefined>,
  environment: Record<string, string | undefined> = process.env
) {
  const explicitTarget = viteEnvironment.VITE_API_PROXY_TARGET?.trim();
  if (explicitTarget) return explicitTarget;
  const legacyRoot = environment.TOOLBOX_LEGACY_DATA_ROOT?.trim();
  let configRoot = repositoryRoot;
  if (legacyRoot) {
    if (!path.isAbsolute(legacyRoot))
      throw new Error("TOOLBOX_LEGACY_DATA_ROOT must be an absolute existing directory");
    configRoot = path.resolve(legacyRoot);
    if (!fs.statSync(configRoot).isDirectory())
      throw new Error("TOOLBOX_LEGACY_DATA_ROOT must be an existing directory");
  }
  const file = path.join(configRoot, ".env");
  const fileEnv = fs.existsSync(file) ? parseDotEnv(fs.readFileSync(file, "utf8")) : {};
  const port = readInteger("API_PORT", environment.API_PORT ?? fileEnv.API_PORT, 3100, 1, 65535);
  return `http://127.0.0.1:${port}`;
}
