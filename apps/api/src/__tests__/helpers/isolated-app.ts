import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../app";
import { getConfig } from "../../config";
import { getProjectRoot } from "../../project-root";
import { createRuntimeLayout } from "../../runtime/runtime-layout";

type TestOptions = {
  environment?: Partial<
    Record<
      | "CORS_ORIGINS"
      | "API_PORT"
      | "DEPLOYMENT_MODE"
      | "ADMIN_PIN"
      | "DATABASE_PATH"
      | "IMAGE_AI_WORKER_URL"
      | "DEPLOYMENT_USAGE"
      | "CHATTERBOX_WORKER_URL"
      | "CHATTERBOX_WORKER_TIMEOUT_MS"
      | "CHATTERBOX_FFMPEG_PATH"
      | "CHATTERBOX_FFPROBE_PATH",
      string
    >
  >;
  desktopManagedCapabilities?: boolean;
};

/** Owns even applications that finish starting after a test assertion fails or times out. */
export async function createIsolatedAppFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-app-isolated-"));
  const layout = createRuntimeLayout({
    appRoot: root,
    configRoot: path.join(root, "config"),
    storageRoot: path.join(root, "storage"),
    runtimeRoot: path.join(root, "runtime"),
    modelsRoot: path.join(root, "models"),
    scriptsRoot: path.join(root, "scripts"),
    frontendDistRoot: path.join(root, "frontend", "dist")
  });
  const pending: Array<ReturnType<typeof createApp>> = [];
  let disposed = false;
  let disposal: Promise<void> | undefined;

  function dispose() {
    disposed = true;
    return (disposal ??= disposeResources());
  }

  async function closeApps() {
    const started = await Promise.allSettled(pending);
    const closed = await Promise.allSettled(
      started.flatMap((result) => (result.status === "fulfilled" ? [result.value.close()] : []))
    );
    const failures = closed.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    // A failed close retains the fixture for diagnosis rather than deleting live application files.
    if (failures.length) throw new AggregateError(failures, `Cannot close isolated applications: ${root}`);
  }

  async function disposeResources() {
    await closeApps();
    const relative = path.relative(path.resolve(os.tmpdir()), root);
    if (
      path.dirname(relative) !== "." ||
      !path.basename(relative).startsWith("toolbox-app-isolated-") ||
      (await fs.lstat(root)).isSymbolicLink()
    ) {
      throw new Error(`Refusing to remove an unowned test directory: ${root}`);
    }
    await fs.rm(root, { recursive: true, force: true });
  }

  try {
    await fs.mkdir(layout.scriptsRoot, { recursive: true });
    // The real cleanup engine resolves its root from import.meta.url, not its cwd.
    const runtimeFiles: string[] = JSON.parse(
      await fs.readFile(path.join(getProjectRoot(), "tooling/build/runtime-scripts.json"), "utf8")
    ).groups.maintenance;
    for (const relative of runtimeFiles) {
      const destination = path.join(root, relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(getProjectRoot(), relative), destination);
    }
  } catch (error) {
    await dispose();
    throw error;
  }

  return {
    root,
    layout,
    closeApps,
    start(options: TestOptions = {}) {
      if (disposed) return Promise.reject(new Error("Isolated application fixture already disposed"));
      const starting = Promise.resolve().then(() =>
        createApp({
          config: getConfig({
            layout,
            dotenvPath: false,
            environment: {
              NODE_ENV: "test",
              DATABASE_PATH: ":memory:",
              IMAGE_AI_WORKER_URL: "http://127.0.0.1:1",
              CHATTERBOX_WORKER_URL: "http://127.0.0.1:1",
              EDGE_TTS_FFMPEG_PATH: path.join(root, "uninstalled", "ffmpeg"),
              CHATTERBOX_FFMPEG_PATH: path.join(root, "uninstalled", "ffmpeg"),
              CHATTERBOX_FFPROBE_PATH: path.join(root, "uninstalled", "ffprobe"),
              ...options.environment
            },
            desktopManagedCapabilities: options.desktopManagedCapabilities
          })
        })
      );
      pending.push(starting);
      // Observe rejection immediately, including a late startup failure after test timeout.
      void starting.catch(() => undefined);
      return starting;
    },
    dispose
  };
}
