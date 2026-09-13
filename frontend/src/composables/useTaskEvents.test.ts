import { effectScope } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@toolbox/shared";
import { useTaskEvents, type TaskEventSource } from "./useTaskEvents";

class FakeEventSource implements TaskEventSource {
  readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  closed = false;

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data = "") {
    const event = { data } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function task(status: TaskDto["status"] = "running"): TaskDto {
  return {
    id: "task/one",
    toolId: "image-ai",
    status,
    progress: status === "completed" ? 100 : 25,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:01.000Z"
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useTaskEvents", () => {
  it("streams task updates and closes after a terminal state", () => {
    const sources: FakeEventSource[] = [];
    const scope = effectScope();
    const result = scope.run(() =>
      useTaskEvents("task/one", {
        createEventSource: (url) => {
          expect(url).toBe("/api/v1/tasks/task%2Fone/events");
          const source = new FakeEventSource();
          sources.push(source);
          return source;
        }
      })
    )!;

    expect(result.connection.value).toBe("connecting");
    sources[0].emit("open");
    expect(result.connection.value).toBe("streaming");
    sources[0].emit("task", "{}");
    expect(result.error.value?.code).toBe("INVALID_TASK_EVENT");
    sources[0].emit("task", JSON.stringify(task("completed")));

    expect(result.task.value?.progress).toBe(100);
    expect(result.connection.value).toBe("completed");
    expect(sources[0].closed).toBe(true);
    scope.stop();
  });

  it("uses exponential reconnects, pauses while hidden, and aborts polling on dispose", async () => {
    vi.useFakeTimers();
    let visible = true;
    let visibilityListener: () => void = () => undefined;
    const sources: FakeEventSource[] = [];
    const pollSignals: AbortSignal[] = [];
    const scope = effectScope();
    const result = scope.run(() =>
      useTaskEvents("task/one", {
        maxReconnectAttempts: 1,
        reconnectBaseMs: 100,
        pollIntervalMs: 200,
        isVisible: () => visible,
        subscribeVisibility: (listener) => {
          visibilityListener = listener;
          return () => undefined;
        },
        createEventSource: () => {
          const source = new FakeEventSource();
          sources.push(source);
          return source;
        },
        fetchTask: async (_taskId, signal) => {
          pollSignals.push(signal);
          return task("running");
        }
      })
    )!;

    sources[0].emit("error");
    expect(result.connection.value).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(100);
    expect(sources).toHaveLength(2);

    visible = false;
    visibilityListener();
    expect(sources[1].closed).toBe(true);
    sources[1].emit("error");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sources).toHaveLength(2);

    visible = true;
    visibilityListener();
    expect(sources).toHaveLength(3);
    sources[2].emit("error");
    await vi.advanceTimersByTimeAsync(200);
    expect(pollSignals).toHaveLength(1);
    expect(result.connection.value).toBe("polling");

    scope.stop();
    expect(pollSignals[0].aborted).toBe(true);
  });
});
