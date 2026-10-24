/** Consume bounded installer output; expose only fixed stages and names from the signed lock. */
import type { ComponentPythonBuildProgress } from "@toolbox/shared";

export function createPythonBuildProgress(lock: string, report: (value: ComponentPythonBuildProgress) => void) {
  const normalize = (name: string) => name.toLowerCase().replace(/[._-]+/g, "-");
  const allowed = new Set(
    [...lock.matchAll(/^\s*([A-Za-z0-9][A-Za-z0-9._-]{0,99})==/gm)].map((match) => normalize(match[1]))
  );
  const prepared = new Set<string>();
  let value: ComponentPythonBuildProgress = {
    step: "check-base",
    completedSteps: 0,
    totalSteps: 5,
    preparedDependencies: 0,
    totalDependencies: allowed.size,
    activity: "preparing"
  };
  let buffer = "";
  let lastEmission = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const emit = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    lastEmission = Date.now();
    report({ ...value });
  };
  const line = (text: string) => {
    // Never relay the original line, paths, URLs, credentials or unknown package names.
    if (text.startsWith("Installing collected packages:")) value.activity = "installing";
    if (!text.startsWith("Processing ")) return;
    const filename = text.trim().split(/[\\/]/).at(-1) ?? "";
    if (!filename.endsWith(".whl")) return;
    const name = normalize(filename.split("-")[0]);
    if (!allowed.has(name)) return;
    prepared.add(name);
    value.currentDependency = name;
    value.preparedDependencies = prepared.size;
  };
  return {
    step(step: ComponentPythonBuildProgress["step"]) {
      buffer = "";
      value = { ...value, step, activity: "preparing", currentDependency: undefined, lastOutputAt: undefined };
      emit();
    },
    output(chunk: string) {
      value.lastOutputAt = new Date().toISOString();
      if (value.step === "install-dependencies") {
        // Keep at most one bounded line; a malicious/unknown long line cannot accumulate.
        for (const piece of chunk.split(/(?<=\n)/)) {
          buffer = (buffer + piece).slice(0, 4096);
          if (piece.endsWith("\n")) {
            line(buffer.replace(/[\r\n]+$/, ""));
            buffer = "";
          }
        }
      }
      if (Date.now() - lastEmission >= 1000) emit();
      else if (!timer) {
        timer = setTimeout(emit, 1000 - (Date.now() - lastEmission));
        timer.unref();
      }
    },
    completeStep() {
      if (buffer) {
        line(buffer);
        buffer = "";
      }
      value.completedSteps += 1;
      emit();
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    }
  };
}
