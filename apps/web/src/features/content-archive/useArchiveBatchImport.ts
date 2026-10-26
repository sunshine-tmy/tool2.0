/** Owns import preview, action requests and visible-dialog polling; closing the dialog never cancels server work. */
import { computed, onScopeDispose, ref, watch } from "vue";
import {
  ARCHIVE_IMPORT_MAX_BYTES,
  type ArchiveImportBatch,
  type ArchiveImportPreview,
  type ArchiveImportSummary
} from "@toolbox/shared/archive";
import { archiveImportApi } from "./content-api";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { ApiRequestError, isApiErrorCancelled } from "../../shared/http/http";

export const importBatchLabels: Record<ArchiveImportBatch["status"], string> = {
  running: "执行中",
  stopping: "停止后续，等待当前项",
  completed: "已结束",
  cancelled: "已停止",
  interrupted: "已中断，需手动重试"
};
export const importBatchActive = (batch: Pick<ArchiveImportBatch, "status">) =>
  batch.status === "running" || batch.status === "stopping";
export function useArchiveBatchImport(reportError: (error: unknown) => void, changed: () => void) {
  const scope = useRequestScope();
  const open = ref(false),
    busy = ref(false),
    loading = ref(false);
  const preview = ref<ArchiveImportPreview>(),
    batch = ref<ArchiveImportBatch>(),
    history = ref<ArchiveImportSummary[]>([]);
  const selectedId = ref<string>(),
    existing = ref<"skip" | "refresh">("skip");
  const groupId = ref<string>();
  let timer: ReturnType<typeof setTimeout> | undefined, readController: AbortController | undefined;
  let generation = 0,
    historyGeneration = 0,
    pollError = false;
  const notified = new Set<string>();
  const rows = computed(() => preview.value?.rows ?? batch.value?.rows ?? []);
  const counts = computed(() => ({
    total: rows.value.length,
    eligible: rows.value.filter(
      (row) => row.status === "ready" || (row.status === "existing" && existing.value === "refresh")
    ).length,
    success: rows.value.filter((row) => row.status === "completed").length,
    failed: rows.value.filter((row) => row.status === "failed").length,
    skipped: rows.value.filter((row) =>
      ["skipped", "duplicate", "invalid", "existing", "cancelled"].includes(row.status)
    ).length,
    pending: rows.value.filter((row) => ["waiting", "running"].includes(row.status)).length
  }));
  function stopRead() {
    generation++;
    readController?.abort();
    clearTimeout(timer);
  }
  function apply(value: ArchiveImportBatch) {
    historyGeneration++;
    batch.value = value;
    const { rows: _rows, ...summary } = value;
    history.value = [summary, ...history.value.filter((entry) => entry.id !== value.id)];
    if (!importBatchActive(value) && !notified.has(value.id)) {
      notified.add(value.id);
      if (value.rows.some((row) => row.status === "completed")) changed();
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (open.value && batch.value && importBatchActive(batch.value) && !scope.aborted)
      timer = setTimeout(() => void loadSelected(true), 1500);
  }
  async function loadSelected(poll = false) {
    const id = selectedId.value;
    if (!id) return;
    stopRead();
    const requestGeneration = generation;
    readController = new AbortController();
    if (!poll) loading.value = true;
    try {
      const value = await archiveImportApi.get(id, AbortSignal.any([scope.signal, readController.signal]));
      if (scope.aborted || !open.value || requestGeneration !== generation) return;
      apply(value);
      pollError = false;
    } catch (error) {
      if (!isApiErrorCancelled(error) && requestGeneration === generation && !scope.aborted && (!poll || !pollError)) {
        reportError(error);
        pollError = true;
      }
    } finally {
      if (requestGeneration === generation) {
        loading.value = false;
        schedule();
      }
    }
  }
  async function refreshHistory() {
    const requestGeneration = ++historyGeneration;
    try {
      const values = await archiveImportApi.list(scope.signal);
      if (!scope.aborted && requestGeneration === historyGeneration) history.value = values;
    } catch (error) {
      if (!scope.aborted && !isApiErrorCancelled(error)) reportError(error);
    }
  }
  async function show() {
    open.value = true;
    await refreshHistory();
    if (scope.aborted || !open.value) return;
    if (!preview.value) {
      selectedId.value = batch.value?.id ?? history.value.find(importBatchActive)?.id ?? history.value[0]?.id;
      await loadSelected();
    }
  }
  async function select(id: string) {
    preview.value = undefined;
    batch.value = undefined;
    selectedId.value = id;
    await loadSelected();
  }
  async function upload(file: File) {
    if (busy.value) return;
    if (!/\.(xlsx|csv)$/i.test(file.name) || !file.size || file.size > ARCHIVE_IMPORT_MAX_BYTES) {
      reportError(
        new ApiRequestError("请选择不超过 2 MiB 的 .xlsx 或 .csv 文件", {
          code: "ARCHIVE_IMPORT_FILE_INVALID",
          status: 400
        })
      );
      return;
    }
    stopRead();
    const requestGeneration = generation;
    readController = new AbortController();
    busy.value = true;
    try {
      const value = await archiveImportApi.preview(file, AbortSignal.any([scope.signal, readController.signal]));
      if (scope.aborted || requestGeneration !== generation) return;
      preview.value = value;
      batch.value = undefined;
      selectedId.value = undefined;
      existing.value = "skip";
    } catch (error) {
      if (!scope.aborted && requestGeneration === generation && !isApiErrorCancelled(error)) reportError(error);
    } finally {
      if (!scope.aborted) {
        busy.value = false;
        schedule();
      }
    }
  }
  async function action(run: () => Promise<ArchiveImportBatch>) {
    if (busy.value) return;
    busy.value = true;
    stopRead();
    try {
      const value = await run();
      if (scope.aborted) return;
      preview.value = undefined;
      selectedId.value = value.id;
      apply(value);
    } catch (error) {
      if (!scope.aborted && !isApiErrorCancelled(error)) reportError(error);
    } finally {
      if (!scope.aborted) {
        busy.value = false;
        schedule();
      }
    }
  }
  async function start() {
    if (!preview.value) return;
    const input = {
      sourceName: preview.value.sourceName,
      sheetName: preview.value.sheetName,
      existing: existing.value,
      ...(groupId.value ? { groupId: groupId.value } : {}),
      rows: preview.value.rows.map(({ rowNumber, inputUrl, inputPlatform }) => ({ rowNumber, inputUrl, inputPlatform }))
    };
    await action(() => archiveImportApi.create(input, scope.signal));
  }
  const cancel = () =>
    batch.value ? action(() => archiveImportApi.cancel(batch.value!.id, scope.signal)) : Promise.resolve();
  const retry = () =>
    batch.value ? action(() => archiveImportApi.retry(batch.value!.id, scope.signal)) : Promise.resolve();
  async function remove() {
    if (!batch.value || busy.value) return;
    busy.value = true;
    historyGeneration++;
    const id = batch.value.id;
    stopRead();
    try {
      await archiveImportApi.remove(id, scope.signal);
      if (scope.aborted) return;
      history.value = history.value.filter((value) => value.id !== id);
      batch.value = undefined;
      selectedId.value = undefined;
    } catch (error) {
      if (!scope.aborted && !isApiErrorCancelled(error)) reportError(error);
    } finally {
      if (!scope.aborted) {
        busy.value = false;
        schedule();
      }
    }
  }
  watch(open, (value) => {
    if (!value) {
      stopRead();
      loading.value = false;
    } else schedule();
  });
  onScopeDispose(() => {
    stopRead();
  });
  return {
    open,
    busy,
    loading,
    preview,
    batch,
    history,
    selectedId,
    existing,
    groupId,
    rows,
    counts,
    show,
    select,
    upload,
    start,
    cancel,
    retry,
    remove,
    refreshHistory,
    refresh: async () => {
      await refreshHistory();
      if (selectedId.value && !preview.value) await loadSelected();
    }
  };
}
