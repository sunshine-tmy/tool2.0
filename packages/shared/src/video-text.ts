import { Converter } from "opencc-js";

export type TranscriptCue = {
  index: number;
  startSeconds?: number;
  endSeconds?: number;
  text: string;
};

export type VideoTextStats = {
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  cueCount: number;
  estimatedReadingMinutes: number;
};

export type VideoTextChapter = {
  title: string;
  startSeconds?: number;
  endSeconds?: number;
  summary: string;
};

export type VideoTextTimelineItem = TranscriptCue;

export type VideoTextLowConfidenceSegment = {
  index: number;
  startSeconds?: number;
  endSeconds?: number;
  text: string;
  averageLogProbability?: number;
  noSpeechProbability?: number;
};

export type VideoTextRecognitionQuality = {
  requestedModel?: string;
  model?: string;
  language?: string;
  detectedLanguage?: string;
  languageProbability?: number;
  device?: string;
  computeType?: string;
  averageLogProbability?: number;
  lowConfidenceSegments?: VideoTextLowConfidenceSegment[];
};

export type VideoTextAnalysis = {
  title: string;
  fullText: string;
  segments: VideoTextTimelineItem[];
  timeline: VideoTextTimelineItem[];
  stats: VideoTextStats;
  summary: string[];
  chapters: VideoTextChapter[];
  recognitionQuality?: VideoTextRecognitionQuality;
};

export type AnalyzeVideoTextInput = {
  title?: string;
  transcript: string;
  recognitionQuality?: VideoTextRecognitionQuality;
};

const traditionalToSimplified = Converter({ from: "t", to: "cn" });

export function parseTranscriptCues(transcript: string): TranscriptCue[] {
  const normalized = transcript
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^WEBVTT[^\n]*\n+/i, "")
    .trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const cues: TranscriptCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    let index = cues.length + 1;
    let cursor = 0;

    if (/^\d+$/.test(lines[0])) {
      index = Number(lines[0]);
      cursor = 1;
    } else if (lines.length > 1 && parseTimestampRange(lines[1])) {
      cursor = 1;
    }

    const timestamp = parseTimestampRange(lines[cursor] ?? "");
    if (timestamp) {
      const text = lines.slice(cursor + 1).join(" ").trim();
      if (text) {
        cues.push({
          index,
          startSeconds: timestamp.startSeconds,
          endSeconds: timestamp.endSeconds,
          text: normalizeTranscriptText(text)
        });
      }
      continue;
    }

    const text = lines.slice(cursor).join(" ").trim();
    if (text) {
      cues.push({ index, text: normalizeTranscriptText(text) });
    }
  }

  return cues.length ? cues : [{ index: 1, text: normalizeTranscriptText(normalized) }];
}

export function normalizeTranscriptText(text: string) {
  return normalizeSimplifiedVariants(traditionalToSimplified(text));
}

function normalizeSimplifiedVariants(text: string) {
  return text
    .replace(/不著/g, "不着")
    .replace(/睡著/g, "睡着")
    .replace(/看著/g, "看着")
    .replace(/聽著/g, "听着")
    .replace(/說著/g, "说着")
    .replace(/想著/g, "想着")
    .replace(/拿著/g, "拿着")
    .replace(/跟著/g, "跟着")
    .replace(/等著/g, "等着");
}

export function analyzeVideoText(input: AnalyzeVideoTextInput): VideoTextAnalysis {
  const cues = parseTranscriptCues(input.transcript);
  const fullText = cues.map((cue) => cue.text).join("\n");
  const timeline = cues.map((cue) => ({ ...cue }));

  return {
    title: input.title?.trim() || "未命名视频",
    fullText,
    segments: timeline,
    timeline,
    stats: buildStats(fullText, cues.length),
    summary: buildSummary(fullText),
    chapters: buildChapters(cues),
    recognitionQuality: input.recognitionQuality
  };
}

export function formatSeconds(seconds?: number) {
  if (seconds === undefined || Number.isNaN(seconds)) return "--:--";
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function parseTimestampRange(value: string) {
  const match = value.match(
    /(\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}/
  );
  if (!match) return undefined;
  const [start, end] = value.split(/\s*-->\s*/);
  return {
    startSeconds: parseTimestamp(start),
    endSeconds: parseTimestamp(end)
  };
}

function parseTimestamp(value: string) {
  const cleanValue = value.replace(",", ".").trim().split(/\s+/)[0];
  const parts = cleanValue.split(":");
  const seconds = Number(parts.pop() ?? 0);
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function buildStats(text: string, cueCount: number): VideoTextStats {
  const characterCount = Array.from(text.replace(/\s/g, "")).length;
  const wordCount = tokenize(text).length;
  const sentenceCount = splitSentences(text).length;
  return {
    characterCount,
    wordCount,
    sentenceCount,
    cueCount,
    estimatedReadingMinutes: Math.max(1, Math.ceil(wordCount / 220))
  };
}

function tokenize(text: string) {
  const normalized = text.toLowerCase();
  const latin = normalized.match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
  const chinese = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  return [...latin, ...chinese];
}

function splitSentences(text: string) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildSummary(text: string) {
  const sentences = splitSentences(text);
  if (!sentences.length) return [];
  return sentences.slice(0, 3);
}

function buildChapters(cues: TranscriptCue[]): VideoTextChapter[] {
  if (!cues.length) return [];
  const chunkSize = Math.max(3, Math.ceil(cues.length / 4));
  const chapters: VideoTextChapter[] = [];

  for (let index = 0; index < cues.length; index += chunkSize) {
    const group = cues.slice(index, index + chunkSize);
    const text = group.map((cue) => cue.text).join(" ");
    chapters.push({
      title: `章节 ${chapters.length + 1}`,
      startSeconds: group[0]?.startSeconds,
      endSeconds: group[group.length - 1]?.endSeconds,
      summary: buildSummary(text)[0] ?? text.slice(0, 80)
    });
  }

  return chapters;
}
