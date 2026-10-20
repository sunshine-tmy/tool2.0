/** 只记录结构化白名单，不保留子进程任意输出；目录不可写时仍有内存摘要。 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export class DiagnosticJournal {
  readonly bootId: string;
  readonly events: Array<{ at: string; bootId: string; phase: string; code: string }> = [];
  constructor(
    private readonly directory: string,
    bootId?: string
  ) {
    const inherited = bootId ?? process.env.TOOLBOX_BOOT_ID;
    this.bootId = inherited && /^[A-Za-z0-9-]{1,80}$/.test(inherited) ? inherited : crypto.randomUUID();
  }
  record(phase: string, code: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(phase) || !/^[A-Z0-9_]{1,80}$/.test(code)) return;
    const event = { at: new Date().toISOString(), bootId: this.bootId, phase, code };
    this.events.push(event);
    if (this.events.length > 500) this.events.shift();
    try {
      fs.mkdirSync(this.directory, { recursive: true });
      const file = path.join(this.directory, "diagnostics.jsonl");
      if (fs.existsSync(file) && fs.statSync(file).size >= 5 * 1024 * 1024) {
        fs.rmSync(`${file}.2`, { force: true });
        if (fs.existsSync(`${file}.1`)) fs.renameSync(`${file}.1`, `${file}.2`);
        fs.renameSync(file, `${file}.1`);
      }
      fs.appendFileSync(file, JSON.stringify(event) + "\n");
    } catch {
      /* 原始故障不可被日志错误覆盖。 */
    }
  }
  consume(phase: string, chunk: Buffer | string) {
    // 持续消费管道但只提取明确的系统错误码，不保存文本、路径或令牌。
    const value = String(chunk);
    const known = ["EACCES", "EPERM", "ENOSPC", "EADDRINUSE", "ECONNREFUSED", "CUDA_OUT_OF_MEMORY"].find((code) =>
      new RegExp(`\\b${code}\\b`).test(value)
    );
    if (known) this.record(phase, known);
  }
}
