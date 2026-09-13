export class BatchInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export function readableBatchError(error: unknown) {
  return error instanceof Error ? error.message : "声音克隆生成失败";
}

export function mapBatchError(error: unknown) {
  if (error instanceof BatchInputError) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  return {
    code: "CHATTERBOX_BATCH_FAILED",
    message: error instanceof Error ? error.message : "声音克隆批次处理失败",
    statusCode: 400
  };
}
