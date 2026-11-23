/** 属性控件的显示精度；归一化坐标和帧时间仍保留计算精度。 */
export function editorNumber(value: number, precision = 0): number {
  if (!Number.isFinite(value)) return 0;
  const result = Number(value.toFixed(precision));
  return Object.is(result, -0) ? 0 : result;
}
export const editorTooltip =
  (precision = 0) =>
  (value: number) =>
    editorNumber(value, precision).toFixed(precision);

// -61 是独立的静音刻度；-60 dB 仍保留真实的非零增益。
export const VOLUME_MARKS = { 0: "0 dB" };
export const volumeDb = (percent: number) =>
  percent <= 0 ? -61 : editorNumber(Math.max(-60, Math.min(20, 20 * Math.log10(percent / 100))), 1);
export const volumePercent = (db: number) =>
  db <= -61 ? 0 : editorNumber(100 * 10 ** (editorNumber(Math.max(-60, Math.min(20, db)), 1) / 20), 6);
export const formatVolume = (db: number | null) =>
  db === null ? "" : db <= -61 ? "−∞" : editorNumber(db, 1).toFixed(1);
export const parseVolume = (text: string) =>
  /∞|inf/i.test(text) ? -61 : Number.isFinite(Number(text)) ? Number(text) : null;
export const volumeTooltip = (db: number) => `${formatVolume(db)} dB`;
export const snapVolume = (db: number) => (db < -60 ? -61 : Math.abs(db) <= 0.75 ? 0 : db);
export const previewRate = (rate: number) => Math.min(16, Math.max(0.0625, rate));
