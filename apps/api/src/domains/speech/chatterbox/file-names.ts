/** Chatterbox-specific names; single-task output suffix rules remain in their adapter. */
import path from "node:path";

export function sanitizeDisplayName(value: string) {
  return (
    path
      .basename(value)
      .replace(/[\r\n]/g, " ")
      .slice(0, 160) || "reference-audio"
  );
}

export function sanitizeBatchFileName(value: string) {
  const base = value.trim().replace(/\.(mp3|srt|zip)$/i, "");
  const printable = Array.from(base, (character) => (character.charCodeAt(0) < 32 ? "-" : character)).join("");
  return (
    printable
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 100) || "chatterbox-audio"
  );
}
