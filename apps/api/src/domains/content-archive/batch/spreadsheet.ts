/** Bounded, in-memory CSV/first-visible-sheet XLSX import. No formulas, external resources or disk extraction. */
import path from "node:path";
import yauzl from "yauzl";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ARCHIVE_IMPORT_MAX_BYTES, ARCHIVE_IMPORT_MAX_ROWS, type ArchiveImportInputRow } from "@toolbox/shared/archive";
import { ArchiveTaskError } from "../core/provider";

function fail(message: string): never {
  throw new ArchiveTaskError("ARCHIVE_IMPORT_FILE_INVALID", message, 400);
}
type DataRow = { number: number; cells: string[] };
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const array = (value: unknown): unknown[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
function cellText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  const node = obj(value);
  if (node.t !== undefined) return cellText(node.t);
  if (node.r !== undefined) return array(node.r).map(cellText).join("");
  return typeof node["#text"] === "string" ? node["#text"] : "";
}
function xml(buffer: Buffer): Record<string, unknown> {
  const text = buffer.toString("utf8");
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(text) || text.includes("\0") || XMLValidator.validate(text) !== true)
    fail("Excel XML 格式无效或包含不受支持的实体声明");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
    processEntities: true,
    maxNestedTags: 30
  });
  return obj(parser.parse(text));
}
function csv(buffer: Buffer): DataRow[] {
  let text: string;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) text = new TextDecoder("utf-16le", { fatal: true }).decode(buffer);
  else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("gb18030", { fatal: true }).decode(buffer);
    }
  }
  text = text.replace(/^\uFEFF/, "");
  if (text.includes("\0")) fail("CSV 包含无效字符");
  const rows: DataRow[] = [];
  let cells: string[] = [],
    value = "",
    quoted = false,
    closed = false,
    start = 1;
  const field = () => {
    if (value.length > 10_000 || cells.length >= 50) fail("单元格超过 10000 字符或列数超过 50");
    cells.push(value);
    value = "";
    closed = false;
  };
  const row = () => {
    field();
    if (cells.some((v) => v.trim())) rows.push({ number: start, cells });
    cells = [];
    start++;
    if (rows.length > ARCHIVE_IMPORT_MAX_ROWS + 1) fail("每次最多导入 100 条，请拆分表格");
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        value += char;
      }
    } else if (char === '"') {
      if (value || closed) fail("CSV 引号格式无效");
      quoted = true;
    } else if (char === ",") field();
    else if (char === "\r" || char === "\n") {
      row();
      if (char === "\r" && text[index + 1] === "\n") index++;
    } else {
      if (closed) fail("CSV 引号后只能有逗号或换行");
      value += char;
    }
    if (value.length > 10_000) fail("单元格超过 10000 字符");
  }
  if (quoted) fail("CSV 引号未闭合");
  if (value || cells.length || closed) row();
  return rows;
}
async function zipEntries(buffer: Buffer) {
  return new Promise<Map<string, Buffer>>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) {
        reject(new ArchiveTaskError("ARCHIVE_IMPORT_FILE_INVALID", "无法读取 Excel 文件，请使用未加密的 .xlsx", 400));
        return;
      }
      const files = new Map<string, Buffer>();
      let total = 0,
        count = 0,
        settled = false;
      const stop = (reason: unknown) => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(reason);
      };
      zip.on("error", stop);
      zip.on("end", () => {
        if (!settled) {
          settled = true;
          resolve(files);
        }
      });
      zip.on("entry", (entry: yauzl.Entry) => {
        total += entry.uncompressedSize;
        if (
          ++count > 2048 ||
          total > 32 * 1024 * 1024 ||
          entry.generalPurposeBitFlag & 1 ||
          files.has(entry.fileName)
        ) {
          stop(new ArchiveTaskError("ARCHIVE_IMPORT_FILE_INVALID", "Excel 压缩内容过大、重复或已加密", 400));
          return;
        }
        if (
          !/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(
            entry.fileName
          )
        ) {
          zip.readEntry();
          return;
        }
        if (entry.uncompressedSize > 4 * 1024 * 1024) {
          stop(new ArchiveTaskError("ARCHIVE_IMPORT_FILE_INVALID", "Excel 工作表内容超过限制，请拆分表格", 400));
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            stop(streamError);
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          stream.on("error", stop);
          stream.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 4 * 1024 * 1024) {
              stream.destroy();
              stop(new ArchiveTaskError("ARCHIVE_IMPORT_FILE_INVALID", "Excel XML 内容超过限制", 400));
            } else chunks.push(chunk);
          });
          stream.on("end", () => {
            if (!settled) {
              files.set(entry.fileName, Buffer.concat(chunks));
              zip.readEntry();
            }
          });
        });
      });
      zip.readEntry();
    });
  });
}
async function xlsx(buffer: Buffer): Promise<{ rows: DataRow[]; sheetName: string }> {
  const files = await zipEntries(buffer);
  const read = (name: string) => {
    const value = files.get(name);
    return value ? xml(value) : fail("Excel 缺少工作簿或工作表信息");
  };
  const sheet = array(obj(obj(read("xl/workbook.xml").workbook).sheets).sheet)
    .map(obj)
    .find((value) => !["hidden", "veryHidden"].includes(String(value["@_state"])));
  if (!sheet) fail("Excel 没有可见工作表");
  const rel = array(obj(read("xl/_rels/workbook.xml.rels").Relationships).Relationship)
    .map(obj)
    .find((value) => value["@_Id"] === sheet["@_id"]);
  if (!rel || rel["@_TargetMode"] === "External" || typeof rel["@_Target"] !== "string") fail("Excel 工作表引用无效");
  const target = String(rel["@_Target"]);
  const filename = target.startsWith("/") ? target.slice(1) : path.posix.normalize(`xl/${target}`);
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(filename)) fail("Excel 工作表路径无效");
  const strings = files.has("xl/sharedStrings.xml")
    ? array(obj(read("xl/sharedStrings.xml").sst).si).map(cellText)
    : [];
  const rows: DataRow[] = [];
  let previous = 0;
  for (const value of array(obj(obj(read(filename).worksheet).sheetData).row)) {
    const entry = obj(value);
    const number = Number(entry["@_r"]);
    if (!Number.isSafeInteger(number) || number <= previous || number > 1_048_576) fail("Excel 行号无效");
    previous = number;
    const cells: string[] = [];
    for (const value of array(entry.c)) {
      const cell = obj(value),
        reference = String(cell["@_r"] ?? "");
      const match = /^([A-Z]+)(\d+)$/.exec(reference);
      if (!match || Number(match[2]) !== number) fail("Excel 单元格坐标无效");
      let column = 0;
      for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
      if (column > 50) fail("Excel 最多支持 50 列");
      if (cells[column - 1] !== undefined) fail("Excel 单元格坐标重复");
      if (cell.f !== undefined) cells[column - 1] = "[公式单元格，请粘贴为文本]";
      else if (cell["@_t"] === "s") cells[column - 1] = strings[Number(cell.v)] ?? fail("Excel 共享文本引用无效");
      else cells[column - 1] = cellText(cell.is ?? cell.v);
      if (cells[column - 1]!.length > 10_000) fail("单元格超过 10000 字符");
    }
    if (cells.some((value) => value?.trim())) rows.push({ number, cells });
    if (rows.length > ARCHIVE_IMPORT_MAX_ROWS + 1) fail("每次最多导入 100 条，请拆分表格");
  }
  return { rows, sheetName: String(sheet["@_name"] ?? "Sheet1").slice(0, 128) };
}
export async function readArchiveSpreadsheet(
  buffer: Buffer,
  filename: string
): Promise<{ rows: ArchiveImportInputRow[]; sheetName?: string }> {
  if (!buffer.length || buffer.length > ARCHIVE_IMPORT_MAX_BYTES) fail("表格不能为空，最大 2 MiB");
  const extension = path.extname(filename).toLowerCase();
  if (![".xlsx", ".csv"].includes(extension)) fail("仅支持 .xlsx 和 .csv，不支持 .xls 或宏工作簿");
  const result = extension === ".xlsx" ? await xlsx(buffer) : { rows: csv(buffer), sheetName: undefined };
  const [header, ...data] = result.rows;
  if (!header || !data.length) fail("表格需要表头和至少一条作品记录");
  const headings = header.cells.map((value) => value?.trim().toLowerCase());
  const links = headings.flatMap((value, index) =>
    ["作品链接", "链接", "分享链接", "url", "link"].includes(value) ? [index] : []
  );
  const platforms = headings.flatMap((value, index) =>
    ["平台", "来源平台", "platform"].includes(value) ? [index] : []
  );
  if (links.length !== 1 || platforms.length > 1) fail("表头须有且仅有一列“作品链接”或“链接”，平台列最多一列");
  return {
    sheetName: result.sheetName,
    rows: data.map((row) => ({
      rowNumber: row.number,
      inputUrl: (row.cells[links[0]!] ?? "").trim(),
      inputPlatform: platforms.length ? (row.cells[platforms[0]!] ?? "").trim() : ""
    }))
  };
}
export function archiveImportCsv(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(",")
      )
      .join("\r\n")
  );
}
