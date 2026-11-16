import { describe, expect, it, vi } from "vitest";
import {
  createInferenceResourceCoordinator,
  type InferenceResourceKind,
  type InferenceWorkerControl
} from "../core/workers/inference-resource-coordinator";

function fixture(
  overrides: Partial<Record<InferenceResourceKind, Partial<InferenceWorkerControl>>> = {},
  unloadTimeoutMs = 15_000
) {
  const events: string[] = [];
  const workers = Object.fromEntries(
    (["image-ai", "chatterbox", "video-ai"] as const).map((kind) => [
      kind,
      {
        configured: () => true,
        health: vi.fn(async () => {
          events.push(`health:${kind}`);
          return undefined;
        }),
        unload: vi.fn(async () => {
          events.push(`unload:${kind}`);
          return undefined;
        }),
        restart: vi.fn(async () => {
          events.push(`restart:${kind}`);
        }),
        ...overrides[kind]
      }
    ])
  ) as Record<InferenceResourceKind, InferenceWorkerControl>;
  const coordinator = createInferenceResourceCoordinator({ enabled: true, workers, unloadTimeoutMs });
  return { coordinator, events, workers };
}

function codedError(code: string) {
  return Object.assign(new Error(code), { code });
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("Timed out waiting for coordinator state");
}

describe("Mac inference resource coordinator", () => {
  it("grants requests in FIFO order and unloads each previous model class before switching", async () => {
    const { coordinator, events } = fixture();
    const first = await coordinator.acquire("image-ai");
    const order: string[] = [];
    const second = coordinator.acquire("chatterbox").then(async (lease) => {
      order.push("chatterbox");
      await lease.release();
    });
    const third = coordinator.acquire("video-ai").then(async (lease) => {
      order.push("video-ai");
      await lease.release();
    });

    await first.release();
    await Promise.all([second, third]);
    expect(order).toEqual(["chatterbox", "video-ai"]);
    expect(events).toEqual(["unload:image-ai", "unload:chatterbox"]);
    expect(coordinator.snapshot()).toMatchObject({ active: null, queued: [] });
    await coordinator.close();
  });

  it("removes an aborted waiter immediately without disturbing the active lease", async () => {
    const { coordinator } = fixture();
    const first = await coordinator.acquire("image-ai");
    const controller = new AbortController();
    const waiting = coordinator.acquire("video-ai", { signal: controller.signal });
    expect(coordinator.snapshot().queued).toEqual(["video-ai"]);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ code: "INFERENCE_RESOURCE_CANCELLED" });
    expect(coordinator.snapshot()).toMatchObject({ active: "image-ai", queued: [] });
    await first.release();
    await coordinator.close();
  });

  it("keeps a granted lease until the active Worker call reaches its safe boundary", async () => {
    const { coordinator } = fixture();
    const controller = new AbortController();
    const lease = await coordinator.acquire("image-ai", { signal: controller.signal });
    controller.abort();
    expect(coordinator.snapshot().active).toBe("image-ai");
    await lease.release();
    expect(coordinator.snapshot().active).toBeNull();
    await coordinator.close();
  });

  it("releases its lease after a failed task so the next class can proceed", async () => {
    const { coordinator, events } = fixture();
    const failed = coordinator.run("image-ai", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error("synthetic inference failure");
    });
    await until(() => coordinator.snapshot().active === "image-ai");
    const second = coordinator.acquire("video-ai");
    await expect(failed).rejects.toThrow("synthetic inference failure");
    const lease = await second;
    expect(events).toEqual(["unload:image-ai"]);
    await lease.release();
    await coordinator.close();
  });

  it("recovers only a worker whose connection was refused", async () => {
    const { coordinator, workers, events } = fixture();
    await expect(
      coordinator.run("image-ai", async () => {
        throw codedError("WORKER_CONNECTION_REFUSED");
      })
    ).rejects.toMatchObject({ code: "WORKER_CONNECTION_REFUSED" });
    await until(() => events.includes("health:image-ai"));
    expect(workers["image-ai"].restart).toHaveBeenCalledOnce();
    await coordinator.close();
  });

  it("does not start another model or restart a worker when unload times out", async () => {
    const { coordinator, workers } = fixture(
      {
        "image-ai": { unload: vi.fn(() => new Promise(() => undefined)) }
      },
      20
    );
    const first = await coordinator.acquire("image-ai");
    const waiting = coordinator.acquire("video-ai");
    await first.release();
    await expect(waiting).rejects.toMatchObject({ code: "WORKER_UNLOAD_TIMEOUT" });
    expect(workers["video-ai"].health).not.toHaveBeenCalled();
    expect(workers["image-ai"].restart).not.toHaveBeenCalled();
    expect(coordinator.snapshot().active).toBeNull();
    await coordinator.close();
  });

  it("health-checks on wake and restarts only a confirmed dead worker", async () => {
    const { coordinator, workers, events } = fixture({
      "image-ai": {
        health: vi.fn().mockRejectedValueOnce(codedError("WORKER_CONNECTION_REFUSED")).mockResolvedValue(undefined)
      }
    });
    await coordinator.notifyResume();
    await until(() => !coordinator.snapshot().resumePending);
    expect(events).toEqual(["restart:image-ai", "health:chatterbox", "health:video-ai"]);
    expect(workers["image-ai"].health).toHaveBeenCalledTimes(2);
    expect(workers["image-ai"].restart).toHaveBeenCalledOnce();
    expect(workers.chatterbox.restart).not.toHaveBeenCalled();
    await coordinator.close();
  });

  it("waits when a wake health probe reports that a worker is still busy", async () => {
    const health = vi.fn().mockResolvedValueOnce({ busy: true }).mockResolvedValueOnce({ busy: false });
    const { coordinator } = fixture({ "video-ai": { health } });
    await coordinator.notifyResume();
    await until(() => coordinator.snapshot().resumePending);
    const lease = await coordinator.acquire("image-ai");
    expect(health).toHaveBeenCalledTimes(2);
    expect(coordinator.snapshot().active).toBe("image-ai");
    await lease.release();
    await coordinator.close();
  });

  it("closes the queue, rejects waiting work, and waits for the active lease", async () => {
    const { coordinator } = fixture();
    const active = await coordinator.acquire("image-ai");
    const waiting = coordinator.acquire("chatterbox");
    const closing = coordinator.close();
    await expect(waiting).rejects.toMatchObject({ code: "RESOURCE_COORDINATOR_CLOSED" });
    await active.release();
    await closing;
    expect(coordinator.snapshot()).toMatchObject({ closed: true, active: null, queued: [] });
  });

  it("keeps non-Mac callers on the original no-op path", async () => {
    const { events } = fixture();
    const coordinator = createInferenceResourceCoordinator({
      enabled: false,
      workers: {
        "image-ai": { configured: () => true, health: vi.fn(), unload: vi.fn(), restart: vi.fn() },
        chatterbox: { configured: () => true, health: vi.fn(), unload: vi.fn(), restart: vi.fn() },
        "video-ai": { configured: () => true, health: vi.fn(), unload: vi.fn(), restart: vi.fn() }
      }
    });
    await expect(coordinator.run("image-ai", async () => "ready")).resolves.toBe("ready");
    expect(events).toEqual([]);
    await coordinator.close();
  });
});
