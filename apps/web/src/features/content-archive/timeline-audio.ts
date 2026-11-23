/** 时间线直接编辑的参数与播放、导出共用同一套百分比增益及秒数。 */
export type TimelineAudioChange = Partial<{ volume: number; fadeIn: number; fadeOut: number }>;
export const clampAudio = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export function audioFade(time: number, duration: number, fadeIn: number, fadeOut: number) {
  return (
    clampAudio(fadeIn ? time / Math.min(fadeIn, duration) : 1, 0, 1) *
    clampAudio(fadeOut ? (duration - time) / Math.min(fadeOut, duration) : 1, 0, 1)
  );
}
// 0 dB 以上留出 40% 的拖动空间，以下包含 -60 dB 与独立的静音刻度。
export function volumePosition(db: number) {
  return db >= 0 ? 0.4 * (1 - db / 20) : 0.4 - (db / 61) * 0.6;
}
export function positionVolume(position: number) {
  const value = clampAudio(position, 0, 1);
  return value <= 0.4 ? 20 * (1 - value / 0.4) : (-(value - 0.4) / 0.6) * 61;
}
export function waveformPeak(peaks: Float32Array, duration: number, start: number, end: number, loop: boolean) {
  if (!peaks.length || duration <= 0 || (!loop && start >= duration)) return 0;
  const step = duration / peaks.length;
  let peak = 0;
  // 每个显示柱覆盖的真实源采样区间；循环段可能跨越文件末尾。
  const first = Math.floor(start / step),
    last = Math.max(first, Math.ceil(end / step) - 1);
  if (loop && last - first >= peaks.length) return peaks.reduce((maximum, value) => Math.max(maximum, value), 0);
  for (let i = first; i <= last; i++) {
    const index = loop ? ((i % peaks.length) + peaks.length) % peaks.length : i;
    if (index >= 0 && index < peaks.length) peak = Math.max(peak, peaks[index]);
  }
  return peak;
}
