// Storage failures fall back to this window's memory; no backend or telemetry is used.
const memory = new Map<string, unknown>();
export function readLocal(key: string): unknown {
  if (memory.has(key)) return memory.get(key);
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const parsed: unknown = JSON.parse(value);
      memory.set(key, parsed);
      return parsed;
    }
  } catch {
    /* Local persistence is optional. */
  }
  return memory.get(key);
}
export function writeLocal(key: string, value: unknown) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep the session copy. */
  }
}
export type GuideProgress = { version: number; step: string; completed: boolean };
export function readProgress(id: string, version: number): GuideProgress | undefined {
  const value = readLocal(`toolbox:onboarding:${id}`) as GuideProgress | undefined;
  return value?.version === version && typeof value.step === "string" && typeof value.completed === "boolean"
    ? value
    : undefined;
}
export function writeProgress(id: string, progress: GuideProgress) {
  writeLocal(`toolbox:onboarding:${id}`, progress);
}
