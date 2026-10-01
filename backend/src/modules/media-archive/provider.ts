/** 平台适配器只读取作品；任务、下载、配额和文件提交由中性服务统一管理。 */
import type { ArchivePlatform, ContentArchiveItem, ContentArchiveTask } from "@toolbox/shared";

export type ArchiveSource = Pick<
  ContentArchiveItem,
  | "platform"
  | "contentId"
  | "canonicalUrl"
  | "type"
  | "title"
  | "description"
  | "rawText"
  | "topics"
  | "author"
  | "publishedAt"
> & {
  media: Array<{
    urls: string[];
    kind: ContentArchiveItem["media"][number]["kind"];
    index: number;
    width?: number;
    height?: number;
    durationMs?: number;
  }>;
};
export type ArchiveProgress = (stage: ContentArchiveTask["stage"], progress: number, message: string) => void;
export type ArchiveProvider = {
  platform: ArchivePlatform;
  extract: (url: string, signal: AbortSignal, progress: ArchiveProgress) => Promise<ArchiveSource>;
  close: () => Promise<void>;
};

export class ArchiveTaskError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: 400 | 409 | 429 | 503 = 400
  ) {
    super(message);
  }
}

/** 外部读取不能因未响应取消而把队列永久占住；迟到结果不可进入下载/提交阶段。 */
export async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    // 调用者可能已创建异步读取；即使信号先终止，也必须观察其拒绝，不能留下未处理异常。
    void operation.catch(() => undefined);
    signal.throwIfAborted();
  }
  let onAbort!: () => void;
  const cancellation = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    return await Promise.race([operation, cancellation]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
