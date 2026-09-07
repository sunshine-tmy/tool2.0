import { nanoid } from "nanoid";

type TaskStatus = "pending" | "running" | "completed" | "failed";

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
  get: (id: string) => Task | undefined;
  update: (id: string, patch: TaskPatch) => Task | undefined;
  remove: (id: string) => boolean;
  list: () => Task[];
};

export function createTaskStore(maxEntries = 1000): TaskStore {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");
  const tasks = new Map<string, Task>();

  return {
    create(toolId) {
      while (tasks.size >= maxEntries) {
        const oldestId = tasks.keys().next().value as string | undefined;
        if (!oldestId) break;
        tasks.delete(oldestId);
      }
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
      return { ...task };
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
      return { ...next };
    },
    remove(id) {
      return tasks.delete(id);
    },
    list() {
      return Array.from(tasks.values(), (task) => ({ ...task })).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      );
    }
  };
}
