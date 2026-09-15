import { describe, expect, it } from "vitest";
import { createTaskStore } from "../tasks/task-store";

describe("task store", () => {
  it("creates a pending task and reads it by id", () => {
    const store = createTaskStore();
    const task = store.create("image-compress");

    expect(task.status).toBe("pending");
    expect(task.toolId).toBe("image-compress");
    expect(store.get(task.id)).toEqual(task);
  });

  it("updates task progress and output path", () => {
    const store = createTaskStore();
    const task = store.create("image-compress");

    store.update(task.id, {
      status: "completed",
      progress: 100,
      outputPath: "storage/outputs/result.webp"
    });

    expect(store.get(task.id)).toMatchObject({
      status: "completed",
      progress: 100,
      outputPath: "storage/outputs/result.webp"
    });
  });

  it("evicts the oldest task when the bounded store is full", () => {
    const store = createTaskStore(2);
    const first = store.create("first");
    const second = store.create("second");
    const third = store.create("third");

    expect(store.get(first.id)).toBeUndefined();
    expect(store.get(second.id)).toBeDefined();
    expect(store.get(third.id)).toBeDefined();
  });

  it("does not expose mutable references to stored tasks", () => {
    const store = createTaskStore();
    const task = store.create("image-compress");
    task.progress = 99;

    expect(store.get(task.id)?.progress).toBe(0);
    expect(store.remove(task.id)).toBe(true);
    expect(store.get(task.id)).toBeUndefined();
  });

  it("upserts externally managed tasks with stable ids and emits updates", () => {
    const store = createTaskStore();
    const updates: number[] = [];
    const unsubscribe = store.subscribe("image-ai-1", (task) => updates.push(task.progress));

    store.upsert({
      id: "image-ai-1",
      toolId: "image-ai",
      status: "pending",
      progress: 0,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z"
    });
    store.upsert({
      id: "image-ai-1",
      toolId: "image-ai",
      status: "running",
      progress: 45,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:01.000Z"
    });
    unsubscribe();

    expect(store.get("image-ai-1")).toMatchObject({ status: "running", progress: 45 });
    expect(updates).toEqual([0, 45]);
  });
});
