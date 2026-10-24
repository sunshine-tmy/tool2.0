import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { guardBackendProcess, waitForGuard, windowsGuardScript } from "./process-guard";

const windows = process.platform === "win32";
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function gone(pid: number) {
  for (let n = 0; n < 40 && alive(pid); n++) await new Promise((resolve) => setTimeout(resolve, 50));
  expect(alive(pid)).toBe(false);
}
function target() {
  return spawn(
    process.execPath,
    [
      "-e",
      `
    const {spawn} = require('node:child_process');
    process.stdin.once('data', () => {
      const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio:'ignore', detached:true});
      child.unref();
      console.log(child.pid);
    });
    setInterval(()=>{},1000);
  `
    ],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true }
  );
}
async function descendant(root: ChildProcessWithoutNullStreams) {
  const output = once(root.stdout, "data");
  root.stdin.write("spawn\n");
  return Number(String((await output)[0]).trim());
}
function helper(pid: number) {
  return spawn(
    path.join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(windowsGuardScript(pid), "utf16le").toString("base64")
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
  );
}

describe("desktop process guard", () => {
  it("only accepts an owned numeric process identifier", () => {
    expect(() => windowsGuardScript(0)).toThrow();
    expect(() => windowsGuardScript(NaN)).toThrow();
    expect(windowsGuardScript(123)).toContain("AssignProcessToJobObject");
    expect(windowsGuardScript(123)).not.toContain("Get-Process");
  });
  it.skipIf(!windows)(
    "reaps an orphan descendant after the root exits, without touching an unrelated process",
    async () => {
      const root = target();
      const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        stdio: "ignore",
        windowsHide: true
      });
      let childPid: number | undefined;
      let guard: Awaited<ReturnType<typeof guardBackendProcess>>;
      try {
        guard = await guardBackendProcess(root.pid!);
        childPid = await descendant(root);
        expect(alive(childPid)).toBe(true);
        const exit = once(root, "exit");
        root.kill();
        await exit;
        expect(await guard!.close()).toEqual({ forced: true });
        await gone(childPid);
        expect(alive(unrelated.pid!)).toBe(true);
      } finally {
        root.kill();
        unrelated.kill();
        await guard?.close().catch(() => undefined);
        if (childPid && alive(childPid)) process.kill(childPid);
      }
    },
    30_000
  );

  it.skipIf(!windows)(
    "pipe EOF (including a crashed desktop owner) kills the entire owned job",
    async () => {
      const root = target();
      const worker = helper(root.pid!);
      let childPid: number | undefined;
      try {
        const guard = await waitForGuard(worker);
        childPid = await descendant(root);
        worker.stdin.end();
        // close() also waits for the STOPPED acknowledgement and OS-confirmed empty job.
        expect((await guard.close()).forced).toBe(true);
        await gone(root.pid!);
        await gone(childPid);
      } finally {
        worker.stdin.end();
        root.kill();
        if (childPid && alive(childPid)) process.kill(childPid);
      }
    },
    30_000
  );
});
