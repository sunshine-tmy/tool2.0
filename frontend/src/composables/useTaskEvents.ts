import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { isTaskDto, TaskSchema, type TaskDto } from "@toolbox/shared";
import { resolveApiUrl } from "../config/runtime";
import { ApiRequestError, httpClient } from "../services/http";

export type TaskEventSource = {
  addEventListener: (type: string, listener: (event: MessageEvent<string>) => void) => void;
  close: () => void;
};

type TaskConnectionState = "idle" | "connecting" | "streaming" | "reconnecting" | "polling" | "paused" | "completed";

type TaskEventsOptions = {
  createEventSource?: (url: string) => TaskEventSource;
  fetchTask?: (taskId: string, signal: AbortSignal) => Promise<TaskDto>;
  isVisible?: () => boolean;
  subscribeVisibility?: (listener: () => void) => () => void;
  reconnectBaseMs?: number;
  maxReconnectAttempts?: number;
  pollIntervalMs?: number;
};

const terminalStatuses = new Set<TaskDto["status"]>(["completed", "failed"]);

export function useTaskEvents(taskId: MaybeRefOrGetter<string | undefined>, options: TaskEventsOptions = {}) {
  const task = ref<TaskDto>();
  const error = ref<ApiRequestError>();
  const connection = ref<TaskConnectionState>("idle");
  const reconnectBaseMs = options.reconnectBaseMs ?? 1_000;
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 4;
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  const createEventSource = options.createEventSource ?? defaultEventSource;
  const fetchTask =
    options.fetchTask ?? ((id, signal) => httpClient.get(`/tasks/${encodeURIComponent(id)}`, TaskSchema, { signal }));
  const isVisible =
    options.isVisible ?? (() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const subscribeVisibility = options.subscribeVisibility ?? defaultVisibilitySubscription;

  let source: TaskEventSource | undefined;
  let generation = 0;
  let reconnectAttempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pollController: AbortController | undefined;
  let disposed = false;

  const unwatch = watch(
    () => toValue(taskId),
    (nextTaskId, previousTaskId) => {
      if (nextTaskId === previousTaskId) return;
      task.value = undefined;
      error.value = undefined;
      reconnectAttempts = 0;
      stopTransport();
      if (nextTaskId) connect(nextTaskId);
      else connection.value = "idle";
    },
    { immediate: true }
  );

  const unsubscribeVisibility = subscribeVisibility(() => {
    if (disposed) return;
    if (!isVisible()) {
      stopTransport();
      connection.value = "paused";
      return;
    }
    const id = toValue(taskId);
    if (id && !isTerminal(task.value)) connect(id);
  });

  function connect(id: string) {
    if (disposed || !isVisible()) {
      connection.value = "paused";
      return;
    }
    stopTransport();
    connection.value = reconnectAttempts === 0 ? "connecting" : "reconnecting";
    const currentGeneration = generation;
    const currentSource = createEventSource(resolveApiUrl(`/tasks/${encodeURIComponent(id)}/events`));
    source = currentSource;

    currentSource.addEventListener("open", () => {
      if (!isCurrent(currentSource, currentGeneration)) return;
      reconnectAttempts = 0;
      connection.value = "streaming";
    });
    currentSource.addEventListener("task", (event) => {
      if (!isCurrent(currentSource, currentGeneration)) return;
      const nextTask = parseTask(event.data);
      if (!nextTask) return;
      task.value = nextTask;
      error.value = undefined;
      if (isTerminal(nextTask)) {
        stopTransport();
        connection.value = "completed";
      }
    });
    currentSource.addEventListener("error", () => {
      if (!isCurrent(currentSource, currentGeneration)) return;
      closeSource();
      if (!isVisible()) {
        connection.value = "paused";
        return;
      }
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = reconnectBaseMs * 2 ** reconnectAttempts;
        reconnectAttempts += 1;
        connection.value = "reconnecting";
        timer = setTimeout(() => connect(id), delay);
      } else {
        startPolling(id);
      }
    });
  }

  function startPolling(id: string) {
    connection.value = "polling";
    clearTimer();
    timer = setTimeout(() => void poll(id), pollIntervalMs);
  }

  async function poll(id: string) {
    if (disposed || !isVisible()) return;
    pollController?.abort();
    pollController = new AbortController();
    try {
      const nextTask = await fetchTask(id, pollController.signal);
      if (!isTaskDto(nextTask)) throw new Error("Task response did not match the shared schema");
      task.value = nextTask;
      error.value = undefined;
      if (isTerminal(nextTask)) {
        connection.value = "completed";
        return;
      }
    } catch (caught) {
      if (!pollController.signal.aborted) {
        error.value = new ApiRequestError("任务进度查询失败", { code: "TASK_POLL_FAILED", cause: caught });
      }
    }
    if (!disposed && isVisible()) startPolling(id);
  }

  function parseTask(raw: string) {
    try {
      const value: unknown = JSON.parse(raw);
      if (isTaskDto(value)) return value;
    } catch {
      // The stable API error below covers malformed JSON and invalid task data.
    }
    error.value = new ApiRequestError("任务事件未通过 API 契约校验", { code: "INVALID_TASK_EVENT" });
    return undefined;
  }

  function isCurrent(candidate: TaskEventSource, expectedGeneration: number) {
    return !disposed && source === candidate && generation === expectedGeneration;
  }

  function closeSource() {
    generation += 1;
    source?.close();
    source = undefined;
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = undefined;
  }

  function stopTransport() {
    closeSource();
    clearTimer();
    pollController?.abort();
  }

  function stop() {
    disposed = true;
    stopTransport();
    connection.value = "idle";
  }

  onScopeDispose(() => {
    stop();
    unwatch();
    unsubscribeVisibility();
  });

  return { task, error, connection, stop };
}

function isTerminal(task: TaskDto | undefined) {
  return task ? terminalStatuses.has(task.status) : false;
}

function defaultEventSource(url: string): TaskEventSource {
  return new EventSource(url, { withCredentials: true });
}

function defaultVisibilitySubscription(listener: () => void) {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
