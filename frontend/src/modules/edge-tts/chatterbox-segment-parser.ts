type ParsedChatterboxSegment = {
  text: string;
  referenceTranslation: string;
};

const numberedLinePattern = /^\s*(?:\d{1,3}[.、)]|[（(]\d{1,3}[）)])\s*/gm;
const hanPattern = /\p{Script=Han}/u;

export function parseChatterboxSegments(input: string): ParsedChatterboxSegment[] {
  const normalized = normalizeInput(input);
  if (!normalized) return [];

  const numberedBlocks = splitNumberedBlocks(normalized);
  if (numberedBlocks.length) return parseBlocks(numberedBlocks);

  const blankLineBlocks = normalized.split(/\n\s*\n+/).filter(Boolean);
  if (blankLineBlocks.length > 1) return parseBlocks(blankLineBlocks);

  const alternatingSegments = parseAlternatingBilingualLines(normalized);
  if (alternatingSegments.length > 1) return alternatingSegments;

  return parseBlocks([normalized]);
}

function parseBlocks(blocks: string[]) {
  return blocks.map(parseBlock).filter((segment): segment is ParsedChatterboxSegment => Boolean(segment?.text));
}

function normalizeInput(input: string) {
  return decodeHtmlEntities(input)
    .replace(/\r\n?/g, "\n")
    .replace(/\\[ \t]*\n/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:p|div)>/gi, "\n")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
}

function splitNumberedBlocks(input: string) {
  const matches = [...input.matchAll(numberedLinePattern)];
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const start = (match.index || 0) + match[0].length;
      const end = matches[index + 1]?.index ?? input.length;
      return input.slice(start, end).trim();
    })
    .filter(Boolean);
}

function parseBlock(block: string): ParsedChatterboxSegment | undefined {
  const lines = cleanLines(block);
  if (!lines.length) return undefined;

  const translationStart = lines.findIndex((line) => hanPattern.test(line));
  if (translationStart <= 0) {
    return {
      text: lines.join(" ").trim(),
      referenceTranslation: ""
    };
  }

  return {
    text: lines.slice(0, translationStart).join(" ").trim(),
    referenceTranslation: lines.slice(translationStart).join("").trim()
  };
}

function parseAlternatingBilingualLines(block: string): ParsedChatterboxSegment[] {
  const lines = cleanLines(block);
  if (!lines.some((line) => hanPattern.test(line)) || !lines.some((line) => !hanPattern.test(line))) return [];

  const segments: ParsedChatterboxSegment[] = [];
  let sourceLines: string[] = [];
  let translationLines: string[] = [];

  const commit = () => {
    const text = sourceLines.join(" ").trim();
    if (text) {
      segments.push({
        text,
        referenceTranslation: translationLines.join("").trim()
      });
    }
    sourceLines = [];
    translationLines = [];
  };

  for (const line of lines) {
    if (hanPattern.test(line)) {
      if (sourceLines.length) translationLines.push(line);
      continue;
    }
    if (sourceLines.length && translationLines.length) commit();
    sourceLines.push(line);
  }
  commit();

  return segments;
}

function cleanLines(block: string) {
  return block.split("\n").map(cleanLine).filter(Boolean);
}

function cleanLine(line: string) {
  return line
    .trim()
    .replace(/^>\s*/, "")
    .replace(/^[-+*]\s+/, "")
    .replace(/^(?:\*\*|__)([\s\S]*)(?:\*\*|__)$/, "$1")
    .replace(/^`([\s\S]*)`$/, "$1")
    .trim();
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, value: string) => {
      const hexadecimal = value[0].toLowerCase() === "x";
      const codePoint = Number.parseInt(hexadecimal ? value.slice(1) : value, hexadecimal ? 16 : 10);
      try {
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
      } catch {
        return "";
      }
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}
