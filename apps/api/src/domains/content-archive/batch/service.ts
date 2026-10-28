/** Durable spreadsheet coordinator. One owned child at a time, bounded admission, no model or archive lifecycle changes. */
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveImportBatchSchema,
  type ArchiveImportBatch,
  type ArchiveImportCreate,
  type ArchiveImportPreview,
  type ArchiveImportRow,
  type ContentArchiveTask
} from "@toolbox/shared/archive";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import type { ContentArchiveTaskService } from "../core/task-service";
import type { ContentArchiveStore } from "../core/store";
import { ArchiveTaskError } from "../core/provider";
import { previewArchiveRows } from "./input";
import { ArchiveGroupStore } from "../core/groups";

const kind = "archive-import-batch";
const active = (batch: ArchiveImportBatch) => batch.status === "running" || batch.status === "stopping";
export class ArchiveImportService {
  private readonly batches = new Map<string, ArchiveImportBatch>();
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private nextAdmission = 0;
  constructor(
    private readonly database: ToolboxDatabase,
    private readonly store: Pick<ContentArchiveStore, "findBySource" | "findByUrl">,
    private readonly tasks: Pick<ContentArchiveTaskService, "createImport" | "get" | "cancel">,
    private readonly options: { intervalMs?: number; pollMs?: number; now?: () => number; onError?: () => void } = {}
  ) {
    for (const entity of database.list(kind)) {
      if (!Value.Check(ArchiveImportBatchSchema, entity.payload)) throw new Error("ARCHIVE_IMPORT_RECORD_INVALID");
      this.batches.set(entity.id, structuredClone(entity.payload));
    }
  }
  initialize() {
    this.recoverInterrupted();
    this.schedule();
  }
  preview(
    sourceName: string,
    sheetName: string | undefined,
    rows: ArchiveImportCreate["rows"]
  ): Promise<ArchiveImportPreview> {
    return previewArchiveRows(this.store, sourceName, sheetName, rows);
  }
  list() {
    return [...this.batches.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ rows: _rows, ...summary }) => structuredClone(summary));
  }
  get(id: string) {
    const value = this.batches.get(id);
    return value ? structuredClone(value) : undefined;
  }
  create(
    input: ArchiveImportCreate,
    ownership?: { profileId: string; part: number; persist: (batch: ArchiveImportBatch) => void }
  ) {
    return this.serial(async () => {
      this.assertAvailable();
      if (ownership) {
        const previous = [...this.batches.values()].find(
          (batch) => batch.ownerProfileId === ownership.profileId && batch.ownerPart === ownership.part
        );
        if (previous) {
          this.database.transaction(() => ownership.persist(previous));
          return structuredClone(previous);
        }
      }
      if ([...this.batches.values()].some(active))
        throw new ArchiveTaskError("ARCHIVE_IMPORT_BUSY", "已有批次正在执行，请等待完成或停止后续任务", 409);
      if (this.batches.size >= 100)
        throw new ArchiveTaskError(
          "ARCHIVE_IMPORT_HISTORY_FULL",
          "已有 100 个批次，请先删除不需要的批次记录（不会删除作品）",
          409
        );
      const preview = await this.preview(input.sourceName, input.sheetName, input.rows);
      this.assertAvailable();
      if (input.groupId) new ArchiveGroupStore(this.database).assertExists(input.groupId);
      const now = this.timestamp();
      const batch: ArchiveImportBatch = {
        ...preview,
        id: nanoid(12),
        existing: input.existing,
        ...(ownership ? { ownerProfileId: ownership.profileId, ownerPart: ownership.part } : {}),
        ...(input.groupId ? { groupId: input.groupId } : {}),
        status: "running",
        createdAt: now,
        updatedAt: now,
        rows: preview.rows.map((row) => ({
          ...row,
          status:
            row.status === "ready" || (row.status === "existing" && input.existing === "refresh")
              ? "waiting"
              : row.status === "existing"
                ? "skipped"
                : row.status,
          message:
            row.status === "existing" && input.existing === "skip"
              ? "已跳过已归档作品"
              : row.status === "ready" || row.status === "existing"
                ? "等待进入归档队列"
                : row.message
        }))
      };
      if (!batch.rows.some((row) => row.status === "waiting")) batch.status = "completed";
      this.save(batch, ownership?.persist);
      return this.get(batch.id)!;
    });
  }
  cancel(id: string) {
    return this.serial(async () => {
      const batch = this.get(id);
      if (!batch) return undefined;
      if (!active(batch)) return batch;
      batch.status = "stopping";
      for (const row of batch.rows) {
        if (row.status !== "waiting" && row.status !== "running") continue;
        const task = row.taskId ? this.tasks.get(row.taskId) : undefined;
        if (task?.status === "pending") this.applyTask(row, await this.tasks.cancel(task.id));
        else if (task) this.applyTask(row, task);
        if (!row.taskId) {
          row.status = "cancelled";
          row.message = "已停止后续获取";
        }
      }
      this.finish(batch);
      this.save(batch);
      return this.get(id)!;
    });
  }
  async retry(id: string) {
    const batch = this.get(id);
    if (!batch) return undefined;
    if (batch.ownerProfileId && this.database.get("tiktok-profile-job", batch.ownerProfileId))
      throw new ArchiveTaskError("ARCHIVE_IMPORT_OWNED", "请在 TikTok 主页任务中重试失败项，避免重复执行", 409);
    if (active(batch)) throw new ArchiveTaskError("ARCHIVE_IMPORT_BUSY", "批次尚未结束", 409);
    const rows = batch.rows
      .filter((row) => row.status === "failed")
      .map(({ rowNumber, inputUrl, inputPlatform }) => ({ rowNumber, inputUrl, inputPlatform }));
    if (!rows.length) throw new ArchiveTaskError("ARCHIVE_IMPORT_NO_FAILURES", "没有可重试的失败或中断项", 409);
    return this.create({
      sourceName: batch.sourceName,
      sheetName: batch.sheetName,
      existing: batch.existing,
      ...(batch.groupId && this.database.get("archive-group", batch.groupId) ? { groupId: batch.groupId } : {}),
      rows
    });
  }
  remove(id: string) {
    return this.serial(() => {
      const batch = this.get(id);
      if (!batch) return false;
      if (batch.ownerProfileId && this.database.get("tiktok-profile-job", batch.ownerProfileId))
        throw new ArchiveTaskError(
          "ARCHIVE_IMPORT_OWNED",
          "该批次属于主页任务，请使用“清理所属主页任务记录”一次清理关联记录；作品和媒体均保留",
          409
        );
      if (active(batch)) throw new ArchiveTaskError("ARCHIVE_IMPORT_BUSY", "请先停止并等待当前任务结束", 409);
      this.database.remove(kind, id);
      this.batches.delete(id);
      return true;
    });
  }
  /** Parent and owned batch metadata commit together; archives and running tasks are never removed here. */
  removeOwned(profileId: string, removeParent: () => void) {
    return this.serial(() => {
      const owned = [...this.batches.values()].filter((batch) => batch.ownerProfileId === profileId);
      if (owned.some(active))
        throw new ArchiveTaskError("ARCHIVE_IMPORT_BUSY", "所属批次仍在执行，请先停止主页任务并等待当前作品结束", 409);
      this.database.transaction(() => {
        for (const batch of owned) this.database.remove(kind, batch.id);
        removeParent();
      });
      for (const batch of owned) this.batches.delete(batch.id);
    });
  }
  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.queue;
  }
  recoverInterrupted() {
    for (const stored of this.batches.values()) {
      if (!active(stored)) continue;
      const batch = structuredClone(stored);
      for (const row of batch.rows) {
        if (!["waiting", "running"].includes(row.status)) continue;
        this.applyTask(row, row.taskId ? this.tasks.get(row.taskId) : undefined);
        if (["waiting", "running"].includes(row.status)) {
          row.status = "failed";
          row.errorCode = "ARCHIVE_INTERRUPTED";
          row.message = "程序退出，未完成的项目需手动重试";
        }
      }
      batch.status = batch.rows.some((row) => row.errorCode === "ARCHIVE_INTERRUPTED")
        ? "interrupted"
        : batch.status === "stopping"
          ? "cancelled"
          : "completed";
      this.save(batch);
    }
  }
  /** Exposed for deterministic scheduler tests; the application uses the owned timer. */
  tick() {
    return this.serial(() => this.advance());
  }
  private async advance() {
    if (this.stopped) return;
    const current = [...this.batches.values()].find(active);
    if (!current) return;
    const batch = structuredClone(current);
    const child = batch.rows.find((row) => row.taskId && ["waiting", "running"].includes(row.status));
    if (child) {
      this.applyTask(child, this.tasks.get(child.taskId!));
      if (["waiting", "running"].includes(child.status)) {
        if (JSON.stringify(batch) !== JSON.stringify(current)) this.save(batch);
        return;
      }
    }
    this.finish(batch);
    const row =
      batch.status === "running" ? batch.rows.find((entry) => entry.status === "waiting" && !entry.taskId) : undefined;
    if (row && this.now() >= this.nextAdmission) {
      const preview = await this.preview(batch.sourceName, batch.sheetName, [
        { rowNumber: row.rowNumber, inputUrl: row.inputUrl, inputPlatform: row.inputPlatform }
      ]);
      if (this.stopped) return;
      const check = preview.rows[0]!;
      if (batch.existing === "refresh" && row.archiveId && row.archiveId !== check.archiveId) {
        row.status = "cancelled";
        row.message = "原归档已删除或被替换，刷新已取消";
        row.errorCode = "ARCHIVE_CANCELLED";
        row.archiveId = undefined;
      } else if (check.status === "invalid" || (check.status === "existing" && batch.existing === "skip")) {
        Object.assign(row, check, { status: check.status === "existing" ? "skipped" : "invalid" });
      } else {
        try {
          this.tasks.createImport(
            check.url!,
            check.platform!,
            batch.existing === "skip",
            (task) => {
              row.taskId = task.id;
              row.status = "waiting";
              row.message = "已进入归档队列";
              // The pipeline cannot start until its batch ownership is durably recorded.
              this.save(batch);
            },
            batch.existing === "refresh" ? (row.archiveId ?? check.archiveId) : undefined
          );
          this.nextAdmission = this.now() + (this.options.intervalMs ?? 7000);
        } catch (error) {
          if (error instanceof ArchiveTaskError && ["ARCHIVE_QUEUE_FULL", "ARCHIVE_TASK_BUSY"].includes(error.code))
            row.message = "等待已有归档任务释放队列";
          else if (error instanceof ArchiveTaskError) {
            row.status = "failed";
            row.errorCode = error.code;
            row.message = error.message;
          } else throw error;
        }
      }
    }
    this.finish(batch);
    this.save(batch);
  }
  private applyTask(row: ArchiveImportRow, task: ContentArchiveTask | undefined) {
    if (!task) {
      if (row.taskId) {
        row.status = "failed";
        row.message = "关联任务已不可用，请手动重试";
        row.errorCode = "ARCHIVE_TASK_MISSING";
      }
      return;
    }
    row.progress = task.progress;
    row.archiveId = task.archiveId;
    row.message = task.error ?? task.message;
    row.errorCode = task.errorCode;
    row.status =
      task.status === "completed"
        ? task.skipped
          ? "skipped"
          : "completed"
        : task.status === "failed"
          ? task.errorCode === "ARCHIVE_CANCELLED"
            ? "cancelled"
            : "failed"
          : task.status === "running"
            ? "running"
            : "waiting";
  }
  private finish(batch: ArchiveImportBatch) {
    if (active(batch) && !batch.rows.some((row) => ["waiting", "running"].includes(row.status)))
      batch.status = batch.status === "stopping" ? "cancelled" : "completed";
  }
  private save(batch: ArchiveImportBatch, persistOwner?: (batch: ArchiveImportBatch) => void) {
    batch.updatedAt = this.timestamp();
    if (!Value.Check(ArchiveImportBatchSchema, batch)) throw new Error("ARCHIVE_IMPORT_RECORD_INVALID");
    this.database.transaction(() => {
      persistOwner?.(batch);
      const previous = this.batches.get(batch.id);
      if (batch.groupId) {
        const completed = batch.rows
          .filter(
            (row) =>
              row.status === "completed" &&
              row.archiveId &&
              previous?.rows.find((old) => old.rowNumber === row.rowNumber)?.status !== "completed"
          )
          .map((row) => row.archiveId!);
        new ArchiveGroupStore(this.database).assignImported(batch.groupId, completed);
      }
      this.database.upsert({
        id: batch.id,
        kind,
        status: batch.status,
        payload: batch,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt
      });
    });
    this.batches.set(batch.id, structuredClone(batch));
  }
  private now() {
    return this.options.now?.() ?? Date.now();
  }
  private timestamp() {
    return new Date(this.now()).toISOString();
  }
  private assertAvailable() {
    if (this.stopped) throw new ArchiveTaskError("ARCHIVE_SERVICE_STOPPED", "归档服务已关闭", 503);
  }
  private serial<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private schedule() {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick()
        .catch(() => {
          this.stopped = true;
          this.options.onError?.();
        })
        .finally(() => this.schedule());
    }, this.options.pollMs ?? 1000);
    this.timer.unref();
  }
}
