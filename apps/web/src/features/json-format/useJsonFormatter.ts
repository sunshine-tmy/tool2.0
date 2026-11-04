/** One page owns the source, worker, import races and export freshness; nothing is persisted. */
import { computed, onScopeDispose, ref, watch } from "vue";
import {
  JSON_AUTO_BYTES,
  JSON_LIMITS,
  countJsonCharacters,
  type JsonIndent,
  type JsonIssue,
  type JsonMode,
  type JsonResult,
  type JsonWorkerReply,
  type JsonWorkerRequest
} from "./processor";

type WorkerPort = {
  onmessage: ((event: MessageEvent<JsonWorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: JsonWorkerRequest): void;
  terminate(): void;
};
const createWorker = (): WorkerPort =>
  new Worker(new URL("./processor.worker.ts", import.meta.url), { type: "module" });
export function useJsonFormatter(workerFactory = createWorker) {
  const source = ref(""),
    indent = ref<JsonIndent>("2"),
    mode = ref<JsonMode>("format"),
    automatic = ref(true);
  const result = ref<Extract<JsonResult, { ok: true }>>(),
    error = ref<JsonIssue>(),
    notice = ref("");
  const busy = ref(false),
    fileName = ref("formatted.json"),
    revision = ref(0),
    resultRevision = ref(-1);
  const sourceBytes = computed(() => new TextEncoder().encode(source.value).byteLength);
  const sourceChars = computed(() => countJsonCharacters(source.value));
  const empty = computed(() => /^[\x20\t\r\n]*$/.test(source.value));
  const stale = computed(() => Boolean(result.value && revision.value !== resultRevision.value));
  const canExport = computed(() => Boolean(result.value && !stale.value && !busy.value && !error.value));
  let worker: WorkerPort | undefined,
    debounce: ReturnType<typeof setTimeout> | undefined,
    timeout: ReturnType<typeof setTimeout> | undefined,
    ticket = 0,
    importTicket = 0,
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
  function internalError(message: string) {
    error.value = { code: "internal", message, offset: 0, line: 1, column: 1 };
  }
  function run(nextMode: JsonMode = mode.value) {
    if (disposed) return;
    mode.value = nextMode;
    cancel();
    error.value = undefined;
    if (empty.value) return;
    if (source.value.length > JSON_LIMITS.inputBytes || sourceBytes.value > JSON_LIMITS.inputBytes) {
      error.value = { code: "limit", message: "输入超过 5 MiB，请缩小内容后处理", offset: 0, line: 1, column: 1 };
      return;
    }
    const id = ticket,
      version = revision.value;
    try {
      const own = workerFactory();
      worker = own;
      busy.value = true;
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
        internalError("后台处理未能运行，请重新处理或重新加载页面");
      };
      timeout = setTimeout(() => {
        if (disposed || id !== ticket) return;
        cancel();
        internalError("处理超过 5 秒，已停止；请缩小内容后重试");
      }, 5000);
      own.postMessage({ id, text: source.value, mode: mode.value, indent: indent.value });
    } catch {
      cancel();
      internalError("无法启动后台处理，请使用支持 Web Worker 的浏览器并重试");
    }
  }
  function schedule() {
    cancel();
    revision.value++;
    error.value = undefined;
    notice.value = "";
    if (empty.value) {
      result.value = undefined;
      return;
    }
    if (automatic.value && source.value.length <= JSON_AUTO_BYTES && sourceBytes.value <= JSON_AUTO_BYTES)
      debounce = setTimeout(() => run(), 300);
  }
  watch([source, indent, mode], schedule, { flush: "sync" });
  watch(
    automatic,
    (enabled) => {
      clearTimeout(debounce);
      debounce = undefined;
      if (enabled && !empty.value && sourceBytes.value <= JSON_AUTO_BYTES) debounce = setTimeout(() => run(), 300);
    },
    { flush: "sync" }
  );
  function clear() {
    importTicket++;
    cancel();
    source.value = "";
    result.value = undefined;
    error.value = undefined;
    notice.value = "";
    fileName.value = "formatted.json";
  }
  async function importFile(file: File) {
    const own = ++importTicket,
      version = revision.value;
    notice.value = "";
    if (!/\.(json|txt)$/i.test(file.name)) {
      notice.value = "请选择 .json 或 .txt 文件";
      return;
    }
    if (file.size > JSON_LIMITS.inputBytes) {
      notice.value = "文件超过 5 MiB，未替换当前输入";
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      if (disposed || own !== importTicket || version !== revision.value) return;
      source.value = text;
      fileName.value =
        file.name
          .replace(/\.(json|txt)$/i, "")
          .replace(/[\\/:*?"<>|]/g, "_")
          .replace(/\p{Cc}/gu, "_")
          .slice(0, 100) + ".json";
    } catch {
      if (!disposed && own === importTicket && version === revision.value)
        notice.value = "文件读取失败，请使用 UTF-8 编码的 JSON 或文本文件";
    }
  }
  onScopeDispose(() => {
    disposed = true;
    importTicket++;
    cancel();
    source.value = "";
    result.value = undefined;
    error.value = undefined;
  });
  return {
    source,
    indent,
    mode,
    automatic,
    result,
    error,
    notice,
    busy,
    fileName,
    sourceBytes,
    sourceChars,
    empty,
    stale,
    canExport,
    run,
    cancel,
    clear,
    importFile
  };
}
