import { expect, it } from "vitest";
import * as subtitles from "../domains/speech/shared/batch-subtitles";
import * as headers from "../domains/speech/shared/download-headers";
import * as replacement from "../domains/speech/shared/file-replacement";
import * as json from "../domains/speech/shared/json-file";
import * as time from "../domains/speech/shared/subtitle-time";

it.each([
  ["batch subtitles", subtitles, ["buildBilingualCues", "buildSentenceCues", "buildTranslationCues", "writeSrt"]],
  ["download headers", headers, ["contentDisposition"]],
  ["backup replacement", replacement, ["fileExists", "replaceFile"]],
  ["ordinary JSON", json, ["writeJsonAtomic"]],
  ["subtitle time", time, ["srtTimestamp"]]
])("keeps the existing %s runtime surface without adding parallel policies", (_name, module, exports) => {
  expect(Object.keys(module).sort()).toEqual(exports);
  expect(Object.values(module).every((value) => typeof value === "function")).toBe(true);
});
