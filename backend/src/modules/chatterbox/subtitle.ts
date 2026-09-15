import fsp from "node:fs/promises";

type SubtitleTimingSegment = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

export async function writeSubtitle(
  filePath: string,
  text: string,
  durationSeconds: number,
  timingSegments?: SubtitleTimingSegment[]
) {
  const duration = Math.max(0.001, durationSeconds);
  const sentences = splitSubtitleText(text);
  const cues = buildSentenceCues(
    sentences,
    duration,
    validSubtitleSegments(timingSegments, duration) ? timingSegments : undefined
  );

  const content = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${srtTimestamp(cue.startSeconds)} --> ${srtTimestamp(cue.endSeconds)}\n${wrapSubtitleLines(cue.text)}`
    )
    .join("\n\n");
  await fsp.writeFile(filePath, `${content}\n`, "utf8");
}

export async function repairLegacySubtitle(filePath: string, text: string, durationSeconds: number) {
  const expectedSentences = splitSubtitleText(text);
  try {
    const current = await fsp.readFile(filePath, "utf8");
    const currentCues = parseSrtCueTexts(current);
    const alreadySentenceBased =
      currentCues.length === expectedSentences.length &&
      currentCues.every((cue, index) => normalizeSubtitleText(cue) === normalizeSubtitleText(expectedSentences[index]));
    if (alreadySentenceBased) return;
  } catch {
    return;
  }
  await writeSubtitle(filePath, text, durationSeconds);
}

function buildSentenceCues(
  sentences: string[],
  durationSeconds: number,
  timingSegments?: SubtitleTimingSegment[]
): SubtitleTimingSegment[] {
  const sentenceWeights = sentences.map(subtitleWeight);
  const totalSentenceWeight = sentenceWeights.reduce((sum, weight) => sum + weight, 0);

  if (!timingSegments?.length) {
    let elapsedWeight = 0;
    return sentences.map((sentence, index) => {
      const startSeconds = (elapsedWeight / totalSentenceWeight) * durationSeconds;
      elapsedWeight += sentenceWeights[index];
      return {
        text: sentence,
        startSeconds,
        endSeconds: (elapsedWeight / totalSentenceWeight) * durationSeconds
      };
    });
  }

  const segmentWeights = timingSegments.map((segment) => subtitleWeight(segment.text));
  const totalSegmentWeight = segmentWeights.reduce((sum, weight) => sum + weight, 0);
  let elapsedSentenceWeight = 0;
  return sentences.map((sentence, index) => {
    const scaledStartWeight = (elapsedSentenceWeight / totalSentenceWeight) * totalSegmentWeight;
    elapsedSentenceWeight += sentenceWeights[index];
    const scaledEndWeight = (elapsedSentenceWeight / totalSentenceWeight) * totalSegmentWeight;
    return {
      text: sentence,
      startSeconds: timingAtTextWeight(scaledStartWeight, "start", timingSegments, segmentWeights),
      endSeconds: timingAtTextWeight(scaledEndWeight, "end", timingSegments, segmentWeights)
    };
  });
}

function timingAtTextWeight(
  targetWeight: number,
  edge: "start" | "end",
  segments: SubtitleTimingSegment[],
  weights: number[]
) {
  let elapsedWeight = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segmentWeight = weights[index];
    const nextWeight = elapsedWeight + segmentWeight;
    if (targetWeight < nextWeight || (edge === "end" && targetWeight <= nextWeight)) {
      const ratio = Math.max(0, Math.min(1, (targetWeight - elapsedWeight) / segmentWeight));
      return segment.startSeconds + (segment.endSeconds - segment.startSeconds) * ratio;
    }
    elapsedWeight = nextWeight;
  }
  return segments.at(-1)!.endSeconds;
}

function parseSrtCueTexts(content: string) {
  return content
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).slice(2).join(" ").trim())
    .filter(Boolean);
}

function validSubtitleSegments(
  segments: SubtitleTimingSegment[] | undefined,
  durationSeconds: number
): segments is SubtitleTimingSegment[] {
  return Boolean(
    segments?.length &&
    segments.every(
      (segment) =>
        segment.text.trim() &&
        Number.isFinite(segment.startSeconds) &&
        Number.isFinite(segment.endSeconds) &&
        segment.startSeconds >= 0 &&
        segment.endSeconds > segment.startSeconds &&
        segment.endSeconds <= durationSeconds + 0.25
    )
  );
}

function splitSubtitleText(text: string) {
  const normalized = normalizeSubtitleText(text);
  if (!normalized) return [""];
  return normalized.match(/[^.!?。！？;；]+(?:[.!?。！？;；]+|$)/g)?.map((value) => value.trim()) ?? [normalized];
}

function normalizeSubtitleText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function wrapSubtitleLines(text: string, maxLineCharacters = 38) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxLineCharacters) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function subtitleWeight(text: string) {
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
