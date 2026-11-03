/** One owner for browser file queue, metadata confirmation and server history requests. */
import { computed, onScopeDispose, ref, watch } from "vue";
import {
  AUDIO_EXTRACT_MAX_BYTES,
  AUDIO_EXTRACT_MAX_FILES,
  type AudioExtractJob,
  type AudioExtractSource
} from "@toolbox/shared/audio-extract";
import { audioExtractApi as api } from "./api";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
type ExtractionRow = {
  file: File;
  state: string;
  progress: number;
  error: string;
  source?: AudioExtractSource;
  tracks: number[];
  jobs: string[];
};
export function useAudioExtraction() {
  const files = ref<ExtractionRow[]>([]),
    jobs = ref<AudioExtractJob[]>([]),
    page = ref(1),
    total = ref(0),
    error = ref(""),
    busy = ref(false),
    selected = ref<string[]>([]);
  const format = ref<"mp3" | "original">("mp3"),
    bitrate = ref<128 | 192 | 256 | 320>(192),
    policy = ref<"default" | "all" | "manual">("default"),
    waiting = ref<ExtractionRow>();
  const controller = new AbortController();
  let stopped = false,
    disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    request = 0;
  let confirmTracks: ((tracks: number[]) => void) | undefined;
  const remaining = computed(() => files.value.filter((r) => r.state === "等待上传").length);
  function choose(input: File[]) {
    if (busy.value) return;
    if (input.length > AUDIO_EXTRACT_MAX_FILES) {
      error.value = "一次最多选择 1000 个视频";
      return;
    }
    if (input.some((f) => !/\.(mp4|mkv|avi|mov|webm)$/i.test(f.name) || !f.size || f.size > AUDIO_EXTRACT_MAX_BYTES)) {
      error.value = "请选择 MP4、MKV、AVI、MOV、WebM，单个视频不超过 2 GiB";
      return;
    }
    error.value = "";
    files.value = input.map((file) => ({ file, state: "等待上传", progress: 0, error: "", tracks: [], jobs: [] }));
  }
  async function load() {
    const n = ++request,
      p = page.value;
    try {
      const data = await api.list(p, controller.signal);
      if (disposed || n !== request || p !== page.value) return;
      jobs.value = data.items;
      total.value = data.total;
      if (!data.items.length && page.value > 1) page.value = Math.max(1, Math.ceil(data.total / 50));
      selected.value = data.total
        ? selected.value.filter((id) => !data.items.some((j) => j.id === id && j.status !== "completed"))
        : [];
    } catch (e) {
      if (!disposed && !isApiErrorCancelled(e) && n === request) error.value = formatApiError(e);
    }
  }
  async function poll() {
    await load();
    if (!disposed) timer = setTimeout(() => void poll(), 3000);
  }
  function delay() {
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(t);
        controller.signal.removeEventListener("abort", finish);
        resolve();
      };
      const t = setTimeout(finish, 1000);
      controller.signal.addEventListener("abort", finish, { once: true });
      if (controller.signal.aborted) finish();
    });
  }
  function confirmRow() {
    if (waiting.value?.tracks.length) confirmTracks?.([...waiting.value.tracks]);
  }
  function stopQueue() {
    stopped = true;
    confirmTracks?.([]);
  }
  let currentUpload: AbortController | undefined, currentRow: ExtractionRow | undefined;
  function cancelRow(row: ExtractionRow) {
    if (row !== currentRow) return;
    row.state = "已取消";
    row.error = "";
    if (waiting.value === row) confirmTracks?.([]);
    else currentUpload?.abort();
  }
  async function start() {
    if (busy.value || !remaining.value) return;
    busy.value = true;
    stopped = false;
    error.value = "";
    const settings = { format: format.value, bitrate: bitrate.value, policy: policy.value };
    try {
      for (const row of files.value) {
        if (stopped || disposed) break;
        if (row.state !== "等待上传") continue;
        let sourceId: string | undefined,
          submitted = false;
        const upload = new AbortController();
        const abortUpload = () => upload.abort();
        controller.signal.addEventListener("abort", abortUpload, { once: true });
        currentUpload = upload;
        currentRow = row;
        try {
          row.state = "正在上传";
          const source = await api.upload(row.file, upload.signal, (n) => {
            if (!disposed && !upload.signal.aborted) {
              row.progress = n;
              if (n === 100) row.state = "识别音轨";
            }
          });
          sourceId = source.id;
          if (disposed) break;
          if (upload.signal.aborted) continue;
          row.source = source;
          row.tracks = [(source.tracks.find((t) => t.default) ?? source.tracks[0]).index];
          let tracks = settings.policy === "all" ? source.tracks.map((t) => t.index) : row.tracks;
          if (settings.policy === "manual" && source.tracks.length > 1 && !stopped) {
            row.state = "请选择音轨";
            waiting.value = row;
            tracks = await new Promise<number[]>((resolve) => {
              confirmTracks = resolve;
            });
            waiting.value = undefined;
            confirmTracks = undefined;
          }
          if (stopped || disposed) {
            row.state = "等待上传";
            break;
          }
          if (!tracks.length) {
            row.state = "已取消";
            continue;
          }
          row.state = "提交提取任务";
          const accepted = await api.create(
            { sourceId, trackIndices: tracks, format: settings.format, bitrate: settings.bitrate },
            controller.signal
          );
          submitted = true;
          if (disposed) break;
          row.jobs = accepted.items.map((j) => j.id);
          row.state = "已提交";
          row.progress = Math.floor(accepted.items.reduce((n, j) => n + j.progress, 0) / accepted.items.length);
          void load();
          let current = accepted.items;
          while (current.some((j) => ["pending", "running"].includes(j.status)) && !disposed) {
            await delay();
            if (disposed) break;
            current = await Promise.all(
              current.map((j) =>
                ["pending", "running"].includes(j.status) ? api.job(j.id, controller.signal) : Promise.resolve(j)
              )
            );
            row.progress = Math.floor(current.reduce((n, j) => n + j.progress, 0) / current.length);
            row.state = `正在处理 ${current.filter((j) => j.status === "completed").length}/${current.length}`;
          }
          if (!disposed) {
            const failed = current.filter((j) => j.status !== "completed");
            row.state = failed.length ? "部分失败或已取消" : "已完成";
            row.error = failed.map((j) => j.error ?? "已取消").join("；");
          }
        } catch (e) {
          if (!disposed && !upload.signal.aborted && !isApiErrorCancelled(e)) {
            row.state = submitted ? "已提交，状态待刷新" : "失败";
            row.error = formatApiError(e);
            // An uncertain accepted job or occupied staging area must not trigger an unbounded upload chain.
            if (submitted || (e as { status?: number }).status === 429 || (e as { status?: number }).status === 507)
              stopped = true;
          }
        } finally {
          controller.signal.removeEventListener("abort", abortUpload);
          currentUpload = undefined;
          currentRow = undefined;
          if (sourceId && !submitted) await api.discard(sourceId).catch(() => undefined);
        }
        if (!disposed) await load();
      }
    } finally {
      busy.value = false;
      waiting.value = undefined;
      confirmTracks = undefined;
    }
  }
  function retry(row: ExtractionRow) {
    if (!busy.value) {
      row.state = "等待上传";
      row.error = "";
      row.progress = 0;
      row.source = undefined;
      row.jobs = [];
    }
  }
  function select(id: string, checked: boolean) {
    const ids = checked ? [...new Set([...selected.value, id])] : selected.value.filter((x) => x !== id);
    if (ids.length > 1000) {
      error.value = "每次最多选择 1000 条结果";
      return;
    }
    selected.value = ids;
  }
  watch(page, () => void load());
  void poll();
  onScopeDispose(() => {
    disposed = true;
    stopped = true;
    confirmTracks?.([]);
    controller.abort();
    clearTimeout(timer);
  });
  return {
    files,
    jobs,
    page,
    total,
    error,
    busy,
    selected,
    format,
    bitrate,
    policy,
    waiting,
    remaining,
    choose,
    start,
    stopQueue,
    cancelRow,
    confirmRow,
    retry,
    select,
    load
  };
}
