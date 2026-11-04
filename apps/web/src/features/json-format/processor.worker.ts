import { processJson, type JsonWorkerReply, type JsonWorkerRequest } from "./processor";
// This module runs in a dedicated worker; do not add worker DOM globals to the entire web project.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<JsonWorkerRequest>) => void) | null;
  postMessage(reply: JsonWorkerReply): void;
};
scope.onmessage = ({ data }) => {
  if (
    !data ||
    !Number.isSafeInteger(data.id) ||
    typeof data.text !== "string" ||
    !["2", "4", "tab"].includes(data.indent) ||
    !["format", "minify"].includes(data.mode)
  )
    return;
  try {
    scope.postMessage({ id: data.id, result: processJson(data.text, data) });
  } catch {
    scope.postMessage({
      id: data.id,
      result: {
        ok: false,
        error: {
          code: "internal",
          message: "JSON 处理失败，请缩小内容后重试",
          offset: 0,
          line: 1,
          column: 1
        }
      }
    });
  }
};
