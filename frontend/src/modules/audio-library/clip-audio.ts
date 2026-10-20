/** 浏览器解码并导出选区为 PCM WAV，不引入额外本地安装依赖。 */
import { AUDIO_LIBRARY_MAX_FILE_BYTES } from "@toolbox/shared";
const MAX_DECODE_SAMPLES = 64 * 1024 * 1024;
type AudioSamples = Pick<AudioBuffer, "sampleRate" | "numberOfChannels" | "length" | "getChannelData">;
export function encodeClipWav(audio: AudioSamples, start: number, end: number): Blob {
  const first = Math.round(start * audio.sampleRate),
    last = Math.min(audio.length, Math.round(end * audio.sampleRate));
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    first < 0 ||
    last <= first ||
    end > audio.length / audio.sampleRate + 0.001
  )
    throw new Error("裁剪范围超出实际音频时长");
  const channels = audio.numberOfChannels,
    frames = last - first;
  const size = 44 + frames * channels * 2;
  if (size > AUDIO_LIBRARY_MAX_FILE_BYTES) throw new Error("裁剪结果超过 100 MiB，请缩短选区");
  const buffer = new ArrayBuffer(size),
    view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, size - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, size - 44, true);
  const samples = Array.from({ length: channels }, (_, i) => audio.getChannelData(i));
  let offset = 44;
  for (let frame = first; frame < last; frame++)
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.max(-1, Math.min(1, samples[channel][frame]));
      view.setInt16(offset, Math.round(value * (value < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  return new Blob([buffer], { type: "audio/wav" });
}
export async function decodeAudioSamples(
  url: string,
  duration: number,
  signal: AbortSignal,
  status: (text: string) => void,
  sampleRate = 48000
) {
  // 按双声道 48 kHz 保守预估，避免压缩长音频解码导致页面内存失控。
  if (duration * sampleRate * 2 > MAX_DECODE_SAMPLES)
    throw new Error("原音频过长，超过浏览器安全解码范围，请先分段后上传");
  if (!globalThis.AudioContext) throw new Error("当前浏览器不支持音频解码，请使用新版 Chrome 或 Edge");
  status("正在读取音频…");
  const response = await fetch(url, { signal, credentials: "include" });
  if (!response.ok) throw new Error("原音频读取失败，请刷新后重试");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > AUDIO_LIBRARY_MAX_FILE_BYTES) throw new Error("原音频超过 100 MiB");
  signal.throwIfAborted();
  const context = new AudioContext({ sampleRate });
  try {
    status("正在解码及裁剪…");
    const decoded = await context.decodeAudioData(bytes);
    signal.throwIfAborted();
    if (decoded.length * decoded.numberOfChannels > MAX_DECODE_SAMPLES)
      throw new Error("音频解码后过大，请先分段后上传");
    return decoded;
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof DOMException) throw new Error("浏览器无法解码该音频，请转换为 PCM WAV 后重试");
    throw error;
  } finally {
    await context.close();
  }
}
export async function cropAudio(
  url: string,
  duration: number,
  start: number,
  end: number,
  signal: AbortSignal,
  status: (text: string) => void
) {
  const decoded = await decodeAudioSamples(url, duration, signal, status);
  signal.throwIfAborted();
  return encodeClipWav(decoded, start, end);
}
