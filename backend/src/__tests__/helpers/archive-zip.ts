/** 仅解析测试自产 ZIP 的中央目录与字节；不以搜索二进制字符串代替完整媒体导出验收。 */
import { inflateRawSync } from "node:zlib";

export function readArchiveZip(buffer: Buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("缺少 ZIP 结束目录，流式导出不完整");
  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP 中央目录损坏");
    const method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const length = buffer.readUInt16LE(cursor + 28);
    const name = buffer.subarray(cursor + 46, cursor + 46 + length).toString("utf8");
    const local = buffer.readUInt32LE(cursor + 42);
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error("ZIP 条目头损坏");
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const bytes = buffer.subarray(start, start + compressed);
    if (entries.has(name)) throw new Error("ZIP 导出条目重名");
    if (method !== 0 && method !== 8) throw new Error("测试未预期的 ZIP 压缩方式");
    entries.set(name, method === 8 ? inflateRawSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : bytes);
    cursor += 46 + length + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
  }
  return entries;
}
