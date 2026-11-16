import path from "node:path";
import type { ComponentPlatform } from "@toolbox/shared";
import type { ComponentManifestLink } from "./types";
import policy from "../../../../../tooling/components/macos/chromium-framework-links.json";

export const MACOS_CHROMIUM_LINK_COMPONENT_ID = policy.componentId;
export const MACOS_CHROMIUM_LINK_VERSION = policy.version;
export const MACOS_CHROMIUM_BUNDLE_PATH = policy.bundlePath;
export const MACOS_CHROMIUM_FRAMEWORK_PATH = path.posix.join(policy.bundlePath, policy.frameworkPath);

export function expectedMacOSChromiumFrameworkLinks(): ComponentManifestLink[] {
  return policy.links.map(({ path: relativePath, target }) => ({
    path: path.posix.join(policy.bundlePath, relativePath),
    target
  }));
}

export function hasExactMacOSChromiumFrameworkLinks(
  componentId: string,
  version: string,
  platform: ComponentPlatform | undefined,
  links: ComponentManifestLink[] | undefined
) {
  const isPinnedMacChromium =
    componentId === policy.componentId && version === policy.version && platform === policy.platform;
  if (!isPinnedMacChromium) return links === undefined || (Array.isArray(links) && links.length === 0);
  if (!Array.isArray(links)) return false;
  const expected = expectedMacOSChromiumFrameworkLinks();
  if (links.length !== expected.length) return false;
  const actualByPath = new Map<string, string>();
  for (const link of links) {
    if (!link || typeof link.path !== "string" || typeof link.target !== "string" || actualByPath.has(link.path)) {
      return false;
    }
    actualByPath.set(link.path, link.target);
  }
  return expected.every((link) => actualByPath.get(link.path) === link.target);
}

export function isPinnedMacOSChromium(componentId: string, version: string, platform: ComponentPlatform | undefined) {
  return componentId === policy.componentId && version === policy.version && platform === policy.platform;
}

export function resolveMacOSChromiumLinkPath(linkPath: string) {
  const link = expectedMacOSChromiumFrameworkLinks().find((candidate) => candidate.path === linkPath);
  if (!link) return undefined;
  const absolute = path.posix.normalize(path.posix.join(path.posix.dirname(link.path), link.target));
  const framework = MACOS_CHROMIUM_FRAMEWORK_PATH;
  const relative = path.posix.relative(framework, absolute);
  if (!relative || relative === ".." || relative.startsWith("../") || path.posix.isAbsolute(relative)) return undefined;
  return absolute;
}
