/** Owned, bounded media subprocess. Domain adapters retain their own error vocabulary. */
import { spawn } from "node:child_process";
import { terminateChildProcess } from "../../lifecycle/child-process";
type Failure = "canceled" | "timeout" | "unavailable" | "output" | "invalid" | "progress";
export async function runMediaCommand(
  executable: string,
  args: string[],
  signal: AbortSignal,
  options: {
    error: (reason: Failure) => Error;
    timeoutMs?: number;
    captureOutput?: boolean;
    onOutput?: (chunk: string) => void;
  }
) {
  if (signal.aborted) throw options.error("canceled");
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "",
      failure: Error | undefined;
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      void terminateChildProcess(child).catch(() => undefined);
    };
    const abort = () => stop(options.error("canceled"));
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => stop(options.error("timeout")), options.timeoutMs ?? 1800000);
    child.stdout.on("data", (chunk: Buffer) => {
      if (failure) return;
      if (options.captureOutput !== false) output += chunk.toString();
      if (output.length > 1024 * 1024) return stop(options.error("output"));
      try {
        options.onOutput?.(chunk.toString());
      } catch {
        stop(options.error("progress"));
      }
    });
    child.stderr.resume();
    child.once("error", () => {
      failure ??= options.error("unavailable");
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (signal.aborted) reject(options.error("canceled"));
      else if (code !== 0) reject(options.error("invalid"));
      else resolve(output);
    });
    if (signal.aborted) abort();
  });
}
