import { nanoid } from "nanoid";

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

export type TaskPatch = Partial<Pick<Task, "status" | "progress" | "outputPath" | "error">>;

export type TaskStore = {
  create: (toolId: string) => Task;
  get: (id: string) => Task | undefined;
  update: (id: string, patch: TaskPatch) => Task | undefined;
  list: () => Task[];
};

export function createTaskStore(): TaskStore {
  const tasks = new Map<string, Task>();

  return {
    create(toolId) {
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
      return task;
    },
    get(id) {
      return tasks.get(id);
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
      return next;
    },
    list() {
      return Array.from(tasks.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }
  };
}
