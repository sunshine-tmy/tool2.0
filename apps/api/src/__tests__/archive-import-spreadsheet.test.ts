import { PassThrough } from "node:stream";
import fs from "node:fs/promises";
import yauzl from "yauzl";
import { ZipArchive } from "archiver";
import { describe, expect, it } from "vitest";
import { readArchiveSpreadsheet, archiveImportCsv } from "../domains/content-archive/batch/spreadsheet";

async function workbook(
  worksheet: string,
  options: { shared?: string; target?: string; external?: boolean; extra?: [string, Buffer] } = {}
) {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
  });
  const zip = new ZipArchive({ zlib: { level: 1 } });
  zip.on("error", (error) => output.destroy(error));
  zip.pipe(output);
  zip.append(
    '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="作品列表" sheetId="1" r:id="rId1" /></sheets></workbook>',
    { name: "xl/workbook.xml" }
  );
  zip.append(
    `<Relationships><Relationship Id="rId1" Target="${options.target ?? "worksheets/sheet1.xml"}" ${options.external ? 'TargetMode="External"' : ""}/></Relationships>`,
    { name: "xl/_rels/workbook.xml.rels" }
  );
  zip.append(worksheet, { name: "xl/worksheets/sheet1.xml" });
  if (options.shared) zip.append(options.shared, { name: "xl/sharedStrings.xml" });
  if (options.extra) zip.append(options.extra[1], { name: options.extra[0] });
  void zip.finalize();
  return done;
}
const sheet = (rows: string) => `<worksheet><sheetData>${rows}</sheetData></worksheet>`;
const inline = (reference: string, value: string) => `<c r="${reference}" t="inlineStr"><is><t>${value}</t></is></c>`;
const header = `<row r="1">${inline("A1", "作品链接")}${inline("B1", "平台")}</row>`;
describe("archive spreadsheet boundaries", () => {
  it("ships a blank XLSX template whose real exported cells can be filled and read by the importer", async () => {
    const template = await fs.readFile(
      new URL("../../../web/src/features/content-archive/assets/archive-import-template.xlsx", import.meta.url)
    );
    await expect(readArchiveSpreadsheet(template, "blank.xlsx")).rejects.toThrow("至少一条作品记录");
    const files = await new Promise<Array<{ name: string; contents: Buffer }>>((resolve, reject) => {
      yauzl.fromBuffer(template, { lazyEntries: true }, (error, zip) => {
        if (error || !zip) {
          reject(error);
          return;
        }
        const entries: Array<{ name: string; contents: Buffer }> = [];
        zip.on("error", reject);
        zip.on("end", () => resolve(entries));
        zip.on("entry", (entry) => {
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) {
              zip.close();
              reject(error);
              return;
            }
            const chunks: Buffer[] = [];
            stream.on("error", reject);
            stream.on("data", (chunk: Buffer) => chunks.push(chunk));
            stream.on("end", () => {
              entries.push({ name: entry.fileName, contents: Buffer.concat(chunks) });
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      });
    });
    const sheetFile = files.find((entry) => entry.name === "xl/worksheets/sheet1.xml")!;
    const original = sheetFile.contents.toString("utf8");
    expect(original).toContain("作品链接");
    expect(original).toContain("平台");
    expect(original).not.toContain("https://");
    sheetFile.contents = Buffer.from(
      original.replace(
        /<x:c r="A2"[^>]*\/>/,
        '<x:c r="A2" t="inlineStr"><x:is><x:t>https://vt.tiktok.com/AAAAA/</x:t></x:is></x:c>'
      )
    );
    const stream = new PassThrough(),
      zip = new ZipArchive({ zlib: { level: 1 } }),
      chunks: Buffer[] = [];
    const finished = new Promise<Buffer>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
    zip.on("error", (error) => stream.destroy(error));
    zip.pipe(stream);
    for (const entry of files) zip.append(entry.contents, { name: entry.name });
    void zip.finalize();
    expect(await readArchiveSpreadsheet(await finished, "filled.xlsx")).toEqual({
      sheetName: "作品列表",
      rows: [{ rowNumber: 2, inputUrl: "https://vt.tiktok.com/AAAAA/", inputPlatform: "" }]
    });
  });
  it("reads UTF-8 CSV quoting/newlines/BOM and keeps logical spreadsheet row numbers", async () => {
    const file = Buffer.from(
      '\uFEFF作品链接,平台,备注\r\n"分享文案\nhttps://vt.tiktok.com/AAAAA/",TikTok,"备注,包含逗号和""引号"""\r\n,,\r\nhttps://v.douyin.com/BBBBB/,自动识别,\r\n'
    );
    expect((await readArchiveSpreadsheet(file, "作品.csv")).rows).toEqual([
      { rowNumber: 2, inputUrl: "分享文案\nhttps://vt.tiktok.com/AAAAA/", inputPlatform: "TikTok" },
      { rowNumber: 4, inputUrl: "https://v.douyin.com/BBBBB/", inputPlatform: "自动识别" }
    ]);
    const utf16 = Buffer.concat([
      Buffer.from([255, 254]),
      Buffer.from("链接,平台\r\nhttps://xhslink.com/a/123,小红书", "utf16le")
    ]);
    expect((await readArchiveSpreadsheet(utf16, "utf16.csv")).rows[0]!.inputPlatform).toBe("小红书");
    const gbk = Buffer.concat([
      Buffer.from("c1b4bdd32c706c6174666f726d0d0a", "hex"),
      Buffer.from("https://vt.tiktok.com/AAAAA/,tiktok")
    ]);
    expect((await readArchiveSpreadsheet(gbk, "gbk.csv")).rows).toHaveLength(1);
  });
  it("reads real XLSX relationships, sparse rows, shared/rich strings and XML escapes", async () => {
    const file = await workbook(
      sheet(
        `${header}<row r="4"><c r="A4" t="s"><v>0</v></c>${inline("B4", "TikTok")}</row><row r="5">${inline("A5", "https://vt.tiktok.com/BBBBB/?x=1&amp;y=2")}</row>`
      ),
      { shared: "<sst><si><r><t>https://vt.tiktok.com/</t></r><r><t>AAAAA/</t></r></si></sst>" }
    );
    const result = await readArchiveSpreadsheet(file, "test.xlsx");
    expect(result.sheetName).toBe("作品列表");
    expect(result.rows).toEqual([
      { rowNumber: 4, inputUrl: "https://vt.tiktok.com/AAAAA/", inputPlatform: "TikTok" },
      { rowNumber: 5, inputUrl: "https://vt.tiktok.com/BBBBB/?x=1&y=2", inputPlatform: "" }
    ]);
  });
  it("never executes or follows formulas and rejects external workbook relationships", async () => {
    const file = await workbook(
      sheet(
        `${header}<row r="2"><c r="A2" t="str"><f>HYPERLINK("https://vt.tiktok.com/AAAAA/")</f><v>https://vt.tiktok.com/AAAAA/</v></c></row>`
      )
    );
    expect((await readArchiveSpreadsheet(file, "formula.xlsx")).rows[0]!.inputUrl).toContain("公式单元格");
    await expect(
      readArchiveSpreadsheet(
        await workbook(sheet(header), { target: "https://example.test/sheet.xml", external: true }),
        "external.xlsx"
      )
    ).rejects.toThrow("引用无效");
    await expect(
      readArchiveSpreadsheet(await workbook(sheet(header), { target: "../../outside.xml" }), "outside.xlsx")
    ).rejects.toThrow("路径无效");
  });
  it.each([
    "链接,链接\na,b",
    "备注\na",
    '链接\n"unclosed',
    '链接\n"closed"bad',
    '链接\nabc"def',
    "链接\n\0",
    "链接",
    ""
  ])("rejects malformed, missing or duplicate CSV headers: %s", async (input) => {
    await expect(readArchiveSpreadsheet(Buffer.from(input), "bad.csv")).rejects.toThrow();
  });
  it("bounds file size, cells, row count, decompressed XML and entity declarations", async () => {
    for (const file of [
      Buffer.alloc(2 * 1024 * 1024 + 1),
      Buffer.from("链接\n" + "x".repeat(10001)),
      Buffer.from("链接\n" + Array(101).fill("https://vt.tiktok.com/AAAAA/").join("\n"))
    ])
      await expect(readArchiveSpreadsheet(file, "too-big.csv")).rejects.toThrow();
    await expect(readArchiveSpreadsheet(Buffer.from("not zip"), "bad.xlsx")).rejects.toThrow();
    await expect(readArchiveSpreadsheet(Buffer.from("old binary"), "old.xls")).rejects.toThrow("仅支持");
    await expect(
      readArchiveSpreadsheet(await workbook('<!DOCTYPE worksheet [<!ENTITY x "xx">]>' + sheet(header)), "entity.xlsx")
    ).rejects.toThrow("实体声明");
    await expect(
      readArchiveSpreadsheet(
        await workbook(sheet(header), { extra: ["xl/sharedStrings.xml", Buffer.alloc(4 * 1024 * 1024 + 1)] }),
        "bomb.xlsx"
      )
    ).rejects.toThrow("超过限制");
  });
  it("escapes exported CSV formulas, quotes, commas and multiline error messages", () => {
    const output = archiveImportCsv([
      ["=SUM(1,2)", " @formula", "-cmd", "\tformula", 'line\n"quote"', "https://www.tiktok.com/@shop/video/12345"]
    ]);
    expect(output).toBe(
      '\uFEFF"\'=SUM(1,2)","\' @formula","\'-cmd","\'\tformula","line\n""quote""","https://www.tiktok.com/@shop/video/12345"'
    );
  });
});
