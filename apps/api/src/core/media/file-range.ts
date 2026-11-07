/** Local file transport shared by archive and video tools; callers own validation and read leases. */
import fs from "node:fs";
import type { FastifyReply } from "fastify";
export function sendFileRange(reply: FastifyReply, file: string, size: number, header?: string, release?: () => void) {
  const stream = (range?: { start: number; end: number }) => {
    const input = fs.createReadStream(file, range);
    if (release) {
      input.once("close", release);
      input.once("error", release);
      reply.raw.once("close", release);
    }
    return input;
  };
  if (!header) return reply.header("content-length", size).send(stream());
  const invalid = () => {
    release?.();
    return reply.code(416).header("content-range", `bytes */${size}`).send();
  };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return invalid();
  const suffix = !match[1],
    first = Number(match[1] || match[2]),
    last = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || (suffix && first <= 0)) return invalid();
  const start = suffix ? Math.max(0, size - first) : first,
    end = suffix ? size - 1 : Math.min(last, size - 1);
  if (start < 0 || start >= size || end < start) return invalid();
  return reply
    .code(206)
    .headers({ "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 })
    .send(stream({ start, end }));
}
