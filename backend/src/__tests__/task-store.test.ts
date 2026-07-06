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
    const task = store.create("format-convert");

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
});
