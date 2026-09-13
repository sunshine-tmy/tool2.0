import fs from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  CHATTERBOX_LANGUAGES,
  CHATTERBOX_MAX_BATCH_SEGMENTS,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  CHATTERBOX_MAX_TEXT_LENGTH,
  type ChatterboxLanguage,
  type ChatterboxSubtitleMode,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import { BatchInputError } from "./errors";
import type { BatchCreateInput, BatchSegmentInput } from "./stores";

export async function receiveBatchMultipart(
  parts: AsyncIterableIterator<import("@fastify/multipart").Multipart>,
  targetPath: string,
  requireFile: boolean
) {
  const fields: Record<string, string> = {};
  let referenceFileName = "";
  let receivedFile = false;
  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname !== "reference" || receivedFile) {
        part.file.resume();
        throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "请只上传一个参考音频", 400);
      }
      receivedFile = true;
      referenceFileName = sanitizeDisplayName(part.filename || "reference-audio");
      let bytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          callback(
            bytes > CHATTERBOX_MAX_REFERENCE_BYTES
              ? new BatchInputError("CHATTERBOX_REFERENCE_TOO_LARGE", "参考音频不能超过 20 MB", 413)
              : null,
            chunk
          );
        }
      });
      await pipeline(part.file, limiter, fs.createWriteStream(targetPath));
      if (part.file.truncated) throw new BatchInputError("CHATTERBOX_REFERENCE_TOO_LARGE", "参考音频过大", 413);
    } else if (
      typeof part.value === "string" &&
      part.value.length <=
        CHATTERBOX_MAX_BATCH_TEXT_LENGTH +
          CHATTERBOX_MAX_BATCH_SEGMENTS * CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH +
          20_000
    ) {
      fields[part.fieldname] = part.value;
    }
  }
  if (requireFile && !receivedFile) throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "请上传参考音频", 400);
  return { fields, referenceFileName, receivedFile };
}

export function parseBatchFields(
  fields: Record<string, string>,
  referenceFileName: string
):
  | { success: true; value: Omit<BatchCreateInput, "referenceDurationSeconds"> }
  | { success: false; statusCode: number; code: string; message: string } {
  let rawSegments: unknown;
  try {
    rawSegments = JSON.parse(fields.segments || "[]");
  } catch {
    return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", "多段文案格式无效");
  }
  if (!Array.isArray(rawSegments) || !rawSegments.length || rawSegments.length > CHATTERBOX_MAX_BATCH_SEGMENTS) {
    return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", `批次需要 1–${CHATTERBOX_MAX_BATCH_SEGMENTS} 段文案`);
  }
  const segments: BatchSegmentInput[] = [];
  for (const raw of rawSegments) {
    if (!isRecord(raw) || typeof raw.text !== "string")
      return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", "文案段格式无效");
    const text = raw.text.trim();
    if (!text || text.length > CHATTERBOX_MAX_TEXT_LENGTH) {
      return invalid("CHATTERBOX_TEXT_TOO_LONG", `每段文案必须为 1–${CHATTERBOX_MAX_TEXT_LENGTH} 个字符`, 413);
    }
    if (raw.referenceTranslation !== undefined && typeof raw.referenceTranslation !== "string") {
      return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", "中文参考翻译格式无效");
    }
    const referenceTranslation =
      typeof raw.referenceTranslation === "string" ? raw.referenceTranslation.trim() : undefined;
    if (referenceTranslation && referenceTranslation.length > CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH) {
      return invalid(
        "CHATTERBOX_REFERENCE_TRANSLATION_TOO_LONG",
        `中文参考翻译不能超过 ${CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH} 个字符`,
        413
      );
    }
    segments.push({
      text,
      referenceTranslation: referenceTranslation || undefined,
      fileName: typeof raw.fileName === "string" && raw.fileName.trim() ? sanitizeFileName(raw.fileName) : undefined
    });
  }
  if (segments.reduce((sum, segment) => sum + segment.text.length, 0) > CHATTERBOX_MAX_BATCH_TEXT_LENGTH) {
    return invalid(
      "CHATTERBOX_BATCH_TEXT_TOO_LONG",
      `整个批次不能超过 ${CHATTERBOX_MAX_BATCH_TEXT_LENGTH} 个字符`,
      413
    );
  }
  if (!isLanguage(fields.language)) return invalid("CHATTERBOX_LANGUAGE_INVALID", "仅支持马来语、英语或巴西葡萄牙语");
  if (!isAuthorization(fields.authorization)) return invalid("CHATTERBOX_AUTHORIZATION_REQUIRED", "请选择声音授权来源");
  if (fields.consentConfirmed !== "true")
    return invalid("CHATTERBOX_CONSENT_REQUIRED", "必须确认已获得参考声音的合法授权");
  const exaggeration = boundedNumber(fields.exaggeration, 0.25, 1.5);
  const cfgWeight = boundedNumber(fields.cfgWeight, 0, 1);
  const temperature = boundedNumber(fields.temperature, 0.1, 1.5);
  const seed = boundedInteger(fields.seed, 0, 2_147_483_647);
  if (exaggeration === undefined || cfgWeight === undefined || temperature === undefined || seed === undefined) {
    return invalid("CHATTERBOX_PARAMETER_INVALID", "声音克隆参数超出允许范围");
  }
  return {
    success: true,
    value: {
      segments,
      name: fields.name ? sanitizeFileName(fields.name) : undefined,
      language: fields.language,
      referenceFileName,
      referenceRetained: fields.referenceRetained === "true",
      authorization: fields.authorization,
      consentConfirmed: true,
      exaggeration,
      cfgWeight,
      temperature,
      seed,
      includeSubtitles: fields.includeSubtitles === "true",
      subtitleMode: isSubtitleMode(fields.subtitleMode) ? fields.subtitleMode : "sentences"
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLanguage(value: unknown): value is ChatterboxLanguage {
  return typeof value === "string" && (CHATTERBOX_LANGUAGES as readonly string[]).includes(value);
}

function isAuthorization(value: unknown): value is ChatterboxVoiceAuthorization {
  return value === "self" || value === "authorized";
}

function isSubtitleMode(value: unknown): value is ChatterboxSubtitleMode {
  return value === "sentences" || value === "segments";
}

function boundedNumber(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function invalid(code: string, message: string, statusCode = 400) {
  return { success: false as const, code, message, statusCode };
}

function sanitizeDisplayName(value: string) {
  return (
    path
      .basename(value)
      .replace(/[\r\n]/g, " ")
      .slice(0, 160) || "reference-audio"
  );
}

function sanitizeFileName(value: string) {
  const base = value.trim().replace(/\.(mp3|srt|zip)$/i, "");
  const printable = Array.from(base, (character) => (character.charCodeAt(0) < 32 ? "-" : character)).join("");
  return (
    printable
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 100) || "chatterbox-audio"
  );
}
