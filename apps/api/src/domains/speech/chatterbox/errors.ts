/**
 * 中文模块说明：Chatterbox 配音领域，负责批次、音色、任务队列和音频产物
 */
export type ChatterboxBatchErrorStatus = 400 | 404 | 409 | 413 | 429;

export class BatchInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: ChatterboxBatchErrorStatus
  ) {
    super(message);
  }
}

export function readableBatchError(error: unknown) {
  return error instanceof Error ? error.message : "声音克隆生成失败";
}

export function mapBatchError(error: unknown): {
  code: string;
  message: string;
  statusCode: ChatterboxBatchErrorStatus;
} {
  if (error instanceof BatchInputError) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  return {
    code: "CHATTERBOX_BATCH_FAILED",
    message: error instanceof Error ? error.message : "声音克隆批次处理失败",
    statusCode: 400
  };
}
