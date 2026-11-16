import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { guardBackendProcess, waitForGuard, windowsGuardScript } from "./process-guard";

const windows = process.platform === "win32";
const macOS = process.platform === "darwin";
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
function identity(pid: number) {
  try {
    return execFileSync("/bin/ps", ["-p", String(pid), "-o", "lstart=", "-o", "comm="], {
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "C" }
    }).trim();
  } catch {
    return undefined;
  }
}
async function goneByIdentity(pid: number, previousIdentity: string) {
  for (let n = 0; n < 100 && identity(pid) === previousIdentity; n++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  expect(identity(pid)).not.toBe(previousIdentity);
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
function macOSProcessTree() {
  return spawn(
    process.execPath,
    [
      "-e",
      `
    const {spawn} = require('node:child_process');
    process.stdin.once('data', () => {
      const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio:'ignore'});
      console.log(child.pid);
    });
    setInterval(()=>{},1000);
  `
    ],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true }
  );
}
function macOSRealWorkerProcessTree(children: Array<{ command: string; args: string[] }>) {
  return spawn(
    process.execPath,
    [
      "-e",
      `
    const {spawn} = require('node:child_process');
    process.stdin.once('data', () => {
      const specs = JSON.parse(process.env.TOOLBOX_M06_REAL_CHILDREN_JSON || '[]');
      Promise.all(specs.map((spec) => new Promise((resolve, reject) => {
        const child = spawn(spec.command, spec.args, {stdio:'ignore'});
        child.once('spawn', () => resolve(child.pid));
        child.once('error', reject);
      }))).then((pids) => console.log(JSON.stringify(pids))).catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    });
    setInterval(()=>{},1000);
  `
    ],
    {
      env: { ...process.env, TOOLBOX_M06_REAL_CHILDREN_JSON: JSON.stringify(children) },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    }
  );
}
async function descendant(root: ChildProcessWithoutNullStreams) {
  const output = once(root.stdout, "data");
  root.stdin.write("spawn\n");
  return Number(String((await output)[0]).trim());
}
async function descendants(root: ChildProcessWithoutNullStreams) {
  const output = once(root.stdout, "data");
  root.stdin.write("spawn\n");
  const [chunk] = (await output) as [Buffer];
  const pids = JSON.parse(String(chunk)) as number[];
  return pids;
}
function ownedProcessIdentities(rootPid: number) {
  const output = execFileSync("/bin/ps", ["-axo", "pid=", "-o", "ppid=", "-o", "lstart=", "-o", "comm="], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" }
  });
  const processes = output.split(/\r?\n/).flatMap((line) => {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 8 || !/^\d+$/.test(fields[0]) || !/^\d+$/.test(fields[1])) return [];
    const pid = Number(fields[0]);
    const ppid = Number(fields[1]);
    const identity = `${fields.slice(2, 7).join(" ")} ${fields.slice(7).join(" ")}`;
    return [{ pid, ppid, identity }];
  });
  const byParent = new Map<number, Array<{ pid: number; ppid: number; identity: string }>>();
  for (const child of processes) {
    const children = byParent.get(child.ppid) ?? [];
    children.push(child);
    byParent.set(child.ppid, children);
  }
  const owned: Array<{ pid: number; identity: string }> = [];
  const queue = [rootPid];
  while (queue.length) {
    for (const child of byParent.get(queue.shift()!) ?? []) {
      owned.push({ pid: child.pid, identity: child.identity });
      queue.push(child.pid);
    }
  }
  return owned;
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

  it.skipIf(!macOS)(
    "reaps only the owned macOS process tree after its owner disappears",
    async () => {
      const root = macOSProcessTree();
      const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        stdio: "ignore",
        windowsHide: true
      });
      let childPid: number | undefined;
      let childIdentity: string | undefined;
      let guard: Awaited<ReturnType<typeof guardBackendProcess>>;
      try {
        guard = await guardBackendProcess(root.pid!);
        childPid = await descendant(root);
        expect(alive(childPid)).toBe(true);
        childIdentity = identity(childPid);
        expect(childIdentity).toBeTruthy();
        await new Promise((resolve) => setTimeout(resolve, 1_250));
        const exit = once(root, "exit");
        root.kill("SIGKILL");
        await exit;
        expect(await guard!.close()).toEqual({ forced: true });
        await goneByIdentity(childPid, childIdentity!);
        expect(alive(unrelated.pid!)).toBe(true);
      } finally {
        root.kill();
        unrelated.kill();
        await guard?.close().catch(() => undefined);
        if (childPid && childIdentity && identity(childPid) === childIdentity) process.kill(childPid);
      }
    },
    30_000
  );

  it.skipIf(
    !macOS || !process.env.TOOLBOX_M06_PYTHON || !process.env.TOOLBOX_M06_FFMPEG || !process.env.TOOLBOX_M06_CHROMIUM
  )(
    "reaps real Python, FFmpeg and Chromium descendants after the owned root exits",
    async () => {
      const profileRoot = mkdtempSync(path.join(os.tmpdir(), "toolbox-m06-chromium-profile-"));
      const python = process.env.TOOLBOX_M06_PYTHON!;
      const ffmpeg = process.env.TOOLBOX_M06_FFMPEG!;
      const chromium = process.env.TOOLBOX_M06_CHROMIUM!;
      const root = macOSRealWorkerProcessTree([
        { command: python, args: ["-I", "-B", "-c", "import time; time.sleep(300)"] },
        {
          command: ffmpeg,
          args: [
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-re",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=64x64:rate=1",
            "-f",
            "null",
            "-"
          ]
        },
        {
          command: chromium,
          args: [
            "--headless=new",
            "--disable-gpu",
            "--disable-background-networking",
            "--no-first-run",
            "--user-data-dir=" + profileRoot,
            "about:blank"
          ]
        }
      ]);
      const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        stdio: "ignore",
        windowsHide: true
      });
      let workerPids: number[] = [];
      let workerIdentities: Array<{ pid: number; identity: string }> = [];
      let guard: Awaited<ReturnType<typeof guardBackendProcess>>;
      let unrelatedIdentity: string | undefined;
      try {
        guard = await guardBackendProcess(root.pid!);
        workerPids = await descendants(root);
        expect(workerPids).toHaveLength(3);
        unrelatedIdentity = identity(unrelated.pid!);
        expect(unrelatedIdentity).toBeTruthy();
        for (const pid of workerPids) expect(identity(pid)).toBeTruthy();
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        workerIdentities = ownedProcessIdentities(root.pid!);
        expect(workerIdentities.some(({ pid }) => workerPids.includes(pid))).toBe(true);

        const rootExit = once(root, "exit");
        root.kill("SIGKILL");
        await rootExit;
        expect(await guard!.close()).toEqual({ forced: true });
        await Promise.all(workerIdentities.map(({ pid, identity }) => goneByIdentity(pid, identity)));
        expect(alive(unrelated.pid!)).toBe(true);
        expect(identity(unrelated.pid!)).toBe(unrelatedIdentity);
      } finally {
        root.kill();
        unrelated.kill();
        await guard?.close().catch(() => undefined);
        for (const entry of workerIdentities) {
          if (identity(entry.pid) === entry.identity) process.kill(entry.pid, "SIGKILL");
        }
        const resolvedProfile = realpathSync(profileRoot);
        expect(path.dirname(resolvedProfile)).toBe(realpathSync(os.tmpdir()));
        expect(path.basename(resolvedProfile)).toMatch(/^toolbox-m06-chromium-profile-/);
        rmSync(resolvedProfile, { recursive: true, force: true });
      }
    },
    45_000
  );
});
