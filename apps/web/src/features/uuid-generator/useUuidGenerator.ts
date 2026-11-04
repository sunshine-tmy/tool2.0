/** Owns one transient batch; incomplete chunks never replace a completed result. */
import { computed, onScopeDispose, ref, shallowRef } from "vue";
import {
  formatUuids,
  generateUuidChunk,
  isUuidCount,
  UUID_LIMITS,
  UuidGenerationError,
  type RandomFill,
  type UuidLayout
} from "./generator";
type Job = { total: number; ids: string[]; seen: Set<string> };
export function useUuidGenerator(fill?: RandomFill) {
  const count = ref<number | null>(5),
    letterCase = ref<"lower" | "upper">("lower"),
    hyphens = ref(true),
    layout = ref<UuidLayout>("lines");
  const values = shallowRef<readonly string[]>([]),
    busy = ref(false),
    completed = ref(0),
    target = ref(0),
    error = ref(""),
    notice = ref("");
  const validCount = computed(() => isUuidCount(count.value));
  const canGenerate = computed(() => validCount.value && !busy.value);
  const canExport = computed(() => values.value.length > 0 && !busy.value);
  const output = computed(() =>
    values.value.length
      ? formatUuids(values.value, {
          uppercase: letterCase.value === "upper",
          hyphens: hyphens.value,
          layout: layout.value
        })
      : ""
  );
  let active: Job | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    disposed = false;
  function release() {
    clearTimeout(timer);
    timer = undefined;
    active = undefined;
    busy.value = false;
  }
  function pump(job: Job) {
    if (disposed || active !== job) return;
    timer = undefined;
    try {
      const next = generateUuidChunk(Math.min(UUID_LIMITS.chunkSize, job.total - job.ids.length), job.seen, fill);
      job.ids.push(...next);
      completed.value = job.ids.length;
      if (completed.value === job.total) {
        values.value = Object.freeze(job.ids);
        release();
      } else timer = setTimeout(() => pump(job), 0);
    } catch (failure) {
      release();
      error.value = failure instanceof UuidGenerationError ? failure.message : "UUID 生成失败，请重试";
      notice.value = values.value.length ? `已保留上一次完整的 ${values.value.length} 条结果` : "本次未保存结果";
    }
  }
  function generate() {
    if (disposed || busy.value) return;
    error.value = "";
    notice.value = "";
    if (!isUuidCount(count.value)) {
      error.value = "生成数量需要为 1～10,000 的整数";
      return;
    }
    const job: Job = { total: count.value, ids: [], seen: new Set() };
    active = job;
    target.value = job.total;
    completed.value = 0;
    busy.value = true;
    timer = setTimeout(() => pump(job), 0);
  }
  function stop() {
    if (!busy.value) return;
    release();
    notice.value = values.value.length
      ? `已停止生成，仍保留上一次完整的 ${values.value.length} 条结果`
      : "已停止生成，本次未保存结果";
  }
  function clear() {
    release();
    values.value = [];
    completed.value = target.value = 0;
    error.value = notice.value = "";
  }
  onScopeDispose(() => {
    disposed = true;
    clear();
  });
  return {
    count,
    letterCase,
    hyphens,
    layout,
    values,
    busy,
    completed,
    target,
    error,
    notice,
    validCount,
    canGenerate,
    canExport,
    output,
    generate,
    stop,
    clear
  };
}
