import { processBase64, type Base64Reply, type Base64Request } from "./processor";
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Base64Request>) => void) | null;
  postMessage(reply: Base64Reply, transfer: Transferable[]): void;
};
scope.onmessage = ({ data }) => {
  if (
    !data ||
    !Number.isSafeInteger(data.id) ||
    !data.input ||
    !data.settings ||
    !["encode", "decode"].includes(data.settings.direction) ||
    !["standard", "url"].includes(data.settings.alphabet) ||
    typeof data.settings.ignoreWhitespace !== "boolean" ||
    !(
      (data.input.kind === "text" && typeof data.input.text === "string") ||
      (data.input.kind === "file" && data.input.buffer instanceof ArrayBuffer)
    )
  )
    return;
  try {
    const result = processBase64(data.input, data.settings);
    scope.postMessage({ id: data.id, result }, result.ok && result.direction === "decode" ? [result.buffer] : []);
  } catch {
    scope.postMessage(
      {
        id: data.id,
        result: {
          ok: false,
          error: { code: "internal", message: "Base64 处理失败，请缩小内容后重试", offset: 0, line: 1, column: 1 }
        }
      },
      []
    );
  }
};
