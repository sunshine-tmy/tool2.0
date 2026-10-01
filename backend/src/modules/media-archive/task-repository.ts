/** 获取任务独立持久化；通用任务表只投影 SSE 所需字段，不扩散来源 URL 或平台运行时内部配置。 */
import { isContentArchiveTask, type ContentArchiveTask } from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";

export class ArchiveTaskRepository {
  private readonly tasks = new Map<string, ContentArchiveTask>();
  constructor(
    private readonly database: ToolboxDatabase,
    private readonly events: TaskStore
  ) {
    for (const row of database.list("archive-fetch-task")) {
      if (!isContentArchiveTask(row.payload)) throw new Error("ARCHIVE_TASK_PAYLOAD_INVALID");
      const task = row.payload;
      this.tasks.set(task.id, structuredClone(task));
    }
  }
  recoverInterrupted() {
    for (const task of this.tasks.values()) {
      if (task.status !== "pending" && task.status !== "running") continue;
      this.save({
        ...task,
        status: "failed",
        stage: "failed",
        message: "任务因程序退出而中断，请显式重试",
        error: "任务因程序退出而中断，请显式重试",
        errorCode: "ARCHIVE_INTERRUPTED",
        updatedAt: new Date().toISOString()
      });
    }
  }
  get(id: string) {
    const task = this.tasks.get(id);
    return task ? structuredClone(task) : undefined;
  }
  save(task: ContentArchiveTask) {
    if (!isContentArchiveTask(task)) throw new Error("ARCHIVE_TASK_PAYLOAD_INVALID");
    this.database.upsert({
      id: task.id,
      kind: "archive-fetch-task",
      status: task.status,
      payload: task,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
    this.tasks.set(task.id, structuredClone(task));
    this.events.upsert({
      id: task.id,
      toolId: task.platform === "xiaohongshu" ? "xhs-archive" : "media-archive",
      status: task.status,
      progress: task.progress,
      outputPath: task.archiveId,
      error: task.errorCode,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
    // 只裁剪最旧的终态任务；排队与运行记录不会因为历史条数而丢失。
    const completed = [...this.tasks.values()]
      .filter((entry) => entry.status === "completed" || entry.status === "failed")
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    while (this.tasks.size > 500 && completed.length) {
      const old = completed.shift()!;
      this.database.remove("archive-fetch-task", old.id);
      this.tasks.delete(old.id);
    }
    return structuredClone(task);
  }
}
