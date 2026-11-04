/** One owner for transient URL input, worker lifetime and export freshness. */
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import {
  measureUrlText,
  URL_CODEC_AUTO_BYTES,
  URL_CODEC_LIMITS,
  type UrlIssue,
  type UrlReply,
  type UrlRequest,
  type UrlSettings,
  type UrlSuccess
} from "./processor";
type WorkerPort = {
  onmessage: ((event: MessageEvent<UrlReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: UrlRequest): void;
  terminate(): void;
};
const createWorker = (): WorkerPort =>
  new Worker(new URL("./processor.worker.ts", import.meta.url), { type: "module" });
export function useUrlCodec(workerFactory = createWorker) {
  const source = ref(""),
    direction = ref<UrlSettings["direction"]>("encode"),
    mode = ref<UrlSettings["mode"]>("component"),
    automatic = ref(true);
  const result = shallowRef<UrlSuccess>(),
    error = ref<UrlIssue>(),
    notice = ref(""),
    busy = ref(false);
  const revision = ref(0),
    resultRevision = ref(-1);
  const metrics = computed(() => measureUrlText(source.value));
  const hasInput = computed(() => source.value.length > 0);
  const stale = computed(() => Boolean(result.value && revision.value !== resultRevision.value));
  const canExport = computed(() => Boolean(result.value && !stale.value && !busy.value && !error.value));
  let worker: WorkerPort | undefined,
    debounce: ReturnType<typeof setTimeout> | undefined,
    timeout: ReturnType<typeof setTimeout> | undefined,
    ticket = 0,
    disposed = false;
  function cancel() {
    ticket++;
    clearTimeout(debounce);
    clearTimeout(timeout);
    debounce = timeout = undefined;
    if (worker) {
      worker.onmessage = worker.onerror = null;
      worker.terminate();
      worker = undefined;
    }
    busy.value = false;
  }
  function fail(message: string, code: UrlIssue["code"] = "internal") {
    error.value = { code, message, offset: 0, line: 1, column: 1 };
  }
  function run() {
    if (disposed) return;
    cancel();
    error.value = undefined;
    if (!hasInput.value) return;
    if (metrics.value.bytes > URL_CODEC_LIMITS.inputBytes) {
      fail("输入超过 1 MiB，请缩小内容后处理", "limit");
      return;
    }
    const id = ticket,
      version = revision.value;
    busy.value = true;
    timeout = setTimeout(() => {
      if (disposed || id !== ticket) return;
      cancel();
      fail("处理超过 5 秒，已停止；请缩小内容后重试");
    }, 5000);
    try {
      const own = workerFactory();
      worker = own;
      own.onmessage = ({ data }) => {
        if (disposed || id !== ticket || version !== revision.value || data.id !== id) return;
        cancel();
        if (data.result.ok) {
          result.value = data.result;
          resultRevision.value = version;
        } else error.value = data.result.error;
      };
      own.onerror = (event) => {
        event.preventDefault();
        if (disposed || id !== ticket) return;
        cancel();
        fail("后台处理未能运行，请重试或重新加载页面");
      };
      own.postMessage({ id, source: source.value, settings: { direction: direction.value, mode: mode.value } });
    } catch {
      if (!disposed && id === ticket) {
        cancel();
        fail("无法启动后台处理，请重试或重新加载页面");
      }
    }
  }
  function schedule() {
    cancel();
    revision.value++;
    error.value = undefined;
    notice.value = "";
    if (!hasInput.value) {
      result.value = undefined;
      return;
    }
    if (automatic.value && metrics.value.bytes <= URL_CODEC_AUTO_BYTES) debounce = setTimeout(run, 300);
  }
  watch([source, direction, mode], schedule, { flush: "sync" });
  watch(
    automatic,
    (enabled) => {
      clearTimeout(debounce);
      debounce = undefined;
      if (enabled && hasInput.value && metrics.value.bytes <= URL_CODEC_AUTO_BYTES) debounce = setTimeout(run, 300);
    },
    { flush: "sync" }
  );
  function clear() {
    cancel();
    source.value = "";
    result.value = undefined;
    error.value = undefined;
    notice.value = "";
  }
  onScopeDispose(() => {
    disposed = true;
    clear();
  });
  return {
    source,
    direction,
    mode,
    automatic,
    result,
    error,
    notice,
    busy,
    metrics,
    hasInput,
    stale,
    canExport,
    run,
    cancel,
    clear
  };
}
