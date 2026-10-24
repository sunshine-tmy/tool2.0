/** src/ and dist/ have the same depth; the anchor belongs to the application, not a shared package. */
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getProjectRoot(moduleUrl = import.meta.url) {
  const application = path.resolve(fileURLToPath(new URL("..", moduleUrl)));
  // Source workspaces live in apps/api; distributed resources keep backend/.
  return path.basename(application) === "api" && path.basename(path.dirname(application)) === "apps"
    ? path.resolve(application, "../..")
    : path.dirname(application);
}

export function isBuiltProjectModule(moduleUrl = import.meta.url) {
  return path.basename(path.dirname(fileURLToPath(moduleUrl))) === "dist";
}

/** Workspace output moves; the distributed backend/frontend resource layout does not. */
export function getFrontendDistRoot(appRoot: string, moduleUrl = import.meta.url) {
  const application = path.resolve(fileURLToPath(new URL("..", moduleUrl)));
  return path.basename(application) === "api" && path.basename(path.dirname(application)) === "apps"
    ? path.join(appRoot, "apps", "web", "dist")
    : path.join(appRoot, "frontend", "dist");
}
