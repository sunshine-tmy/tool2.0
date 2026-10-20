/** 两种配音引擎共用批次状态、日期和时长的展示规则。 */
export function batchTagType(status: string): "success" | "warning" | "error" | "default" {
  return status === "completed"
    ? "success"
    : status === "partial_failed" || status === "cancelled" || status === "failed"
      ? "error"
      : "warning";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function taskTagType(status: string): "success" | "warning" | "error" | "default" {
  return status === "completed" ? "success" : status === "failed" || status === "cancelled" ? "error" : "warning";
}

export function formatDuration(value?: number) {
  if (!value) return "0 秒";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return minutes ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

/** 累计生成的音频长度，不是任务耗时；保留百分之一秒，避免短音频被整秒舍入。 */
export function formatAudioDuration(value?: number) {
  if (!value || !Number.isFinite(value) || value < 0) return "0 秒";
  return `${Number(value.toFixed(2))} 秒`;
}
