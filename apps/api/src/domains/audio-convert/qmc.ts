/** QMC2 crypto adapted from QM Unlock (MIT). See third-party/qmunlock-LICENSE.txt.
 * No credential discovery, network access or external dependencies. */
/*!
MIT License

Copyright (c) 2026 QM Unlock contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import { AudioConvertError } from "./errors";

function tea(data: Buffer, key: Buffer): Buffer {
  if (data.length < 16 || data.length % 8) throw new Error("TEA_LENGTH");
  const k = [0, 4, 8, 12].map((n) => key.readUInt32BE(n));
  const block = (b: Buffer) => {
    let a = b.readUInt32BE(0),
      c = b.readUInt32BE(4),
      sum = 0xe3779b90;
    for (let n = 0; n < 16; n++) {
      c = (c - (((a << 4) + k[2]) ^ (a + sum) ^ ((a >>> 5) + k[3]))) >>> 0;
      a = (a - (((c << 4) + k[0]) ^ (c + sum) ^ ((c >>> 5) + k[1]))) >>> 0;
      sum = (sum - 0x9e3779b9) >>> 0;
    }
    b.writeUInt32BE(a, 0);
    b.writeUInt32BE(c, 4);
  };
  const dest = Buffer.from(data.subarray(0, 8));
  block(dest);
  const pad = dest[0] & 7,
    length = data.length - 10 - pad;
  if (length < 0) throw new Error("TEA_PADDING");
  let prev = Buffer.alloc(8),
    current = Buffer.from(data.subarray(0, 8)),
    pos = 8,
    index = 1 + pad;
  const next = () => {
    if (pos + 8 > data.length) throw new Error("TEA_BOUNDS");
    prev = current;
    current = Buffer.from(data.subarray(pos, pos + 8));
    for (let i = 0; i < 8; i++) dest[i] ^= data[pos + i];
    block(dest);
    pos += 8;
    index = 0;
  };
  const read = () => {
    if (index === 8) next();
    return dest[index] ^ prev[index++];
  };
  read();
  read();
  const output = Buffer.alloc(length);
  for (let i = 0; i < length; i++) output[i] = read();
  for (let i = 0; i < 7; i++) if (read()) throw new Error("TEA_PADDING");
  return output;
}
export function deriveQmcKey(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 20000)
    throw new AudioConvertError("AUDIO_CONVERT_KEY_INVALID", "解码密钥格式无效");
  let decoded = Buffer.from(value, "base64");
  const marker = "QQMusic EncV2,Key:";
  try {
    if (decoded.subarray(0, marker.length).toString() === marker)
      decoded = Buffer.from(
        tea(
          tea(decoded.subarray(marker.length), Buffer.from("386ZJY!@#*$%^&)(")),
          Buffer.from("**#!(#$%&^a1cZ,T")
        ).toString(),
        "base64"
      );
    if (decoded.length < 16 || decoded.length > 8192) throw new Error("KEY_LENGTH");
    const simple = [0x69, 0x56, 0x46, 0x38, 0x2b, 0x20, 0x15, 0x0b],
      key = Buffer.alloc(16);
    for (let i = 0; i < 8; i++) {
      key[i * 2] = simple[i];
      key[i * 2 + 1] = decoded[i];
    }
    try {
      return Buffer.concat([decoded.subarray(0, 8), tea(decoded.subarray(8), key)]);
    } catch {
      return decoded;
    } // Some authorized exports contain raw key bytes rather than an EncV1 envelope.
  } catch {
    throw new AudioConvertError("AUDIO_CONVERT_KEY_INVALID", "解码密钥不兼容或损坏");
  }
}
export function qmcTransform(buffer: Buffer, key: Buffer, offset = 0) {
  if (key.length <= 300) {
    for (let i = 0; i < buffer.length; i++) {
      let off = offset + i;
      if (off > 0x7fff) off %= 0x7fff;
      const idx = (off * off + 71214) % key.length,
        v = key[idx],
        r = ((idx & 7) + 4) % 8;
      buffer[i] ^= r ? ((v << r) | (v >>> r)) & 255 : v;
    }
    return;
  }
  const n = key.length,
    box = Array.from({ length: n }, (_, i) => i & 255);
  for (let i = 0, j = 0; i < n; i++) {
    j = (j + box[i] + key[i]) % n;
    [box[i], box[j]] = [box[j], box[i]];
  }
  let hash = 1;
  for (const v of key) {
    if (!v) continue;
    const next = Math.imul(hash, v) >>> 0;
    if (!next || next <= hash) break;
    hash = next;
  }
  const skip = (id: number) => (key[id % n] ? Math.floor((hash / ((id + 1) * key[id % n])) * 100) % n : 0);
  let index = 0;
  while (index < buffer.length && offset + index < 128) {
    buffer[index] ^= key[skip(offset + index)];
    index++;
  }
  while (index < buffer.length) {
    const absolute = offset + index,
      length = Math.min(buffer.length - index, 5120 - (absolute % 5120));
    const b = [...box],
      skipped = (absolute % 5120) + skip(Math.floor(absolute / 5120));
    for (let i = -skipped, j = 0, k = 0; i < length; i++) {
      j = (j + 1) % n;
      k = (b[j] + k) % n;
      [b[j], b[k]] = [b[k], b[j]];
      if (i >= 0) buffer[index + i] ^= b[(b[j] + b[k]) % n];
    }
    index += length;
  }
}
export function qmcPayload(tail: Buffer, size: number, suppliedKey?: string) {
  let end = size,
    embedded = "";
  if (tail.subarray(-8).toString() === "musicex\0") {
    const length = tail.readUInt32LE(tail.length - 16),
      version = tail.readUInt32LE(tail.length - 12);
    if (version !== 1) throw new AudioConvertError("AUDIO_CONVERT_VERSION_UNSUPPORTED", "暂不支持此 musicex 加密版本");
    if (length < 16 || length >= size) throw new AudioConvertError("AUDIO_CONVERT_CORRUPT", "加密文件尾部损坏");
    end -= length;
  } else if (tail.subarray(-4).toString() === "QTag") {
    const length = tail.readUInt32BE(tail.length - 8);
    if (length < 1 || length > tail.length - 8) throw new AudioConvertError("AUDIO_CONVERT_CORRUPT", "QMC 尾部损坏");
    embedded = tail
      .subarray(tail.length - 8 - length, tail.length - 8)
      .toString()
      .split(",")[0];
    end -= length + 8;
  } else if (tail.length >= 4) {
    const length = tail.readUInt32LE(tail.length - 4);
    if (length > 0 && length <= tail.length - 4 && length < 20000) {
      embedded = tail.subarray(tail.length - 4 - length, -4).toString();
      end -= length + 4;
    } else throw new AudioConvertError("AUDIO_CONVERT_VERSION_UNSUPPORTED", "无法识别此 MGG/MFLAC 加密版本");
  }
  const value = suppliedKey?.trim() || embedded;
  if (!value)
    throw new AudioConvertError(
      "AUDIO_CONVERT_KEY_REQUIRED",
      "此 musicex 文件不含解码密钥，请填写该文件的 EKey 后重新上传；不会读取账号或登录信息"
    );
  return { end, key: deriveQmcKey(value) };
}
