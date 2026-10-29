import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runMediaProcess } from "../domains/content-archive/video-edit/renderer";
describe("归档媒体子进程资源边界", () => {
  it("以独立参数执行，不经 shell，返回有界输出", async () => {
    const value = "中文路径 $(not-a-command) & value";
    const output = await runMediaProcess(
      process.execPath,
      ["-e", "process.stdout.write(process.argv[1])", value],
      new AbortController().signal
    );
    expect(output).toBe(value);
  });
  it("运行时缺失和异常退出映射为明确错误", async () => {
    await expect(
      runMediaProcess(path.join(os.tmpdir(), "toolbox-absent-ffmpeg-91ab7.exe"), [], new AbortController().signal)
    ).rejects.toMatchObject({ code: "ARCHIVE_EDIT_RUNTIME_UNAVAILABLE" });
    await expect(
      runMediaProcess(process.execPath, ["-e", "process.exit(2)"], new AbortController().signal)
    ).rejects.toMatchObject({ code: "ARCHIVE_EDIT_RENDER_FAILED" });
  });
  it("取消等待本次子进程退出，拒绝成功终态", async () => {
    const controller = new AbortController();
    await expect(
      runMediaProcess(
        process.execPath,
        ["-e", "process.stdout.write('ready');setInterval(()=>{},1000)"],
        controller.signal,
        { onOutput: () => controller.abort() }
      )
    ).rejects.toMatchObject({ code: "ARCHIVE_EDIT_CANCELLED" });
  });
  it("超时、超大输出和进度持久化异常均停止子进程", async () => {
    await expect(
      runMediaProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], new AbortController().signal, {
        timeoutMs: 50
      })
    ).rejects.toMatchObject({ code: "ARCHIVE_EDIT_TIMEOUT" });
    await expect(
      runMediaProcess(
        process.execPath,
        ["-e", "process.stdout.write('a'.repeat(1049000))"],
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: "ARCHIVE_EDIT_PROCESS_OUTPUT" });
    await expect(
      runMediaProcess(
        process.execPath,
        ["-e", "process.stdout.write('progress');setInterval(()=>{},1000)"],
        new AbortController().signal,
        {
          onOutput: () => {
            throw new Error("progress persistence failed");
          }
        }
      )
    ).rejects.toThrow("progress persistence failed");
  });
});
