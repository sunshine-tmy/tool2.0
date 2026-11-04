/** Owns transient inputs, file reads, worker transfers and export freshness for one codec page. */
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import {
  BASE64_AUTO_BYTES,
  BASE64_LIMITS,
  countBase64Characters,
  type Base64Issue,
  type Base64Reply,
  type Base64Request,
  type Base64Settings,
  type Base64Success
} from "./processor";
type WorkerPort = {
  onmessage: ((event: MessageEvent<Base64Reply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: Base64Request, transfer: Transferable[]): void;
  terminate(): void;
};
const createWorker = (): WorkerPort =>
  new Worker(new URL("./processor.worker.ts", import.meta.url), { type: "module" });
export function useBase64Codec(workerFactory = createWorker) {
  const source = ref(""),
    direction = ref<Base64Settings["direction"]>("encode"),
    alphabet = ref<Base64Settings["alphabet"]>("standard"),
    ignoreWhitespace = ref(true),
    automatic = ref(true),
    inputKind = ref<"text" | "file">("text"),
    file = shallowRef<File>();
  const result = shallowRef<Base64Success>(),
    error = ref<Base64Issue>(),
    notice = ref(""),
    busy = ref(false),
    importing = ref(false);
  const revision = ref(0),
    resultRevision = ref(-1);
  const activeFile = computed(() => direction.value === "encode" && inputKind.value === "file");
  const hasInput = computed(() => (activeFile.value ? Boolean(file.value) : source.value.length > 0));
  const sourceBytes = computed(() =>
    activeFile.value ? (file.value?.size ?? 0) : new TextEncoder().encode(source.value).byteLength
  );
  const sourceChars = computed(() => countBase64Characters(source.value));
  const stale = computed(() => Boolean(result.value && revision.value !== resultRevision.value));
  const canExport = computed(() =>
    Boolean(result.value && !stale.value && !busy.value && !importing.value && !error.value)
  );
  const canCopy = computed(() => canExport.value && result.value?.kind === "text");
  const resultChars = computed(() => (result.value?.kind === "text" ? countBase64Characters(result.value.text) : 0));
  let worker: WorkerPort | undefined,
    debounce: ReturnType<typeof setTimeout> | undefined,
    timeout: ReturnType<typeof setTimeout> | undefined,
    ticket = 0,
    importTicket = 0,
    disposed = false;
  function cancel() {
    importTicket++;
    importing.value = false;
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
  function fail(message: string, code: Base64Issue["code"] = "internal") {
    error.value = { code, message, offset: 0, line: 1, column: 1 };
  }
  async function run() {
    if (disposed) return;
    cancel();
    error.value = undefined;
    if (!hasInput.value) return;
    const limit = direction.value === "encode" ? BASE64_LIMITS.payloadBytes : BASE64_LIMITS.encodedBytes;
    if (sourceBytes.value > limit) {
      fail(`输入超过 ${direction.value === "encode" ? 5 : 7} MiB，请缩小内容后处理`, "limit");
      return;
    }
    const id = ticket,
      version = revision.value,
      selected = activeFile.value ? file.value : undefined;
    const settings: Base64Settings = {
      direction: direction.value,
      alphabet: alphabet.value,
      ignoreWhitespace: ignoreWhitespace.value
    };
    busy.value = true;
    timeout = setTimeout(() => {
      if (disposed || id !== ticket) return;
      cancel();
      fail("处理超过 5 秒，已停止；请缩小内容后重试");
    }, 5000);
    try {
      // Keep File as the retry source. The per-request buffer is detached when transferred to the worker.
      const input = selected
        ? { kind: "file" as const, buffer: await selected.arrayBuffer() }
        : { kind: "text" as const, text: source.value };
      if (disposed || id !== ticket || version !== revision.value) return;
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
        fail("后台处理未能运行，请重新处理或重新加载页面");
      };
      own.postMessage({ id, input, settings }, input.kind === "file" ? [input.buffer] : []);
    } catch {
      if (!disposed && id === ticket) {
        cancel();
        fail("无法读取文件或启动后台处理，请重新选择文件或重试");
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
    if (automatic.value && !activeFile.value && sourceBytes.value <= BASE64_AUTO_BYTES)
      debounce = setTimeout(() => void run(), 300);
  }
  watch([source, direction, alphabet, ignoreWhitespace, inputKind, file], schedule, { flush: "sync" });
  watch(
    automatic,
    (enabled) => {
      clearTimeout(debounce);
      debounce = undefined;
      if (enabled && hasInput.value && !activeFile.value && sourceBytes.value <= BASE64_AUTO_BYTES)
        debounce = setTimeout(() => void run(), 300);
    },
    { flush: "sync" }
  );
  async function importFile(selected: File) {
    cancel();
    const own = ++importTicket,
      version = revision.value,
      mode = direction.value;
    notice.value = "";
    const limit = mode === "encode" ? BASE64_LIMITS.payloadBytes : BASE64_LIMITS.encodedBytes;
    if (selected.size > limit) {
      notice.value = `文件超过 ${mode === "encode" ? 5 : 7} MiB，已保留当前输入`;
      return;
    }
    if (mode === "encode") {
      inputKind.value = "file";
      file.value = selected;
      return;
    }
    importing.value = true;
    try {
      const bytes = await selected.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      if (disposed || own !== importTicket || version !== revision.value) return;
      source.value = text;
    } catch {
      if (!disposed && own === importTicket && version === revision.value)
        notice.value = "解码请导入 UTF-8 编码的 Base64 文本文件；原始文件请切换到编码";
    } finally {
      if (own === importTicket) importing.value = false;
    }
  }
  function removeFile() {
    importTicket++;
    file.value = undefined;
  }
  function clear() {
    importTicket++;
    importing.value = false;
    cancel();
    source.value = "";
    file.value = undefined;
    result.value = undefined;
    error.value = undefined;
    notice.value = "";
  }
  function downloadName() {
    if (result.value?.direction === "decode") return result.value.kind === "binary" ? "decoded.bin" : "decoded.txt";
    const name = activeFile.value ? file.value?.name : undefined;
    return name
      ? name
          .replace(/[\\/:*?"<>|]/g, "_")
          .replace(/\p{Cc}/gu, "_")
          .slice(0, 100) + ".base64.txt"
      : "encoded.base64.txt";
  }
  onScopeDispose(() => {
    disposed = true;
    clear();
  });
  return {
    source,
    direction,
    alphabet,
    ignoreWhitespace,
    automatic,
    inputKind,
    file,
    result,
    error,
    notice,
    busy,
    importing,
    activeFile,
    hasInput,
    sourceBytes,
    sourceChars,
    resultChars,
    stale,
    canExport,
    canCopy,
    run,
    cancel,
    importFile,
    removeFile,
    clear,
    downloadName
  };
}
