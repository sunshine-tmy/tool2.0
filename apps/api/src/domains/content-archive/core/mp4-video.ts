/** Check declared MP4 tracks without loading media payloads or requiring FFmpeg. */
import fs from "node:fs/promises";

export async function assertMp4VideoTrack(file: string, signal: AbortSignal) {
  const handle = await fs.open(file, "r");
  let visited = 0;
  const header = Buffer.alloc(24);
  try {
    const { size: fileSize } = await handle.stat();
    const scan = async (start: number, end: number, depth: number): Promise<boolean> => {
      for (let offset = start; offset + 8 <= end;) {
        signal.throwIfAborted();
        if (++visited > 4096) throw new Error("MEDIA_FORMAT_INVALID");
        const { bytesRead } = await handle.read(header, 0, Math.min(header.length, end - offset), offset);
        if (bytesRead < 8) return false;
        let size = header.readUInt32BE(0),
          prefix = 8;
        const kind = header.toString("ascii", 4, 8);
        if (size === 1) {
          if (bytesRead < 16) return false;
          const large = header.readBigUInt64BE(8);
          if (large > BigInt(end - offset)) return false;
          size = Number(large);
          prefix = 16;
        } else if (size === 0) size = end - offset;
        if (size < prefix || size > end - offset) return false;
        if (depth === 3 && kind === "hdlr" && size >= prefix + 12) {
          const type = Buffer.alloc(4);
          const result = await handle.read(type, 0, 4, offset + prefix + 8);
          if (result.bytesRead === 4 && type.toString("ascii") === "vide") return true;
        }
        if (kind === ["moov", "trak", "mdia"][depth] && (await scan(offset + prefix, offset + size, depth + 1)))
          return true;
        offset += size;
      }
      return false;
    };
    if (!(await scan(0, fileSize, 0))) throw new Error("MEDIA_VIDEO_TRACK_MISSING");
  } finally {
    await handle.close();
  }
}
