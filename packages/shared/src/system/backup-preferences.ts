/** Portable, explicit client preference allowlist. No origins, session tokens or browser profile data. */
export const backupPreferenceKeys = ["archive.view", "audio.lastGroup", "audio.recentGroups", "audio.player"] as const;
export function cleanBackupPreferences(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      !backupPreferenceKeys.includes(key as (typeof backupPreferenceKeys)[number]) ||
      typeof value !== "string" ||
      value.length > 500000
    )
      continue;
    try {
      if (key === "archive.view" && ["card", "list"].includes(value)) result[key] = value;
      if (key === "audio.lastGroup" && /^[A-Za-z0-9_-]{1,128}$/.test(value)) result[key] = value;
      if (key === "audio.recentGroups") {
        const ids: unknown = JSON.parse(value);
        if (
          Array.isArray(ids) &&
          ids.length <= 5 &&
          ids.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id))
        )
          result[key] = JSON.stringify(ids);
      }
      if (key === "audio.player") {
        const p = JSON.parse(value) as Record<string, unknown>;
        if (!p || !Array.isArray(p.queue) || p.queue.length > 200) continue;
        const queue = p.queue
          .filter(
            (entry: unknown) =>
              entry &&
              typeof entry === "object" &&
              typeof (entry as Record<string, unknown>).itemId === "string" &&
              typeof (entry as Record<string, unknown>).entryId === "string"
          )
          .map((entry: Record<string, string>) => ({
            itemId: entry.itemId.slice(0, 128),
            entryId: entry.entryId.slice(0, 128)
          }));
        result[key] = JSON.stringify({
          queue,
          currentId: typeof p.currentId === "string" ? p.currentId.slice(0, 128) : "",
          position: typeof p.position === "number" && Number.isFinite(p.position) ? Math.max(0, p.position) : 0,
          mode: ["sequence", "list", "single"].includes(String(p.mode)) ? p.mode : "sequence",
          gap: typeof p.gap === "number" && Number.isFinite(p.gap) ? Math.max(0, Math.min(300, p.gap)) : 1,
          volume: typeof p.volume === "number" && Number.isFinite(p.volume) ? Math.max(0, Math.min(1, p.volume)) : 1
        });
      }
    } catch {
      /* A damaged preference never grants access or makes a business backup unreadable. */
    }
  }
  return result;
}
