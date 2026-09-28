import type { ComponentPlatform } from "@toolbox/shared";

export function componentPlatformForRuntime(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): ComponentPlatform | undefined {
  if (platform === "win32" && arch === "x64") return "win32-x64";
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  return undefined;
}
