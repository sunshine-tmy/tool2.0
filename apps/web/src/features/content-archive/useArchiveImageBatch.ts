/** 只编排现有持久化编辑任务，一次提交一条；不维护第二套服务端渲染队列。 */
import { computed, onScopeDispose, ref } from "vue";
import type { ArchiveVideoEditJob, ContentArchiveItem } from "@toolbox/shared/archive";
import { contentArchiveApi } from "./content-api";
import { videoEditApi } from "./video-edit-api";
import { imageBatchInput, imageBatchTarget, type ImageBatchRecipe } from "./image-batch-recipe";
import { ApiRequestError, formatApiError } from "../../shared/http/http";

type Row = {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "stopped" | "uncertain" | "skipped";
  progress: number;
  message: string;
  jobId?: string;
  mediaId?: string;
  durationSeconds?: number;
  preview?: {
    source: "effect" | "saved";
    status: "running" | "completed" | "failed" | "stopped";
    progress: number;
    message: string;
    jobId?: string;
    url?: string;
  };
};
const active = (job: ArchiveVideoEditJob) => job.status === "pending" || job.status === "running";
export function useArchiveImageBatch(updated: (item: ContentArchiveItem) => void, finished: () => void) {
  const rows = ref<Row[]>([]),
    running = ref(false),
    paused = ref(false),
    stopping = ref(false),
    previewing = ref(false),
    previewRowId = ref<string>(),
    cancellingPreview = ref(false);
  const previewPending = computed(() => rows.value.some((row) => row.preview?.status === "running"));
  const processed = computed(
    () => rows.value.filter((row) => ["completed", "failed", "stopped", "skipped"].includes(row.status)).length
  );
  let controller = new AbortController(),
    disposed = false,
    recipe: ImageBatchRecipe | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function reset(items: Array<{ id: string; title: string }>) {
    if (running.value || previewing.value || previewPending.value || cancellingPreview.value) return;
    recipe = undefined;
    paused.value = false;
    rows.value = [...new Map(items.map((item) => [item.id, item])).values()].map((item) => ({
      ...item,
      status: "pending",
      progress: 0,
      message: "等待开始"
    }));
  }
  const delay = () =>
    new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("页面已离开", "AbortError"));
      };
      timer = setTimeout(() => {
        controller.signal.removeEventListener("abort", abort);
        resolve();
      }, 1000);
      controller.signal.addEventListener("abort", abort, { once: true });
      if (controller.signal.aborted) abort();
    });
  async function poll(row: Row) {
    while (!controller.signal.aborted) {
      let job: ArchiveVideoEditJob;
      try {
        job = await videoEditApi.get(row.jobId!, controller.signal);
      } catch (error) {
        if (disposed) return false;
        row.message = `${formatApiError(error)}；已暂停后续提交，请继续读取状态，不会重复生成`;
        paused.value = true;
        return false;
      }
      if (disposed) return false;
      row.progress = job.progress;
      row.message = job.message;
      if (!active(job)) {
        row.status = job.status === "completed" ? "completed" : job.status === "cancelled" ? "stopped" : "failed";
        if (job.status === "completed") {
          row.mediaId = job.resultMediaId ?? row.mediaId;
          try {
            const item = await contentArchiveApi.detail(row.id, controller.signal);
            if (!disposed) {
              const media = item.media.find((entry) => entry.id === row.mediaId && entry.kind === "video");
              if (media) {
                row.durationSeconds = (media.durationMs ?? 0) / 1000;
                row.preview = {
                  source: "saved",
                  status: "completed",
                  progress: 100,
                  message: "已保存成品",
                  url: media.previewUrl
                };
              }
              updated(item);
            }
          } catch {
            row.message = "已保存成功，列表可手动刷新";
          }
        }
        return true;
      }
      await delay();
    }
    return false;
  }
  async function prepare(row: Row, selected: ImageBatchRecipe, mode: "save" | "preview") {
    const item = await contentArchiveApi.detail(row.id, controller.signal);
    controller.signal.throwIfAborted();
    const target = imageBatchTarget(item);
    row.mediaId = target.media.id;
    const prepared = imageBatchInput(item, selected, undefined, mode);
    row.durationSeconds = prepared.duration;
    const previous = await videoEditApi.list(row.id, row.mediaId, controller.signal);
    controller.signal.throwIfAborted();
    if (previous.some(active)) throw new Error("该作品已有编辑任务，请等待完成后重试");
    const watermark = selected.watermark;
    // 每次提交都创建当前作品的独立草稿；预览和保存共用配方、版本及时间校验。
    const draft = !watermark
      ? undefined
      : watermark.libraryId
        ? await videoEditApi.selectLibraryWatermark(row.id, row.mediaId, watermark.libraryId, controller.signal)
        : await videoEditApi.uploadWatermark(row.id, row.mediaId, watermark.file!, controller.signal);
    controller.signal.throwIfAborted();
    return imageBatchInput(item, selected, draft?.id, mode);
  }
  async function process(row: Row) {
    row.status = "running";
    row.message = "读取最新图集与编辑版本";
    if (row.jobId) return poll(row);
    try {
      const { mediaId, input } = await prepare(row, recipe!, "save");
      try {
        const job = await videoEditApi.create(row.id, mediaId, input, controller.signal);
        if (disposed) return false;
        row.jobId = job.id;
      } catch (error) {
        if (disposed) return false;
        if (
          error instanceof ApiRequestError &&
          error.status &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408
        ) {
          row.status = "failed";
          row.message = formatApiError(error);
          return true;
        }
        // 写请求可能已经被服务端接受；保留为待核对，禁止盲目重发。
        row.status = "uncertain";
        row.message = `${formatApiError(error)}；提交结果尚未确认。请查看归档后跳过此项，未自动重复提交`;
        paused.value = true;
        return false;
      }
      if (disposed) return false;
      return poll(row);
    } catch (error) {
      if (disposed) return false;
      row.status = "failed";
      row.message = formatApiError(error, error instanceof Error ? error.message : "处理失败，原图与原成品保留");
      return true;
    }
  }
  function snapshot(selected: ImageBatchRecipe): ImageBatchRecipe {
    return {
      ...selected,
      ...(selected.watermark
        ? { watermark: { ...selected.watermark, settings: JSON.parse(JSON.stringify(selected.watermark.settings)) } }
        : {}),
      ...(selected.music ? { music: { ...selected.music } } : {})
    };
  }
  function invalidatePreviews() {
    if (previewing.value || previewPending.value || running.value) return;
    for (const row of rows.value) if (row.preview?.source === "effect") row.preview = undefined;
  }
  function applyPreviewJob(row: Row, job: ArchiveVideoEditJob) {
    const preview = row.preview!;
    preview.progress = job.progress;
    preview.message = job.message;
    preview.status = active(job)
      ? "running"
      : job.status === "completed"
        ? "completed"
        : job.status === "cancelled"
          ? "stopped"
          : "failed";
    if (job.status === "completed") {
      if (!job.previewUrl) throw new Error("预览已结束但未返回视频地址，请重新生成预览");
      preview.url = job.previewUrl;
    }
  }
  async function preview(id: string, selected?: ImageBatchRecipe) {
    const row = rows.value.find((entry) => entry.id === id);
    if (!row || disposed || row.preview?.status === "completed") return;
    if (running.value || paused.value || previewing.value || cancellingPreview.value) return;
    if (previewPending.value && row.preview?.status !== "running") return;
    previewing.value = true;
    previewRowId.value = id;
    // 已知预览任务读取失败时保留 jobId，继续同步原任务，不重新提交。
    const pending = row.preview?.status === "running" ? row.preview : undefined;
    controller = new AbortController();
    const signal = controller.signal;
    try {
      if (row.status === "completed") {
        const item = await contentArchiveApi.detail(row.id, signal);
        signal.throwIfAborted();
        const target = imageBatchTarget(item);
        if (!target.existing) throw new Error("未找到已保存视频，请在归档详情中核对");
        row.durationSeconds = (target.media.durationMs ?? 0) / 1000;
        row.preview = {
          source: "saved",
          status: "completed",
          progress: 100,
          message: "已保存成品",
          url: target.media.previewUrl
        };
        return;
      }
      if (!pending) {
        const currentRecipe = selected ?? recipe;
        if (!currentRecipe) throw new Error("请先选择本次处理的配乐或水印");
        row.preview = { source: "effect", status: "running", progress: 0, message: "正在准备完整效果预览，尚未保存" };
        const { mediaId, input } = await prepare(row, snapshot(currentRecipe), "preview");
        const job = await videoEditApi.create(row.id, mediaId, input, signal);
        signal.throwIfAborted();
        row.preview.jobId = job.id;
      }
      while (!signal.aborted && row.preview?.status === "running") {
        const job = await videoEditApi.get(row.preview.jobId!, signal);
        signal.throwIfAborted();
        applyPreviewJob(row, job);
        if (!active(job)) break;
        await delay();
      }
    } catch (error) {
      if (disposed || signal.aborted) return;
      const previous = row.preview;
      row.preview = {
        source: row.status === "completed" ? "saved" : "effect",
        status: previous?.jobId && previous.status === "running" ? "running" : "failed",
        progress: previous?.progress ?? 0,
        jobId: previous?.jobId,
        message: `${formatApiError(error, error instanceof Error ? error.message : "预览失败")}；${previous?.jobId ? "点击预览继续读取该任务" : "可重新预览；重试前会检查现有编辑任务"}`
      };
    } finally {
      if (!disposed) previewing.value = false;
    }
  }
  async function stopPreview() {
    const row = rows.value.find((entry) => entry.id === previewRowId.value);
    if (!row?.preview?.jobId || row.preview.status !== "running" || cancellingPreview.value) return;
    cancellingPreview.value = true;
    try {
      const result = await videoEditApi.cancel(row.preview.jobId, controller.signal);
      if (disposed) return;
      applyPreviewJob(row, result);
      if (!active(result)) controller.abort();
    } catch (error) {
      if (!disposed) row.preview.message = formatApiError(error);
    } finally {
      if (!disposed) cancellingPreview.value = false;
    }
  }
  async function run(nextRecipe?: ImageBatchRecipe, retry = false) {
    if (
      running.value ||
      previewing.value ||
      previewPending.value ||
      cancellingPreview.value ||
      disposed ||
      !rows.value.length
    )
      return;
    if (nextRecipe) recipe = snapshot(nextRecipe);
    if (!recipe) return;
    invalidatePreviews();
    running.value = true;
    stopping.value = false;
    paused.value = false;
    controller = new AbortController();
    try {
      if (retry)
        for (const row of rows.value)
          if (["failed", "stopped"].includes(row.status)) {
            row.status = "pending";
            row.progress = 0;
            row.jobId = undefined;
            row.preview = undefined;
          }
      const unresolved = rows.value.find((row) => row.status === "uncertain");
      if (unresolved) {
        paused.value = true;
        return;
      }
      for (const row of rows.value) {
        if (disposed) break;
        if (stopping.value && row.status === "pending") {
          row.status = "stopped";
          row.message = "未提交，可稍后重试";
          continue;
        }
        if (row.status !== "pending" && row.status !== "running") continue;
        if (!(await process(row))) break;
      }
    } catch (error) {
      if (!disposed) {
        paused.value = true;
        const row = rows.value.find((entry) => entry.status === "running");
        if (row) row.message = formatApiError(error, "状态读取中断，请继续同步任务状态");
      }
    } finally {
      if (!disposed) {
        running.value = false;
        finished();
      }
    }
  }
  function stop() {
    stopping.value = true;
  }
  function skipUncertain() {
    if (running.value) return;
    for (const row of rows.value)
      if (row.status === "uncertain") {
        row.status = "skipped";
        row.message = "已跳过待核对项，请在归档详情中检查最终成品；未重新提交";
      }
    paused.value = false;
  }
  onScopeDispose(() => {
    disposed = true;
    controller.abort();
    clearTimeout(timer);
  });
  return {
    rows,
    running,
    paused,
    stopping,
    processed,
    reset,
    run,
    stop,
    skipUncertain,
    preview,
    previewing,
    previewPending,
    previewRowId,
    cancellingPreview,
    stopPreview,
    invalidatePreviews
  };
}
