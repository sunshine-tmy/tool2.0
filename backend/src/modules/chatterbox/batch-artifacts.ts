import fs from "node:fs";
import fsp from "node:fs/promises";
import type { FastifyReply } from "fastify";
import {
  fail,
  type ChatterboxBatch,
  type ChatterboxBatchItem,
  type ChatterboxLanguage,
  type ChatterboxSavedVoice
} from "@toolbox/shared";
import type { ChatterboxMediaTools } from "./batch-queue";
import type { ChatterboxBatchStore, StoredVoice } from "./stores";

type TimingSegment = { text: string; startSeconds: number; endSeconds: number };

export async function rebuildBatchAudio(
  store: ChatterboxBatchStore,
  batch: ChatterboxBatch,
  media: ChatterboxMediaTools
) {
  const audioPaths = orderedItems(batch).map((item) => store.itemPaths(batch.id, item.id).audio);
  await media.concatMp3(audioPaths, store.paths(batch.id).combinedAudio);
}

export async function ensureBatchAudio(
  store: ChatterboxBatchStore,
  batch: ChatterboxBatch,
  media: ChatterboxMediaTools
) {
  if (!(await fileExists(store.paths(batch.id).combinedAudio))) await rebuildBatchAudio(store, batch, media);
}

export async function rebuildBatchSubtitles(store: ChatterboxBatchStore, batch: ChatterboxBatch) {
  const sourceCues: TimingSegment[] = [];
  const translationCues: TimingSegment[] = [];
  const bilingualCues: TimingSegment[] = [];
  let offset = 0;
  for (const item of orderedItems(batch)) {
    const duration = item.audioDurationSeconds || 0;
    const timing = await readTiming(store.itemPaths(batch.id, item.id).timing);
    const localCues =
      batch.subtitleMode === "segments"
        ? [{ text: item.text, startSeconds: 0, endSeconds: duration }]
        : buildSentenceCues(item.text, duration, timing);
    sourceCues.push(
      ...localCues.map((cue) => ({
        ...cue,
        startSeconds: cue.startSeconds + offset,
        endSeconds: cue.endSeconds + offset
      }))
    );
    translationCues.push(
      ...buildTranslationCues(localCues, item.referenceTranslation, duration).map((cue) => ({
        ...cue,
        startSeconds: cue.startSeconds + offset,
        endSeconds: cue.endSeconds + offset
      }))
    );
    bilingualCues.push(
      ...buildBilingualCues(localCues, item.text, item.referenceTranslation, duration).map((cue) => ({
        ...cue,
        startSeconds: cue.startSeconds + offset,
        endSeconds: cue.endSeconds + offset
      }))
    );
    offset += duration;
  }
  await writeSrt(store.paths(batch.id).subtitle, sourceCues);
  if (translationCues.length) {
    await Promise.all([
      writeSrt(store.paths(batch.id).translationSubtitle, translationCues),
      writeSrt(store.paths(batch.id).bilingualSubtitle, bilingualCues)
    ]);
  } else {
    await Promise.all([
      fsp.rm(store.paths(batch.id).translationSubtitle, { force: true }),
      fsp.rm(store.paths(batch.id).bilingualSubtitle, { force: true })
    ]);
  }
}

export async function sendBatchAudio(
  store: ChatterboxBatchStore,
  ids: { batchId: string; itemId: string },
  reply: FastifyReply,
  download: boolean
) {
  const batch = store.get(ids.batchId);
  const item = batch?.items.find((entry) => entry.id === ids.itemId);
  if (!batch || !item) return reply.code(404).send(fail("CHATTERBOX_BATCH_ITEM_NOT_FOUND", "文案段不存在"));
  if (!item.audioBytes) return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_NOT_READY", "该文案段还没有可用音频"));
  try {
    const filePath = store.itemPaths(ids.batchId, ids.itemId).audio;
    const stat = await fsp.stat(filePath);
    reply.header("content-type", "audio/mpeg");
    reply.header("content-length", String(stat.size));
    reply.header("x-content-type-options", "nosniff");
    if (download) reply.header("content-disposition", contentDisposition(`${itemDownloadName(item)}.mp3`));
    else reply.header("cache-control", "private, max-age=3600");
    return reply.send(fs.createReadStream(filePath));
  } catch {
    return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "音频不存在或已过期"));
  }
}

export function toPublicBatch(batch: ChatterboxBatch): ChatterboxBatch {
  const result = cloneBatch(batch);
  result.items = result.items.map((item) => {
    if (item.audioBytes) {
      item.audioUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/items/${item.id}/audio`;
      item.downloadUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/items/${item.id}/download`;
    }
    return item;
  });
  if (result.completedItems) result.archiveUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/download.zip`;
  if (result.status === "completed" && result.items.length > 1) {
    result.combinedAudioUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/combined-audio`;
  }
  if (result.status === "completed" && result.includeSubtitles) {
    result.subtitleUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle`;
    if (hasReferenceTranslation(result)) {
      result.translationSubtitleUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle.zh-CN`;
      if (result.items.length > 1) {
        result.bilingualSubtitleUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle.bilingual`;
      }
    }
  }
  return result;
}

export function hasReferenceTranslation(batch: ChatterboxBatch) {
  return batch.items.some((item) => Boolean(item.referenceTranslation?.trim()));
}

export function toPublicVoice(voice: StoredVoice): ChatterboxSavedVoice {
  return { ...voice, audioUrl: `/api/v1/tools/edge-tts/chatterbox/voices/${voice.id}/audio` };
}

export function toBatchSummary(batch: ChatterboxBatch) {
  const { items, ...summary } = toPublicBatch(batch);
  return {
    ...summary,
    itemPreviews: items.map(({ text, ...item }) => {
      delete item.referenceTranslation;
      return {
        ...item,
        textPreview: text.length > 120 ? `${text.slice(0, 120)}…` : text
      };
    })
  };
}

export function orderedItems(batch: ChatterboxBatch) {
  return [...batch.items].sort((a, b) => a.order - b.order);
}

export function itemDownloadName(item: ChatterboxBatchItem) {
  return `${String(item.order).padStart(3, "0")}-${sanitizeFileName(item.fileName || `segment-${item.order}`)}`;
}

export function batchFileName(batch: ChatterboxBatch) {
  return sanitizeFileName(batch.name || `chatterbox-batch-${batch.id}`);
}

export function sourceSubtitleFileName(batch: ChatterboxBatch) {
  const languageName: Record<ChatterboxLanguage, string> = {
    ms: "马来语",
    en: "英语",
    "pt-BR": "巴西葡语"
  };
  return `${languageName[batch.language]}-${subtitleHash(batch)}.srt`;
}

export function translationSubtitleFileName(batch: ChatterboxBatch) {
  return `中文字幕-${subtitleHash(batch)}.srt`;
}

export function bilingualSubtitleFileName(batch: ChatterboxBatch) {
  return `双语字幕-${subtitleHash(batch)}.srt`;
}

export function combinedAudioFileName(batch: ChatterboxBatch) {
  return `总音频-${subtitleHash(batch)}.mp3`;
}

export function buildManifest(batch: ChatterboxBatch) {
  const lines = [
    `批次：${batch.name || batch.id}`,
    `语言：${batch.language}`,
    `状态：${batch.status}`,
    `总时长：${(batch.totalAudioDurationSeconds || 0).toFixed(3)} 秒`,
    ""
  ];
  for (const item of orderedItems(batch)) {
    lines.push(
      `${String(item.order).padStart(3, "0")} | ${item.fileName || `segment-${item.order}`} | ${item.status} | ${(item.audioDurationSeconds || 0).toFixed(3)} 秒`,
      item.text,
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function replaceFile(source: string, target: string) {
  const backup = `${target}.backup`;
  await fsp.rm(backup, { force: true });
  const hadTarget = await fileExists(target);
  if (hadTarget) await fsp.rename(target, backup);
  try {
    await fsp.rename(source, target);
    await fsp.rm(backup, { force: true });
  } catch (error) {
    if (hadTarget && (await fileExists(backup))) await fsp.rename(backup, target);
    throw error;
  }
}

export async function fileExists(filePath: string) {
  return fsp.stat(filePath).then(
    (stat) => stat.isFile(),
    () => false
  );
}

export function sanitizeFileName(value: string) {
  const base = value.trim().replace(/\.(mp3|srt|zip)$/i, "");
  const printable = Array.from(base, (character) => (character.charCodeAt(0) < 32 ? "-" : character)).join("");
  return (
    printable
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 100) || "chatterbox-audio"
  );
}

export function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function writeSrt(filePath: string, cues: TimingSegment[]) {
  const content = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${srtTimestamp(cue.startSeconds)} --> ${srtTimestamp(cue.endSeconds)}\n${formatSubtitleCueText(cue.text)}`
    )
    .join("\n\n");
  await fsp.writeFile(filePath, `${content}\n`, "utf8");
}

function buildBilingualCues(
  cues: TimingSegment[],
  sourceText: string,
  referenceTranslation: string | undefined,
  duration: number
): TimingSegment[] {
  const translation = referenceTranslation?.replace(/\s+/g, " ").trim();
  if (!translation) return cues;
  const translatedSentences = splitSentences(translation);
  if (translatedSentences.length !== cues.length) {
    return [{ text: `${sourceText}\n${translation}`, startSeconds: 0, endSeconds: duration }];
  }
  return cues.map((cue, index) => ({ ...cue, text: `${cue.text}\n${translatedSentences[index]}` }));
}

function formatSubtitleCueText(text: string) {
  return text
    .split("\n")
    .map((line) => wrapSubtitleLines(line))
    .join("\n");
}

function buildTranslationCues(
  cues: TimingSegment[],
  referenceTranslation: string | undefined,
  duration: number
): TimingSegment[] {
  const translation = referenceTranslation?.replace(/\s+/g, " ").trim();
  if (!translation) return [];
  const translatedSentences = splitSentences(translation);
  if (translatedSentences.length !== cues.length) {
    return [{ text: translation, startSeconds: 0, endSeconds: duration }];
  }
  return cues.map((cue, index) => ({ ...cue, text: translatedSentences[index] }));
}

function buildSentenceCues(text: string, durationSeconds: number, segments?: TimingSegment[]): TimingSegment[] {
  const sentences = splitSentences(text);
  const sentenceWeights = sentences.map(textWeight);
  const totalSentenceWeight = sentenceWeights.reduce((sum, weight) => sum + weight, 0);
  const validSegments = validTimingSegments(segments, durationSeconds) ? segments : undefined;
  if (!validSegments) {
    let elapsed = 0;
    return sentences.map((sentence, index) => {
      const startSeconds = (elapsed / totalSentenceWeight) * durationSeconds;
      elapsed += sentenceWeights[index];
      return { text: sentence, startSeconds, endSeconds: (elapsed / totalSentenceWeight) * durationSeconds };
    });
  }
  const segmentWeights = validSegments.map((segment) => textWeight(segment.text));
  const totalSegmentWeight = segmentWeights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = 0;
  return sentences.map((sentence, index) => {
    const startWeight = (elapsed / totalSentenceWeight) * totalSegmentWeight;
    elapsed += sentenceWeights[index];
    const endWeight = (elapsed / totalSentenceWeight) * totalSegmentWeight;
    return {
      text: sentence,
      startSeconds: timingAtWeight(startWeight, "start", validSegments, segmentWeights),
      endSeconds: timingAtWeight(endWeight, "end", validSegments, segmentWeights)
    };
  });
}

function timingAtWeight(target: number, edge: "start" | "end", segments: TimingSegment[], weights: number[]) {
  let elapsed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const next = elapsed + weights[index];
    if (target < next || (edge === "end" && target <= next)) {
      const ratio = Math.max(0, Math.min(1, (target - elapsed) / weights[index]));
      return segments[index].startSeconds + (segments[index].endSeconds - segments[index].startSeconds) * ratio;
    }
    elapsed = next;
  }
  return segments.at(-1)!.endSeconds;
}

function validTimingSegments(segments: TimingSegment[] | undefined, duration: number): segments is TimingSegment[] {
  return Boolean(
    segments?.length &&
    segments.every(
      (segment) =>
        segment.text.trim() &&
        Number.isFinite(segment.startSeconds) &&
        Number.isFinite(segment.endSeconds) &&
        segment.startSeconds >= 0 &&
        segment.endSeconds > segment.startSeconds &&
        segment.endSeconds <= duration + 0.25
    )
  );
}

async function readTiming(filePath: string) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8")) as TimingSegment[];
  } catch {
    return undefined;
  }
}

function splitSentences(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  return normalized.match(/[^.!?。！？;；]+(?:[.!?。！？;；]+|$)/g)?.map((value) => value.trim()) ?? [normalized];
}

function wrapSubtitleLines(text: string, maxCharacters = 38) {
  if (!text.includes(" ")) {
    return text.match(new RegExp(`.{1,${maxCharacters}}`, "gu"))?.join("\n") ?? text;
  }
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxCharacters) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function textWeight(text: string) {
  return Math.max(1, text.replace(/\s+/g, "").length);
}

function srtTimestamp(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(millis, 3)}`;
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}

function subtitleHash(batch: ChatterboxBatch) {
  return batch.id.slice(0, 8);
}

function cloneBatch(batch: ChatterboxBatch): ChatterboxBatch {
  return { ...batch, items: batch.items.map((item) => ({ ...item })) };
}
