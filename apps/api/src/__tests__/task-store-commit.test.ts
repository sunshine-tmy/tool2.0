import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore, type Task } from "../tasks/task-store";

let database: ToolboxDatabase;
beforeEach(() => {
  database = new ToolboxDatabase(":memory:");
});
afterEach(() => {
  vi.restoreAllMocks();
  database.close();
});

function task(id = "atomic-001"): Task {
  return {
    id,
    toolId: "image-ai",
    status: "completed",
    progress: 100,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:01Z"
  };
}
function writeDomain(record: Task) {
  database.upsert({ ...record, kind: "image-ai-task", payload: record });
}

it("publishes domain memory and listeners only after both records leave the transaction", () => {
  const store = createTaskStore(2, database),
    next = task();
  store.upsert({ ...next, status: "running", progress: 95 });
  let published = false;
  const listener = vi.fn(() => {
    expect(database.connection.inTransaction).toBe(false);
    expect(database.get("image-ai-task", next.id)?.status).toBe("completed");
    expect(database.get("task", next.id)?.status).toBe("completed");
    expect(published).toBe(true);
    expect(store.get(next.id)?.status).toBe("completed");
  });
  store.subscribe(next.id, listener);
  const result = store.commit(
    next,
    () => {
      expect(database.connection.inTransaction).toBe(true);
      expect(store.get(next.id)?.status).toBe("running");
      expect(published).toBe(false);
      writeDomain(next);
    },
    () => {
      expect(database.connection.inTransaction).toBe(false);
      expect(database.get("task", next.id)?.status).toBe("completed");
      published = true;
    }
  );
  expect(listener).toHaveBeenCalledTimes(1);
  result.progress = 1;
  expect(store.get(next.id)?.progress).toBe(100);
});

it.each(["domain", "projection", "commit"] as const)(
  "rolls back %s failure without evicting or publishing",
  (failureAt) => {
    const store = createTaskStore(2, database);
    store.upsert(task("oldest-001"));
    store.upsert(task("second-001"));
    const next = task("newest-001"),
      failure = new Error(`synthetic ${failureAt} failure`);
    const write = database.upsert.bind(database);
    vi.spyOn(database, "upsert").mockImplementation((entity) => {
      if (
        (failureAt === "domain" && entity.kind === "image-ai-task") ||
        (failureAt === "projection" && entity.kind === "task")
      )
        throw failure;
      return write(entity);
    });
    if (failureAt === "commit") {
      const transaction = database.transaction.bind(database);
      vi.spyOn(database, "transaction").mockImplementation((operation) =>
        transaction(() => {
          operation();
          throw failure;
        })
      );
    }
    const publish = vi.fn(),
      listener = vi.fn();
    store.subscribe(next.id, listener);
    expect(() => store.commit(next, () => writeDomain(next), publish)).toThrow(failure);
    expect(publish).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(store.get(next.id)).toBeUndefined();
    expect(database.get("image-ai-task", next.id)).toBeUndefined();
    expect(database.get("task", next.id)).toBeUndefined();
    expect(store.get("oldest-001")).toBeDefined();
    expect(database.get("task", "oldest-001")).toBeDefined();
    expect(store.get("second-001")).toBeDefined();
  }
);

it("keeps the existing bounded order and replaces existing identities without an extra eviction", () => {
  const store = createTaskStore(2, database);
  store.upsert(task("oldest-001"));
  store.upsert(task("second-001"));
  const replacement = task("second-001");
  store.commit(
    replacement,
    () => writeDomain(replacement),
    () => undefined
  );
  expect(store.get("oldest-001")).toBeDefined();
  const next = task("newest-001");
  store.commit(
    next,
    () => writeDomain(next),
    () => undefined
  );
  expect(store.get("oldest-001")).toBeUndefined();
  expect(database.get("task", "oldest-001")).toBeUndefined();
  expect(store.get("second-001")).toBeDefined();
  expect(store.get(next.id)).toStrictEqual(next);
});

it("retains in-memory-only task store support without requiring a database", () => {
  const store = createTaskStore(),
    next = task(),
    events: string[] = [];
  store.subscribe(next.id, () => {
    events.push("listener");
  });
  store.commit(
    next,
    () => {
      events.push("save");
    },
    () => {
      events.push("publish");
    }
  );
  expect(events).toEqual(["save", "publish", "listener"]);
  expect(store.get(next.id)).toStrictEqual(next);
});
