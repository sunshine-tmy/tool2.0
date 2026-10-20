/** 波形编辑器隔离预览：仅在临时根目录写入测试音频，不访问真实音频库。 */
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../backend/dist/app.js";
import { getConfig } from "../backend/src/config.ts";
process.env.NODE_ENV = "test";
const root = await mkdtemp(path.join(os.tmpdir(), "toolbox-waveform-preview-"));
const config = getConfig({ dotenvPath: null });
config.storageRoot = path.join(root, "storage");
config.databasePath = path.join(root, "toolbox.db");
config.runtime.frontendDistRoot = fileURLToPath(new URL("../frontend/dist", import.meta.url));
const app = await createApp({ config });
const rate = 16000,
  samples = 36 * rate,
  buffer = Buffer.alloc(44 + samples * 2);
buffer.write("RIFF");
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write("WAVEfmt ", 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(rate, 24);
buffer.writeUInt32LE(rate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) {
  const t = i / rate,
    envelope = (0.06 + 0.8 * Math.abs(Math.sin(t * 1.7) * Math.cos(t * 0.41))) * (Math.sin(t * 5.3) > -0.7 ? 1 : 0.08);
  buffer.writeInt16LE(Math.round(Math.sin(t * 2 * Math.PI * 220) * envelope * 26000), 44 + i * 2);
}
const boundary = "waveform-preview";
const fields = {
  title: "直播开场 · 波形裁剪演示",
  language: "ms",
  foreignText: "Selamat datang ke siaran langsung kami.",
  chineseText: "欢迎来到直播间，拖动波形选取需要保留的片段。"
};
const chunks = Object.entries(fields).map(([key, value]) =>
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)
);
chunks.push(
  Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="waveform-demo.wav"\r\nContent-Type: audio/wav\r\n\r\n`
  ),
  buffer,
  Buffer.from(`\r\n--${boundary}--\r\n`)
);
const upload = await app.inject({
  method: "POST",
  url: "/api/v1/tools/audio-library/uploads",
  headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  payload: Buffer.concat(chunks)
});
if (upload.statusCode !== 200) throw new Error(upload.body);
await app.listen({ port: 0, host: "127.0.0.1" });
console.log(`WAVEFORM_PREVIEW=http://127.0.0.1:${app.server.address().port}/tools/audio-library`);
console.log(`ISOLATED_STORAGE=${root}`);
process.on("SIGINT", () => {
  void app.close().then(() => process.exit(0));
});
