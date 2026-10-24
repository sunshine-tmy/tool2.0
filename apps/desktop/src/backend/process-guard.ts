/** Windows Job Object：只约束本次启动的后端及其后代；主进程崩溃后管道 EOF 也会清理。 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

export interface ProcessGuard {
  close(): Promise<{ forced: boolean }>;
}

export function windowsGuardScript(pid: number) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("无效的后端进程标识");
  return `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ToolboxJob {
  [StructLayout(LayoutKind.Sequential)] public struct BasicLimit {
    public long ProcessTime, JobTime; public uint Flags; public UIntPtr MinWorking, MaxWorking;
    public uint ActiveLimit; public UIntPtr Affinity; public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] public struct Io {
    public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes;
  }
  [StructLayout(LayoutKind.Sequential)] public struct ExtendedLimit {
    public BasicLimit Basic; public Io IoInfo;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [StructLayout(LayoutKind.Sequential)] public struct Accounting {
    public long UserTime, KernelTime, PeriodUser, PeriodKernel;
    public uint Faults, Total, Active, Terminated;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr CreateJobObject(IntPtr attrs, string name);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimit info, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool QueryInformationJobObject(IntPtr job, int infoClass, out Accounting info, uint length, IntPtr returned);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
}
'@
$job = [ToolboxJob]::CreateJobObject([IntPtr]::Zero, $null)
if ($job -eq [IntPtr]::Zero) { throw 'JOB_CREATE_FAILED' }
try {
  $limits = New-Object ToolboxJob+ExtendedLimit
  $limits.Basic.Flags = 0x2000
  if (-not [ToolboxJob]::SetInformationJobObject($job, 9, [ref]$limits, [Runtime.InteropServices.Marshal]::SizeOf($limits))) { throw 'JOB_LIMIT_FAILED' }
  $target = [ToolboxJob]::OpenProcess(0x0101, $false, ${pid})
  if ($target -eq [IntPtr]::Zero) { throw 'JOB_PROCESS_FAILED' }
  try {
    if (-not [ToolboxJob]::AssignProcessToJobObject($job, $target)) { throw 'JOB_ASSIGN_FAILED' }
  } finally { [void][ToolboxJob]::CloseHandle($target) }
  [Console]::Out.WriteLine('READY'); [Console]::Out.Flush()
  # 主进程持有唯一的 stdin 写端。正常退出发送 close；主进程异常结束则读到 EOF。
  [void][Console]::In.ReadLine()
  $accounting = New-Object ToolboxJob+Accounting
  if (-not [ToolboxJob]::QueryInformationJobObject($job, 1, [ref]$accounting, [Runtime.InteropServices.Marshal]::SizeOf($accounting), [IntPtr]::Zero)) { throw 'JOB_QUERY_FAILED' }
  $forced = $accounting.Active -gt 0
  if ($forced -and -not [ToolboxJob]::TerminateJobObject($job, 1)) { throw 'JOB_TERMINATE_FAILED' }
  $deadline = [DateTime]::UtcNow.AddSeconds(8)
  do {
    if (-not [ToolboxJob]::QueryInformationJobObject($job, 1, [ref]$accounting, [Runtime.InteropServices.Marshal]::SizeOf($accounting), [IntPtr]::Zero)) { throw 'JOB_QUERY_FAILED' }
    if ($accounting.Active -eq 0) { break }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  if ($accounting.Active -ne 0) { throw 'JOB_EXIT_TIMEOUT' }
  if ($forced) { [Console]::Out.WriteLine('STOPPED_FORCED') } else { [Console]::Out.WriteLine('STOPPED') }
  [Console]::Out.Flush()
} finally { [void][ToolboxJob]::CloseHandle($job) }
`;
}

export async function guardBackendProcess(pid: number): Promise<ProcessGuard | undefined> {
  if (process.platform !== "win32") return undefined;
  const executable = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
  const child = spawn(
    executable,
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(windowsGuardScript(pid), "utf16le").toString("base64")
    ],
    {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  return waitForGuard(child);
}

export async function waitForGuard(child: ChildProcessWithoutNullStreams): Promise<ProcessGuard> {
  let output = "";
  let ready = false;
  let stopped: "STOPPED" | "STOPPED_FORCED" | undefined;
  let closing: Promise<{ forced: boolean }> | undefined;
  // 不保存 PowerShell 输出（可能含本机路径）；只读取固定协议行，持续消费 stderr。
  child.stderr.on("data", () => undefined);
  child.stdin.on("error", () => undefined);
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const startup = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const exit = new Promise<boolean>((resolve) => {
    child.once("error", () => {
      rejectReady(new Error("无法启动退出保护进程"));
      resolve(false);
    });
    child.once("close", (code) => {
      if (!ready) rejectReady(new Error("无法建立桌面子进程退出保护"));
      resolve(code === 0);
    });
  });
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    const lines = output.split(/\r?\n/);
    output = lines.pop()!.slice(-256);
    for (const line of lines) {
      if (line === "READY") {
        ready = true;
        resolveReady();
      }
      if (line === "STOPPED" || line === "STOPPED_FORCED") stopped = line;
    }
  });
  const timer = setTimeout(() => rejectReady(new Error("建立桌面子进程退出保护超时")), 15_000);
  try {
    await startup;
  } catch (error) {
    child.stdin.end();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return {
    close() {
      return (closing ??= (async () => {
        child.stdin.end("close\n");
        let timeout: NodeJS.Timeout | undefined;
        const success = await Promise.race([
          exit,
          new Promise<false>((resolve) => {
            timeout = setTimeout(() => resolve(false), 12_000);
          })
        ]);
        if (timeout) clearTimeout(timeout);
        if (!success || !stopped) throw new Error("未能确认桌面子进程已全部退出，请保留窗口并重试或检查任务管理器");
        return { forced: stopped === "STOPPED_FORCED" };
      })().catch((error: unknown) => {
        closing = undefined;
        throw error;
      }));
    }
  };
}
