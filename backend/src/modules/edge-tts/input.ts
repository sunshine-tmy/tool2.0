import {
  EDGE_TTS_LANGUAGES,
  EDGE_TTS_MAX_TEXT_LENGTH,
  type EdgeTtsCreateTaskInput,
  type EdgeTtsLanguage
} from "@toolbox/shared";

export function parseCreateInput(
  body: unknown,
  allowedVoices: Set<string>
):
  | { success: true; value: EdgeTtsCreateTaskInput }
  | { success: false; statusCode: 400 | 413; code: string; message: string } {
  if (!isRecord(body)) return invalid("EDGE_TTS_INPUT_INVALID", "请求内容格式不正确");
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const language = body.language;
  const voice = typeof body.voice === "string" ? body.voice.trim() : "";
  if (!text) return invalid("EDGE_TTS_TEXT_REQUIRED", "请输入需要生成语音的文本");
  if (text.length > EDGE_TTS_MAX_TEXT_LENGTH) {
    return invalid("EDGE_TTS_TEXT_TOO_LONG", `文本不能超过 ${EDGE_TTS_MAX_TEXT_LENGTH} 个字符`, 413);
  }
  if (!isSupportedLanguage(language)) return invalid("EDGE_TTS_LANGUAGE_INVALID", "不支持该语言");
  if (!allowedVoices.has(voice) || !voice.startsWith(`${language}-`)) {
    return invalid("EDGE_TTS_VOICE_INVALID", "请选择当前语言下可用的音色");
  }
  const rate = boundedInteger(body.rate, -50, 100);
  const volume = boundedInteger(body.volume, -50, 50);
  const pitch = boundedInteger(body.pitch, -50, 50);
  if (rate === undefined || volume === undefined || pitch === undefined) {
    return invalid("EDGE_TTS_PARAMETER_INVALID", "语速、音量或音调超出允许范围");
  }
  if (typeof body.includeSubtitles !== "boolean") {
    return invalid("EDGE_TTS_SUBTITLE_INVALID", "字幕参数格式不正确");
  }
  const fileName = typeof body.fileName === "string" ? sanitizeFileName(body.fileName) : undefined;
  return {
    success: true,
    value: { text, language, voice, rate, volume, pitch, includeSubtitles: body.includeSubtitles, fileName }
  };
}

export function sanitizeFileName(value: string) {
  const withoutExtension = value.trim().replace(/\.(mp3|srt)$/i, "");
  const printable = Array.from(withoutExtension, (character) => (character.charCodeAt(0) < 32 ? "-" : character)).join(
    ""
  );
  return (
    printable
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 100) || "edge-tts-audio"
  );
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : undefined;
}

function invalid(code: string, message: string, statusCode: 400 | 413 = 400) {
  return { success: false as const, statusCode, code, message };
}

function isSupportedLanguage(value: unknown): value is EdgeTtsLanguage {
  return typeof value === "string" && (EDGE_TTS_LANGUAGES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
