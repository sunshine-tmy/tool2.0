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
});
