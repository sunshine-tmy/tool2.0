import fs from "node:fs/promises";
import path from "node:path";
import fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { getProjectRoot } from "../project-root";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

// Only fixture lifecycle tests replace application assembly. app.test.ts uses the real application.
vi.mock("../app", () => ({ createApp: vi.fn(async () => fastify()) }));

const fixtures: Array<Awaited<ReturnType<typeof createIsolatedAppFixture>>> = [];
async function fixture() {
  const value = await createIsolatedAppFixture();
  fixtures.push(value);
  return value;
}
afterEach(async () => {
  try {
    await Promise.all(fixtures.splice(0).map((value) => value.dispose()));
  } finally {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  }
});

describe("isolated application fixture", () => {
  it("owns every layout path and copies the explicit runtime script closure", async () => {
    const first = await fixture();
    const second = await fixture();
    expect(first.root).not.toBe(second.root);
    for (const value of Object.values(first.layout)) {
      const relative = path.relative(first.root, value);
      expect(path.isAbsolute(relative)).toBe(false);
      expect(relative.split(path.sep)).not.toContain("..");
    }
    const runtimeFiles: string[] = JSON.parse(
      await fs.readFile(path.join(getProjectRoot(), "tooling/build/runtime-scripts.json"), "utf8")
    ).groups.maintenance;
    expect(await fs.readdir(first.layout.scriptsRoot)).toEqual(
      runtimeFiles
        .filter((file) => file.startsWith("scripts/"))
        .map((file) => path.basename(file))
        .sort()
    );
    for (const relative of runtimeFiles) {
      expect(await fs.readFile(path.join(first.root, relative))).toEqual(
        await fs.readFile(path.join(getProjectRoot(), relative))
      );
    }
    await expect(fs.stat(first.layout.runtimeRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("uses real configuration without inheriting host environment or dotenv", async () => {
    const value = await fixture();
    vi.stubEnv("API_PORT", "invalid-host-port");
    vi.stubEnv("STORAGE_ROOT", path.join(value.root, "host-storage"));
    await fs.mkdir(value.layout.configRoot);
    await fs.writeFile(path.join(value.layout.configRoot, ".env"), "API_PORT=invalid-dotenv-port\n");
    await value.start();
    const config = vi.mocked(createApp).mock.calls[0][0]?.config;
    expect(config?.runtime).toEqual(value.layout);
    expect(config?.storageRoot).toBe(value.layout.storageRoot);
    expect(config?.databasePath).toBe(":memory:");
    expect(config?.port).toBe(3100);
    expect(config?.imageAiWorkerUrl).toBe("http://127.0.0.1:1");
    expect(config?.chatterboxWorkerUrl).toBe("http://127.0.0.1:1");
    expect(process.env.API_PORT).toBe("invalid-host-port");
  });

  it("keeps explicit owned AI restart settings without inheriting or changing host configuration", async () => {
    const value = await fixture();
    const databasePath = path.join(value.layout.storageRoot, "toolbox.db");
    vi.stubEnv("DATABASE_PATH", path.join(value.root, "host-only.db"));
    vi.stubEnv("IMAGE_AI_WORKER_URL", "http://127.0.0.1:9");
    vi.stubEnv("DEPLOYMENT_USAGE", "commercial");
    for (let index = 0; index < 2; index++) {
      await value.start({
        environment: {
          DATABASE_PATH: databasePath,
          IMAGE_AI_WORKER_URL: "http://127.0.0.1:12345",
          DEPLOYMENT_USAGE: "internal-noncommercial"
        }
      });
      const config = vi.mocked(createApp).mock.calls[index][0]?.config;
      expect(config?.databasePath).toBe(databasePath);
      expect(config?.imageAiWorkerUrl).toBe("http://127.0.0.1:12345");
      expect(config?.deploymentUsage).toBe("internal-noncommercial");
      expect(config?.runtime).toEqual(value.layout);
    }
    expect(process.env.IMAGE_AI_WORKER_URL).toBe("http://127.0.0.1:9");
    expect(process.env.DEPLOYMENT_USAGE).toBe("commercial");
  });

  it("cleans a rejected configuration without bypassing its validation", async () => {
    const value = await fixture();
    await expect(value.start({ environment: { API_PORT: "invalid" } })).rejects.toThrow(/API_PORT/);
    expect(createApp).not.toHaveBeenCalled();
    await value.dispose();
    await expect(fs.stat(value.root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps explicit Chatterbox test endpoints and media tools without inheriting host configuration", async () => {
    const value = await fixture();
    vi.stubEnv("CHATTERBOX_WORKER_URL", "http://127.0.0.1:9");
    vi.stubEnv("CHATTERBOX_WORKER_TIMEOUT_MS", "invalid-host-timeout");
    vi.stubEnv("CHATTERBOX_FFMPEG_PATH", "host-only-ffmpeg");
    vi.stubEnv("CHATTERBOX_FFPROBE_PATH", "host-only-ffprobe");
    await value.start({
      environment: {
        CHATTERBOX_WORKER_URL: "http://127.0.0.1:12345",
        CHATTERBOX_WORKER_TIMEOUT_MS: "10000",
        CHATTERBOX_FFMPEG_PATH: "ffmpeg",
        CHATTERBOX_FFPROBE_PATH: "ffprobe"
      }
    });
    const config = vi.mocked(createApp).mock.calls[0][0]?.config;
    expect(config).toMatchObject({
      chatterboxWorkerUrl: "http://127.0.0.1:12345",
      chatterboxWorkerTimeoutMs: 10000,
      chatterboxFfmpegPath: "ffmpeg",
      chatterboxFfprobePath: "ffprobe",
      runtime: value.layout
    });
    expect(process.env.CHATTERBOX_WORKER_URL).toBe("http://127.0.0.1:9");
    expect(process.env.CHATTERBOX_WORKER_TIMEOUT_MS).toBe("invalid-host-timeout");
    expect(process.env.CHATTERBOX_FFMPEG_PATH).toBe("host-only-ffmpeg");
    expect(process.env.CHATTERBOX_FFPROBE_PATH).toBe("host-only-ffprobe");
  });

  it("closes every unclosed application after a failed assertion but retains files for external fixture teardown", async () => {
    const value = await fixture();
    const closed: number[] = [];
    for (let index = 0; index < 2; index++) {
      const app = fastify();
      app.addHook("onClose", async () => {
        expect((await fs.stat(value.root)).isDirectory()).toBe(true);
        closed.push(index);
      });
      vi.mocked(createApp).mockResolvedValueOnce(app);
      await value.start();
    }
    let assertionFailure: unknown;
    try {
      expect("synthetic actual value").toBe("deliberately failing assertion");
    } catch (error) {
      assertionFailure = error;
    } finally {
      await value.closeApps();
    }
    expect(assertionFailure).toBeInstanceOf(Error);
    expect(closed.sort()).toEqual([0, 1]);
    const workerArtifact = path.join(value.root, "synthetic-worker-teardown.txt");
    await fs.writeFile(workerArtifact, "external fixtures can finish before directory removal");
    expect(await fs.readFile(workerArtifact, "utf8")).toContain("external fixtures");
    await value.dispose();
    await expect(fs.stat(value.root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retains the owned root and reports close failures instead of removing files beneath a live application", async () => {
    const value = await fixture();
    const app = await value.start();
    const failure = new Error("synthetic close failure");
    const close = vi.spyOn(app, "close").mockRejectedValue(failure);
    try {
      await expect(value.closeApps()).rejects.toMatchObject({ errors: [failure] });
      expect((await fs.stat(value.root)).isDirectory()).toBe(true);
    } finally {
      close.mockRestore();
    }
  });

  it("waits for late startup and closes the application before removing its files", async () => {
    const value = await fixture();
    let complete!: (app: Awaited<ReturnType<typeof createApp>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof createApp>>>((resolve) => {
      complete = resolve;
    });
    vi.mocked(createApp).mockReturnValueOnce(pending);
    const starting = value.start();
    const app = fastify();
    const close = vi.fn(async () => {
      expect((await fs.stat(value.root)).isDirectory()).toBe(true);
    });
    app.addHook("onClose", close);
    const disposing = value.dispose();
    expect(close).not.toHaveBeenCalled();
    complete(app);
    await starting;
    await disposing;
    expect(close).toHaveBeenCalledOnce();
    await expect(fs.stat(value.root)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(value.start()).rejects.toThrow(/already disposed/);
    await value.dispose();
  });

  it("observes startup rejection and still removes its owned directory", async () => {
    const value = await fixture();
    vi.mocked(createApp).mockRejectedValueOnce(new Error("synthetic initialization failure"));
    await expect(value.start()).rejects.toThrow("synthetic initialization failure");
    await value.dispose();
    await expect(fs.stat(value.root)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
