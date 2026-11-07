/** Regression: signed CPU/GPU workers start through the application progress-compatibility entry. */
import { EventEmitter } from "node:events";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import { ComponentManager, ComponentManagerError } from "../modules/components/component-manager";
import { configureDesktopCapabilityRuntime } from "../runtime/desktop-capability-runtime";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: mocks.spawn
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.spawn.mockReset();
});

describe("desktop video worker entry", () => {
  it("keeps verified worker/model paths, authentication and original script bytes behind the app launcher", async () => {
    const fixture = await createIsolatedAppFixture();
    const generation = path.join(fixture.root, "中文 能力包");
    const config = getConfig({
      dotenvPath: false,
      environment: {},
      layout: fixture.layout,
      desktopManagedCapabilities: true
    });
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      exitCode: null,
      signalCode: null,
      kill: vi.fn(() => {
        child.emit("exit", 0);
        child.emit("close", 0);
        return true;
      })
    });
    mocks.spawn.mockReturnValue(child as unknown as ChildProcess);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true, data: { available: true } })))
    );
    const missing = () => {
      throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "not installed");
    };
    const components = {
      resolveInstalledPython: vi.fn(async (id: string) =>
        id === "video-ai"
          ? {
              path: path.join(generation, "venv", "Scripts", "python.exe"),
              generationRoot: generation,
              manifest: {}
            }
          : missing()
      ),
      resolveInstalledAsset: vi.fn(async (id: string, asset: string) =>
        ["video-ai", "ffmpeg"].includes(id)
          ? {
              path: path.join(generation, asset),
              generationRoot: generation,
              manifest: {}
            }
          : missing()
      )
    } as unknown as ComponentManager;
    let runtime: Awaited<ReturnType<typeof configureDesktopCapabilityRuntime>> | undefined;
    try {
      runtime = await configureDesktopCapabilityRuntime(config, components);
      // Wait for initialization without restarting/stopping the video worker.
      await runtime.beforeUninstall("uninstalled-test-component");
      expect(config.videoAiCapabilityReady).toBe(true);
      expect(mocks.spawn).toHaveBeenCalledTimes(1);
      const [python, args, options] = mocks.spawn.mock.calls[0];
      expect(python).toBe(path.join(generation, "venv", "Scripts", "python.exe"));
      expect(args).toEqual([
        path.join(fixture.layout.scriptsRoot, "video-ai-worker-launcher.py"),
        path.join(generation, "scripts", "video-ai-worker.py"),
        "--host",
        "127.0.0.1",
        "--port",
        expect.any(String)
      ]);
      expect(options).toMatchObject({
        cwd: generation,
        windowsHide: true,
        env: {
          VIDEO_AI_STORAGE_ROOT: config.videoAiDir,
          VIDEO_AI_LAMA_MODEL: path.join(generation, "models", "video-ai", "big-lama.pt"),
          VIDEO_AI_WORKER_TOKEN: config.videoAiWorkerToken,
          TOOLBOX_DESKTOP_MANAGED: "1"
        }
      });
      expect(options.env.VIDEO_AI_WORKER_TOKEN).toBeTruthy();
      expect(options.shell).toBeUndefined();
      expect(components.resolveInstalledAsset).toHaveBeenCalledWith("video-ai", "scripts/video-ai-worker.py");
    } finally {
      await runtime?.close();
      await fixture.dispose();
    }
    expect(child.kill).toHaveBeenCalledTimes(1);
  });
});
