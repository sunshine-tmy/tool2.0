/** Batch cue policy shared by speech engines; single-task subtitle rules remain independent. */
import fsp from "node:fs/promises";
import { srtTimestamp } from "./subtitle-time";

export type TimingSegment = { text: string; startSeconds: number; endSeconds: number };

export async function writeSrt(filePath: string, cues: TimingSegment[]) {
  const content = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${srtTimestamp(cue.startSeconds)} --> ${srtTimestamp(cue.endSeconds)}\n${formatSubtitleCueText(cue.text)}`
    )
    .join("\n\n");
  await fsp.writeFile(filePath, `${content}\n`, "utf8");
}

export function buildBilingualCues(
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

export function buildTranslationCues(
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

export function buildSentenceCues(text: string, durationSeconds: number, segments?: TimingSegment[]): TimingSegment[] {
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
