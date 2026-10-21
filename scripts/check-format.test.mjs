/** 格式门禁只检查 Git 纳入的项目文件，并按 Windows 命令行长度分批调用。 */
import assert from "node:assert/strict";
import test from "node:test";
import { createBatches, listProjectFiles } from "./check-format.mjs";

test("格式检查跳过已经删除但尚未提交的文件，保留现有项目文件", () => {
  const files = listProjectFiles({
    list: () => Buffer.from("src/kept.ts\0src/removed.ts\0"),
    exists: (file) => !file.endsWith("removed.ts")
  });
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith("kept.ts"));
});

test("格式检查按参数长度分批且不遗漏文件", () => {
  const files = ["short.ts", "a-longer-file.vue", "最后一个文件.md"];
  const batches = createBatches(files, 20);

  assert.deepEqual(batches.flat(), files);
  assert.ok(batches.every((batch) => batch.reduce((size, file) => size + file.length + 1, 0) <= 20));
});

test("单个长路径仍会独立传给格式检查器", () => {
  assert.deepEqual(createBatches(["a-path-longer-than-the-limit.ts"], 5), [["a-path-longer-than-the-limit.ts"]]);
});
