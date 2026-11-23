/** 拆成兼容现有运行时的 0.5～2 倍链，视频原声和独立音频均保持音高。 */
export function audioTempo(rate: number) {
  const factors: number[] = [];
  while (rate > 2) {
    factors.push(2);
    rate /= 2;
  }
  while (rate < 0.5) {
    factors.push(0.5);
    rate /= 0.5;
  }
  factors.push(rate);
  return factors.map((factor) => `atempo=${factor}`).join(",");
}
