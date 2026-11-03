/** The browser owns unuploaded files; accepted jobs are owned by the API and survive navigation. */
import { computed, onScopeDispose, ref, watch } from "vue";
import { AUDIO_CONVERT_MAX_BYTES, AUDIO_CONVERT_MAX_FILES, type AudioConvertJob } from "@toolbox/shared/audio-convert";
import { audioConvertApi as api } from "./api";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
export function useConversion() {
  const files = ref<Array<{ file: File; ekey: string; state: string; error: string; id?: string }>>([]),
    jobs = ref<AudioConvertJob[]>([]),
    page = ref(1),
    total = ref(0),
    error = ref(""),
    bitrate = ref(192),
    busy = ref(false),
    selected = ref<string[]>([]);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined,
    loading = false,
    reloadRequested = false;
  async function load() {
    if (controller.signal.aborted) return;
    if (loading) {
      reloadRequested = true;
      return;
    }
    loading = true;
    const requestedPage = page.value;
    try {
      const data = await api.list(requestedPage, controller.signal);
      if (controller.signal.aborted || requestedPage !== page.value) return;
      jobs.value = data.items;
      total.value = data.total;
      // Keep cross-page selections; only discard known noncompleted rows or an entirely empty history.
      selected.value = data.total
        ? selected.value.filter((id) => !data.items.some((j) => j.id === id && j.status !== "completed"))
        : [];
      if (!data.items.length && page.value > 1) page.value--;
    } catch (e) {
      if (!isApiErrorCancelled(e)) error.value = formatApiError(e);
    } finally {
      loading = false;
      if (!controller.signal.aborted && (reloadRequested || requestedPage !== page.value)) {
        reloadRequested = false;
        void load();
      }
    }
  }
  async function poll() {
    await load();
    if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 3000);
  }
  function choose(input: File[]) {
    if (busy.value) return;
    error.value = "";
    if (input.length > AUDIO_CONVERT_MAX_FILES) {
      error.value = "一次最多选择 1000 个文件";
      return;
    }
    if (
      input.some((f) => !/\.(ogg|flac|mgg|mflac)$/i.test(f.name) || f.size <= 0 || f.size > AUDIO_CONVERT_MAX_BYTES)
    ) {
      error.value = "请选择 OGG、FLAC、MGG、MFLAC；单个文件必须大于 0 且不超过 100 MiB";
      return;
    }
    files.value = input.map((file) => ({ file, ekey: "", state: "等待上传", error: "" }));
  }
  const remaining = computed(() => files.value.filter((f) => f.state === "等待上传").length);
  const delay = () =>
    new Promise<void>((resolve) => {
      const abort = () => {
        clearTimeout(t);
        resolve();
      };
      const t = setTimeout(() => {
        controller.signal.removeEventListener("abort", abort);
        resolve();
      }, 1500);
      controller.signal.addEventListener("abort", abort, { once: true });
      if (controller.signal.aborted) abort();
    });
  let stop = false;
  async function start() {
    if (busy.value || !remaining.value) return;
    stop = false;
    busy.value = true;
    error.value = "";
    const quality = bitrate.value;
    try {
      for (const row of files.value) {
        if (stop || controller.signal.aborted) break;
        if (row.state !== "等待上传") continue;
        try {
          row.state = "正在上传";
          let job = await api.upload(row.file, quality, row.ekey, controller.signal);
          row.ekey = "";
          row.id = job.id;
          row.state = "已上传，等待转换";
          void load();
          while (["pending", "running"].includes(job.status) && !controller.signal.aborted) {
            await delay();
            if (controller.signal.aborted) break;
            job = await api.job(job.id, controller.signal);
            row.state = job.status === "running" ? `转换 ${Math.floor(job.progress)}%` : "已上传，等待转换";
          }
          if (!controller.signal.aborted) {
            row.state = job.status === "completed" ? "已完成" : job.status === "canceled" ? "已取消" : "失败";
            row.error = job.error ?? "";
          }
        } catch (e) {
          if (!isApiErrorCancelled(e)) {
            row.state = row.id ? "已提交，状态暂不可用" : "失败";
            row.error = formatApiError(e);
          }
        }
        if (!controller.signal.aborted) await load();
      }
    } finally {
      busy.value = false;
    }
  }
  function stopQueue() {
    stop = true;
  }
  watch(page, () => void load());
  void poll();
  onScopeDispose(() => {
    stop = true;
    controller.abort();
    if (timer) clearTimeout(timer);
    for (const row of files.value) row.ekey = "";
  });
  return { files, jobs, page, total, error, bitrate, busy, selected, remaining, choose, start, stopQueue, load };
}
