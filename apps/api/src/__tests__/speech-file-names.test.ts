import { describe, expect, it } from "vitest";
import { contentDisposition } from "../domains/speech/shared/download-headers";
import {
  sanitizeDisplayName,
  sanitizeBatchFileName as sanitizeFileName
} from "../domains/speech/chatterbox/file-names";
import { sanitizeFileName as sanitizeOnlineName } from "../domains/speech/edge-tts/input";

describe("speech filename compatibility", () => {
  it("retains reference display basenames, newlines, length and fallback", () => {
    expect(sanitizeDisplayName("../参考\r\n音频.wav")).toBe("参考  音频.wav");
    expect(sanitizeDisplayName("")).toBe("reference-audio");
    expect(sanitizeDisplayName("图".repeat(200))).toBe("图".repeat(160));
  });
  it("retains batch suffix removal and its existing fallback", () => {
    for (const value of [" 商品.MP3 ", "商品.srt", "商品.zip"]) expect(sanitizeFileName(value)).toBe("商品");
    expect(sanitizeFileName(" ")).toBe("chatterbox-audio");
    expect(sanitizeFileName("...  ")).toBe("chatterbox-audio");
  });
  it("preserves control and forbidden-character replacement without new path rules", () => {
    expect(sanitizeFileName('a"\nb?.srt')).toBe("a--b-");
    expect(sanitizeFileName("../商品.zip")).toBe("..-商品");
    expect(sanitizeFileName("商品. .mp3")).toBe("商品");
  });
  it("keeps the existing 100-code-unit output limit", () => {
    expect(sanitizeFileName(`${"图".repeat(120)}.zip`)).toBe("图".repeat(100));
  });
  it("preserves ASCII fallback and UTF-8 disposition bytes", () => {
    expect(contentDisposition('demo".mp3')).toBe("attachment; filename=\"demo.mp3\"; filename*=UTF-8''demo%22.mp3");
    expect(contentDisposition("参考\n音色.mp3")).toBe(
      `attachment; filename="_____.mp3"; filename*=UTF-8''${encodeURIComponent("参考\n音色.mp3")}`
    );
  });
  it("does not merge online suffix and fallback rules with batch rules", () => {
    expect(sanitizeOnlineName("demo.zip")).toBe("demo.zip");
    expect(sanitizeFileName("demo.zip")).toBe("demo");
    expect(sanitizeOnlineName("")).toBe("edge-tts-audio");
  });
});
