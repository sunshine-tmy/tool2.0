/** Durable parent coordination. Child archives remain owned by the existing bounded import pipeline. */
import { nanoid } from "nanoid";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  normalizeTikTokProfileLink,
  TikTokProfileJobSchema,
  TikTokProfileWorkSchema,
  TIKTOK_PROFILE_MAX_WORKS,
  type TikTokProfileJob,
  type TikTokProfilePage,
  type TikTokProfileStart
} from "@toolbox/shared/archive";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import type { ArchiveImportService } from "../batch/service";
import { ArchiveGroupStore } from "../core/groups";
import { ArchiveTaskError } from "../core/provider";
import type { TikTokProfileReader, ProfileDiscovery } from "../providers/tiktok/profile-reader";
import {
  profileSuccessContext,
  SuccessMatchSchema,
  type ProfileSuccessContext,
  type SuccessMatch
} from "./success-matches";

const kind = "tiktok-profile-job";
const id = Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" });
const RecordSchema = Type.Object(
  {
    version: Type.Literal(1),
    meta: TikTokProfileJobSchema,
    works: Type.Array(TikTokProfileWorkSchema, { maxItems: TIKTOK_PROFILE_MAX_WORKS }),
    batchIds: Type.Array(id, { maxItems: 1000, uniqueItems: true }),
    selectedIds: Type.Optional(
      Type.Array(TikTokProfileWorkSchema.properties.id, {
        minItems: 1,
        maxItems: TIKTOK_PROFILE_MAX_WORKS,
        uniqueItems: true
      })
    ),
    nextIndex: Type.Integer({ minimum: 0, maximum: TIKTOK_PROFILE_MAX_WORKS }),
    currentBatchId: Type.Optional(id),
    successMatches: Type.Optional(Type.Array(SuccessMatchSchema, { maxItems: TIKTOK_PROFILE_MAX_WORKS }))
  },
  { additionalProperties: false }
);
type ProfileRecord = import("@sinclair/typebox").Static<typeof RecordSchema>;
const active = (phase: TikTokProfileJob["phase"]) =>
  ["discovering", "waiting-user", "archiving", "stopping"].includes(phase);
type Outcome = NonNullable<TikTokProfilePage["items"][number]["outcome"]>;

export class TikTokProfileService {
  private records = new Map<string, ProfileRecord>();
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private successRevisions = new Map<string, string>();
  private discovery?: { id: string; controller: AbortController; done: Promise<void> };
  constructor(
    private readonly database: ToolboxDatabase,
    private readonly imports: Pick<ArchiveImportService, "create" | "get" | "cancel" | "removeOwned">,
    private readonly reader: Pick<TikTokProfileReader, "read">,
    private readonly options: { pollMs?: number; onError?: () => void } = {}
  ) {
    for (const entity of database.list(kind)) {
      const payload = entity.payload;
      if (
        !Value.Check(RecordSchema, payload) ||
        payload.meta.id !== entity.id ||
        payload.meta.discoveredCount !== payload.works.length ||
        new Set(payload.works.map((work) => work.id)).size !== payload.works.length ||
        normalizeTikTokProfileLink(payload.meta.url)?.username !== payload.meta.username ||
        payload.nextIndex > (payload.selectedIds?.length ?? 0) ||
        payload.works.some(
          (work) =>
            !new RegExp(
              `^https://www\\.tiktok\\.com/@${payload.meta.username.replaceAll(".", "\\.")}/(?:video|photo)/${work.id}$`
            ).test(work.url)
        )
      )
        throw new Error("TIKTOK_PROFILE_RECORD_INVALID");
      this.records.set(entity.id, structuredClone(payload));
    }
  }
  initialize() {
    for (const record of this.records.values())
      if (active(record.meta.phase)) {
        const next = structuredClone(record);
        next.meta.phase = "interrupted";
        next.meta.message = "上次任务随服务退出中断；已保留列表及归档进度，请手动继续";
        next.meta.errorCode = "TIKTOK_PROFILE_INTERRUPTED";
        this.save(next);
      }
    this.schedule();
  }
  list() {
    const context = profileSuccessContext(this.database);
    return [...this.records.values()]
      .sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt))
      .map((record) => this.project(record, context).meta);
  }
  get(id: string) {
    const record = this.records.get(id);
    return record ? this.project(record).meta : undefined;
  }
  page(id: string, page = 1): TikTokProfilePage | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    const { outcomes } = this.project(record),
      start = (page - 1) * 50;
    return {
      items: record.works.slice(start, start + 50).map((work) => ({
        ...structuredClone(work),
        ...(outcomes.has(work.id) ? { outcome: outcomes.get(work.id) } : {})
      })),
      page,
      total: record.works.length,
      pageCount: Math.max(1, Math.ceil(record.works.length / 50))
    };
  }
  results(id: string) {
    const record = this.required(id),
      { outcomes } = this.project(record);
    return record.works.map((work) => ({ ...structuredClone(work), outcome: outcomes.get(work.id) }));
  }
  create(url: string) {
    return this.serial(() => {
      this.assertIdle();
      const profile = normalizeTikTokProfileLink(url);
      if (!profile)
        throw new ArchiveTaskError(
          "TIKTOK_PROFILE_URL_INVALID",
          "请输入 TikTok 用户主页链接，例如 https://www.tiktok.com/@用户名"
        );
      if (this.records.size >= 20)
        throw new ArchiveTaskError(
          "TIKTOK_PROFILE_HISTORY_FULL",
          "最多保留 20 个主页任务，请先手动删除旧任务记录（作品保留）",
          409
        );
      const now = new Date().toISOString(),
        record: ProfileRecord = {
          version: 1,
          meta: {
            id: nanoid(12),
            ...profile,
            phase: "discovering",
            complete: false,
            discoveredCount: 0,
            message: "正在打开本机独立浏览器；本次只发现链接，尚未开始归档",
            createdAt: now,
            updatedAt: now,
            archivedCount: 0,
            failedCount: 0,
            skippedCount: 0,
            pendingCount: 0,
            batchCount: 0
          },
          works: [],
          batchIds: [],
          nextIndex: 0
        };
      this.save(record);
      this.launchDiscovery(record.meta.id);
      return this.get(record.meta.id)!;
    });
  }
  discover(id: string) {
    return this.serial(() => {
      this.assertIdle();
      const record = this.required(id);
      record.meta.phase = "discovering";
      record.meta.complete = false;
      record.meta.errorCode = undefined;
      record.meta.message = "正在重新读取主页，已发现链接保留并去重；不会自动开始归档";
      record.selectedIds = undefined;
      record.nextIndex = 0;
      record.currentBatchId = undefined;
      this.save(record);
      this.launchDiscovery(id);
      return this.get(id)!;
    });
  }
  start(id: string, input: TikTokProfileStart) {
    return this.serial(() => {
      this.assertIdle();
      const record = this.required(id);
      if (!record.meta.complete && !input.allowPartial)
        throw new ArchiveTaskError(
          "TIKTOK_PROFILE_LIST_PARTIAL",
          "列表尚未确认完整，请明确确认只归档当前已发现的作品",
          409
        );
      const ids = input.selection === "all" ? record.works.map((work) => work.id) : input.itemIds;
      if (
        !ids?.length ||
        (input.selection === "all" && input.itemIds !== undefined) ||
        ids.some((id) => !record.works.some((work) => work.id === id))
      )
        throw new ArchiveTaskError("TIKTOK_PROFILE_SELECTION_INVALID", "请选择本次主页列表中的作品");
      if (input.groupId) new ArchiveGroupStore(this.database).assertExists(input.groupId);
      record.selectedIds = [...ids];
      record.successMatches = record.successMatches?.filter((match) => !ids.includes(match.workId));
      record.nextIndex = 0;
      record.currentBatchId = undefined;
      record.meta.phase = "archiving";
      record.meta.existing = input.existing;
      record.meta.groupId = input.groupId;
      record.meta.errorCode = undefined;
      record.meta.message = "已确认归档，按每批最多 100 条顺序提交；可关闭此弹窗";
      this.save(record);
      return this.get(id)!;
    });
  }
  async retry(id: string, itemId?: string) {
    if (itemId) {
      const queued = await this.serial(() => {
        const record = this.required(id);
        if (
          !record.works.some((work) => work.id === itemId) ||
          this.project(record).outcomes.get(itemId)?.status !== "failed"
        )
          throw new ArchiveTaskError("TIKTOK_PROFILE_NO_RETRY", "请选择当前列表中归档失败的作品", 409);
        if (record.meta.phase !== "archiving") return undefined;
        if (this.stopped) throw new ArchiveTaskError("TIKTOK_PROFILE_BUSY", "服务正在退出", 409);
        const index = record.selectedIds?.indexOf(itemId) ?? -1;
        record.selectedIds = (record.selectedIds ?? []).filter((id) => id !== itemId);
        if (index >= 0 && index < record.nextIndex) record.nextIndex--;
        record.selectedIds.push(itemId);
        record.successMatches = record.successMatches?.filter((match) => match.workId !== itemId);
        record.meta.message = "失败作品已加入后续重试队列；当前批次继续执行";
        this.save(record);
        return this.get(id)!;
      });
      if (queued) return queued;
    }
    const record = this.required(id);
    if (active(record.meta.phase)) throw new ArchiveTaskError("TIKTOK_PROFILE_BUSY", "请先停止并等待当前任务结束", 409);
    const outcomes = this.project(record).outcomes;
    const itemIds = record.works
      .filter(
        (work) =>
          (!itemId || work.id === itemId) &&
          ["failed", "waiting", "running"].includes(outcomes.get(work.id)?.status ?? "")
      )
      .map((work) => work.id);
    if (!itemIds.length) throw new ArchiveTaskError("TIKTOK_PROFILE_NO_RETRY", "没有失败或中断后未完成的作品", 409);
    return this.start(id, {
      selection: "selected",
      itemIds,
      existing: record.meta.existing ?? "skip",
      allowPartial: true,
      ...(record.meta.groupId && this.database.get("archive-group", record.meta.groupId)
        ? { groupId: record.meta.groupId }
        : {})
    });
  }
  cancel(id: string) {
    return this.serial(async () => {
      const record = this.required(id);
      if (!active(record.meta.phase)) return this.get(id)!;
      record.meta.phase = "stopping";
      record.meta.message = "已停止后续操作，正在等待本任务拥有的浏览器或当前作品安全结束";
      this.save(record);
      if (this.discovery?.id === id)
        this.discovery.controller.abort(new DOMException("用户停止主页读取", "AbortError"));
      else {
        if (record.currentBatchId) await this.imports.cancel(record.currentBatchId);
        await this.advance();
      }
      return this.get(id)!;
    });
  }
  remove(id: string) {
    return this.serial(async () => {
      const record = this.required(id);
      if (active(record.meta.phase))
        throw new ArchiveTaskError("TIKTOK_PROFILE_BUSY", "请先停止并等待当前任务结束", 409);
      await this.imports.removeOwned(id, () => this.database.remove(kind, id));
      this.records.delete(id);
      this.successRevisions.delete(id);
    });
  }
  tick() {
    return this.serial(async () => {
      const context = profileSuccessContext(this.database);
      const revisionFor = (record: ProfileRecord) =>
        JSON.stringify([
          context.revision,
          record.meta.updatedAt,
          record.currentBatchId ? this.imports.get(record.currentBatchId)?.updatedAt : undefined
        ]);
      for (const record of this.records.values()) {
        if (revisionFor(record) === this.successRevisions.get(record.meta.id)) continue;
        const { matches } = this.project(record, context);
        if (JSON.stringify(record.successMatches ?? []) !== JSON.stringify(matches))
          this.save({ ...structuredClone(record), successMatches: matches });
        this.successRevisions.set(record.meta.id, revisionFor(this.records.get(record.meta.id)!));
      }
      await this.advance();
    });
  }
  async close() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.discovery?.controller.abort(new DOMException("服务退出", "AbortError"));
    await this.discovery?.done.catch(() => undefined);
    await this.queue;
    for (const record of this.records.values())
      if (active(record.meta.phase)) {
        const next = structuredClone(record);
        next.meta.phase = "interrupted";
        next.meta.message = "服务已退出，进度保留；重启后需手动继续";
        this.save(next);
      }
  }
  private launchDiscovery(id: string) {
    const controller = new AbortController();
    const persist = (snapshot: ProfileDiscovery, finished: boolean) =>
      this.serial(() => {
        const record = this.required(id);
        record.works = structuredClone(snapshot.works);
        this.successRevisions.delete(id);
        record.meta.discoveredCount = record.works.length;
        record.meta.declaredCount = snapshot.declaredCount;
        record.meta.complete = snapshot.complete;
        record.meta.message = snapshot.message;
        if (finished) record.meta.phase = this.stopped ? "interrupted" : "ready";
        else if (record.meta.phase !== "stopping")
          record.meta.phase = snapshot.waitingUser ? "waiting-user" : "discovering";
        this.save(record);
      });
    const done = Promise.resolve()
      .then(() =>
        this.reader.read(
          this.required(id).meta.url,
          controller.signal,
          (snapshot) => {
            void persist(snapshot, false).catch((error) => controller.abort(error));
          },
          this.required(id).works
        )
      )
      .then((snapshot) => persist(snapshot, true))
      .catch((error: unknown) =>
        this.serial(() => {
          const record = this.required(id);
          record.meta.complete = false;
          record.meta.phase = this.stopped
            ? "interrupted"
            : record.works.length
              ? "ready"
              : controller.signal.aborted
                ? "cancelled"
                : "failed";
          record.meta.errorCode =
            error instanceof ArchiveTaskError
              ? error.code
              : controller.signal.aborted
                ? "TIKTOK_PROFILE_STOPPED"
                : "TIKTOK_PROFILE_READ_FAILED";
          record.meta.message =
            error instanceof ArchiveTaskError
              ? error.message
              : controller.signal.aborted
                ? "读取已停止，已保留发现进度；列表未确认完整"
                : "主页读取失败或超时，已保留发现进度；请检查独立浏览器、网络及访问限制后继续";
          this.save(record);
        })
      )
      .catch(() => this.options.onError?.())
      .finally(() => {
        if (this.discovery?.controller === controller) this.discovery = undefined;
      });
    this.discovery = { id, controller, done };
  }
  private async advance() {
    if (this.stopped) return;
    const value = [...this.records.values()].find(
      (record) => ["archiving", "stopping"].includes(record.meta.phase) && record.meta.id !== this.discovery?.id
    );
    if (!value) return;
    let record = structuredClone(value);
    if (record.currentBatchId) {
      const child = this.imports.get(record.currentBatchId);
      if (!child || child.ownerProfileId !== record.meta.id) {
        record.meta.phase = "interrupted";
        record.meta.message = "所属批次记录不可用，已停止后续归档";
        this.save(record);
        return;
      }
      if (["running", "stopping"].includes(child.status)) {
        this.save(record);
        return;
      }
      if (child.status === "cancelled" || child.status === "interrupted") record.meta.phase = "cancelled";
      record.currentBatchId = undefined;
    }
    if (record.meta.phase === "stopping") record.meta.phase = "cancelled";
    if (record.meta.phase === "cancelled") {
      record.meta.message = "后续归档已停止，已保存作品保留";
      this.save(record);
      return;
    }
    if (record.nextIndex >= (record.selectedIds?.length ?? 0)) {
      record.meta.phase = "completed";
      record.meta.message = "本次所选作品已处理完毕；失败项可手动重试";
      this.save(record);
      return;
    }
    if (record.batchIds.length >= 1000) {
      record.meta.phase = "interrupted";
      record.meta.message = "本主页任务达到批次数上限，请新建主页任务继续";
      this.save(record);
      return;
    }
    const ids = record.selectedIds!.slice(record.nextIndex, record.nextIndex + 100),
      works = new Map(record.works.map((work) => [work.id, work]));
    try {
      const child = await this.imports.create(
        {
          sourceName: `TikTok @${record.meta.username} · 第 ${record.batchIds.length + 1} 批`,
          existing: record.meta.existing ?? "skip",
          ...(record.meta.groupId && this.database.get("archive-group", record.meta.groupId)
            ? { groupId: record.meta.groupId }
            : {}),
          rows: ids.map((id, index) => ({
            rowNumber: record.nextIndex + index + 1,
            inputUrl: works.get(id)!.url,
            inputPlatform: "tiktok"
          }))
        },
        {
          profileId: record.meta.id,
          part: record.batchIds.length,
          persist: (batch) => {
            if (this.stopped)
              throw new ArchiveTaskError("TIKTOK_PROFILE_STOPPED", "服务正在退出，未开始新的主页归档批次", 503);
            const next = structuredClone(record);
            next.currentBatchId = batch.id;
            if (!next.batchIds.includes(batch.id)) {
              next.batchIds.push(batch.id);
              next.nextIndex += ids.length;
            }
            next.meta.message = `正在执行第 ${next.batchIds.length} 批，最多 100 条；其余作品等待当前批次结束`;
            this.write(next);
          }
        }
      );
      const stored = this.database.get(kind, record.meta.id)?.payload;
      if (!Value.Check(RecordSchema, stored) || stored.currentBatchId !== child.id)
        throw new Error("TIKTOK_PROFILE_OWNERSHIP_FAILED");
      record = structuredClone(stored);
      this.records.set(record.meta.id, record);
    } catch (error) {
      if (error instanceof ArchiveTaskError && error.code === "ARCHIVE_IMPORT_BUSY") {
        record.meta.message = "等待其他表格归档批次结束，不接管他人的任务";
        this.save(record);
      } else if (error instanceof ArchiveTaskError) {
        record.meta.phase = "interrupted";
        record.meta.errorCode = error.code;
        record.meta.message = error.message;
        this.save(record);
      } else throw error;
    }
  }
  private project(record: ProfileRecord, context: ProfileSuccessContext = profileSuccessContext(this.database)) {
    const outcomes = new Map<string, Outcome>();
    const attempts = new Map<string, { key: string; time: string }>();
    for (const id of record.batchIds) {
      const batch = this.imports.get(id);
      if (!batch || batch.ownerProfileId !== record.meta.id) continue;
      for (const row of batch.rows) {
        const work = /\/(?:video|photo)\/(\d{5,24})\/?$/.exec(new URL(row.inputUrl).pathname)?.[1];
        if (work) {
          attempts.set(work, {
            key: row.taskId ?? `${batch.id}:${row.rowNumber}`,
            time: (row.taskId && context.taskTimes.get(row.taskId)) || batch.updatedAt
          });
          const { status, progress, message, errorCode, archiveId } = row;
          outcomes.set(work, {
            status,
            progress,
            message,
            ...(errorCode ? { errorCode } : {}),
            ...(archiveId ? { archiveId } : {})
          });
        }
      }
    }
    for (const id of record.selectedIds?.slice(record.nextIndex) ?? [])
      outcomes.set(id, {
        status: record.meta.phase === "cancelled" ? "cancelled" : "waiting",
        progress: 0,
        message: record.meta.phase === "cancelled" ? "已停止后续归档" : "等待主页批次调度（重启后需手动继续）"
      });
    const matches: SuccessMatch[] = [];
    const savedMatches = new Map(record.successMatches?.map((match) => [match.workId, match]));
    for (const work of record.works) {
      const status = outcomes.get(work.id)?.status;
      if (status && status !== "failed" && status !== "cancelled") continue;
      const attempt = attempts.get(work.id) ?? { key: "unselected", time: record.meta.createdAt };
      const saved = savedMatches.get(work.id);
      const success = context.successes.get(work.id);
      const match =
        saved?.attemptKey === attempt.key && context.identities.get(saved.archiveId) === work.id
          ? saved
          : success && Date.parse(success.completedAt) > Date.parse(attempt.time)
            ? { workId: work.id, ...success, attemptKey: attempt.key }
            : undefined;
      if (!match) continue;
      matches.push(match);
      outcomes.set(work.id, {
        status: "completed",
        progress: 100,
        message: "已匹配单条成功归档",
        archiveId: match.archiveId
      });
    }
    const rows = [...outcomes.values()],
      meta = structuredClone(record.meta);
    meta.archivedCount = rows.filter((row) => row.status === "completed").length;
    meta.failedCount = rows.filter((row) => row.status === "failed").length;
    meta.skippedCount = rows.filter((row) =>
      ["skipped", "existing", "duplicate", "invalid", "cancelled"].includes(row.status)
    ).length;
    meta.pendingCount = rows.filter((row) => ["waiting", "running"].includes(row.status)).length;
    meta.batchCount = record.batchIds.length;
    return { meta, outcomes, matches };
  }
  private required(id: string) {
    const record = this.records.get(id);
    if (!record) throw new ArchiveTaskError("TIKTOK_PROFILE_NOT_FOUND", "主页任务不存在", 404);
    return structuredClone(record);
  }
  private assertIdle() {
    if (this.stopped || [...this.records.values()].some((record) => active(record.meta.phase)))
      throw new ArchiveTaskError("TIKTOK_PROFILE_BUSY", "已有主页任务正在执行，请先停止并等待完成", 409);
  }
  private write(record: ProfileRecord) {
    record.meta.updatedAt = new Date().toISOString();
    record.meta.batchCount = record.batchIds.length;
    if (!Value.Check(RecordSchema, record)) throw new Error("TIKTOK_PROFILE_RECORD_INVALID");
    this.database.upsert({
      id: record.meta.id,
      kind,
      status: record.meta.phase,
      payload: record,
      createdAt: record.meta.createdAt,
      updatedAt: record.meta.updatedAt
    });
  }
  private save(record: ProfileRecord) {
    this.write(record);
    this.records.set(record.meta.id, structuredClone(record));
  }
  private serial<T>(run: () => T | Promise<T>) {
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
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
