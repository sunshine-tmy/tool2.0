import path from "node:path";
import { ComponentManagerError } from "./component-error";
export function safeChildPath(root: string, child: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, child);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包路径越界");
  }
  return resolved;
}

export function isPathWithin(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

export function isSafeRelativePath(value: string) {
  if (!value || value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  const segments = value.split("/");
  return (
    normalized === value &&
    !normalized.startsWith("../") &&
    normalized !== ".." &&
    !segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes(":") ||
        segment.split("").some((character) => character.charCodeAt(0) < 32)
    )
  );
}

export function isSafeArchivePath(value: string) {
  return value.endsWith("/") && value.length > 1 ? isSafeRelativePath(value.slice(0, -1)) : isSafeRelativePath(value);
}
