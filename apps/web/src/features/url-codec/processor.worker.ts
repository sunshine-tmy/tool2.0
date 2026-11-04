import { processUrl, type UrlReply, type UrlRequest } from "./processor";
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<UrlRequest>) => void) | null;
  postMessage(reply: UrlReply): void;
};
scope.onmessage = ({ data }) => {
  if (
    !data ||
    !Number.isSafeInteger(data.id) ||
    typeof data.source !== "string" ||
    !data.settings ||
    !["encode", "decode"].includes(data.settings.direction) ||
    !["component", "uri", "form"].includes(data.settings.mode)
  )
    return;
  try {
    scope.postMessage({ id: data.id, result: processUrl(data.source, data.settings) });
  } catch {
    scope.postMessage({
      id: data.id,
      result: {
        ok: false,
        error: {
          code: "internal",
          message: "URL 编解码失败，请缩小内容后重试",
          offset: 0,
          line: 1,
          column: 1
        }
      }
    });
  }
};
