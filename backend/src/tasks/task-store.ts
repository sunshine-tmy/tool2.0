/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import { nanoid } from "nanoid";
import type { ToolboxDatabase } from "../database/toolbox-database";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export type Task = {
  id: string;
  toolId: string;
  status: TaskStatus;
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type TaskPatch = Partial<Pick<Task, "status" | "progress" | "outputPath" | "error">>;

export type TaskStore = {
  create: (toolId: string) => Task;
  upsert: (task: Task) => Task;
  get: (id: string) => Task | undefined;
  update: (id: string, patch: TaskPatch) => Task | undefined;
  remove: (id: string) => boolean;
  list: () => Task[];
  subscribe: (id: string, listener: (task: Task) => void) => () => void;
};

export function createTaskStore(maxEntries = 1000, database?: ToolboxDatabase): TaskStore {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");
  const tasks = new Map<string, Task>(
    (database?.list("task") ?? []).map((entity) => {
      const task = entity.payload as Task;
      return [task.id, task];
    })
  );
  const listeners = new Map<string, Set<(task: Task) => void>>();

  const evictOldest = () => {
    while (tasks.size >= maxEntries) {
      const oldestId = tasks.keys().next().value as string | undefined;
      if (!oldestId) break;
      tasks.delete(oldestId);
      database?.remove("task", oldestId);
    }
  };

  const persist = (task: Task) => {
    database?.upsert({
      id: task.id,
      kind: "task",
      status: task.status,
      payload: task,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
    for (const listener of listeners.get(task.id) ?? []) listener({ ...task });
  };

  return {
    create(toolId) {
      evictOldest();
      const now = new Date().toISOString();
      const task: Task = {
        id: nanoid(12),
        toolId,
        status: "pending",
        progress: 0,
        createdAt: now,
        updatedAt: now
      };
      tasks.set(task.id, task);
      persist(task);
      return { ...task };
    },
    upsert(task) {
      if (!tasks.has(task.id)) evictOldest();
      const next = { ...task };
      tasks.set(next.id, next);
      persist(next);
      return { ...next };
    },
    get(id) {
      const task = tasks.get(id);
      return task ? { ...task } : undefined;
    },
    update(id, patch) {
      const current = tasks.get(id);
      if (!current) {
        return undefined;
      }

      const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      tasks.set(id, next);
      persist(next);
      return { ...next };
    },
    remove(id) {
      database?.remove("task", id);
      return tasks.delete(id);
    },
    list() {
      return Array.from(tasks.values(), (task) => ({ ...task })).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      );
    },
    subscribe(id, listener) {
      const bucket = listeners.get(id) ?? new Set<(task: Task) => void>();
      bucket.add(listener);
      listeners.set(id, bucket);
      return () => {
        bucket.delete(listener);
        if (bucket.size === 0) listeners.delete(id);
      };
    }
  };
}
