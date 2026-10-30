/** 只由校验后的数值编译轨迹；时间 t 始终是原视频时间，不随预览裁剪重置。 */
import type { ArchiveWatermarkSettings } from "@toolbox/shared";
import { archiveWatermarkBouncePath } from "@toolbox/shared";
export function watermarkFilter(settings: ArchiveWatermarkSettings, input: number, width: number, height: number) {
  const m = settings.motion,
    elapsed = `(t-${settings.startSeconds})`;
  const position = (axis: "x" | "y") => {
    const from = m.from[axis],
      to = m.to[axis];
    if (m.type === "linear") return `${from}+(${to - from})*clip(${elapsed}/${m.periodSeconds},0,1)`;
    if (m.type === "ping-pong")
      return `${from}+(${to - from})*(1-abs(mod(2*max(0,${elapsed})/${m.periodSeconds},2)-1))`;
    if (m.type === "bounce") {
      const path = archiveWatermarkBouncePath(settings);
      if (path) {
        const progress = `((1-abs(mod(2*max(0,${elapsed})/${m.periodSeconds},2)-1))*${path.length - 1})`;
        let value = String(path[path.length - 1][axis]);
        for (let i = path.length - 1; i > 0; i--)
          value = `if(lte(${progress},${i}),${path[i - 1][axis]}+(${path[i][axis] - path[i - 1][axis]})*clip(${progress}-${i - 1},0,1),${value})`;
        return value;
      }
      const direction = axis === "x" ? m.directionX : m.directionY;
      return `1-abs(mod(mod(${from}+(${direction})*max(0,${elapsed})/${m.periodSeconds},2)+2,2)-1)`;
    }
    if (m.type === "keyframes" && m.keyframes.length >= 2) {
      const frames = m.keyframes;
      let value = String(frames[frames.length - 1][axis]);
      for (let i = frames.length - 1; i > 0; i--) {
        const a = frames[i - 1],
          b = frames[i];
        value = `if(lte(t,${b.timeSeconds}),${a[axis]}+(${b[axis] - a[axis]})*clip((t-${a.timeSeconds})/${b.timeSeconds - a.timeSeconds},0,1),${value})`;
      }
      return value;
    }
    return String(from);
  };
  const visible =
    settings.endSeconds === null
      ? `gte(t,${settings.startSeconds})`
      : `between(t,${settings.startSeconds},${settings.endSeconds})`;
  return (
    `[${input}:v:0]scale=${width}:${height},format=rgba,colorchannelmixer=aa=${settings.opacity / 100},setpts=PTS-STARTPTS[logo];` +
    `[base][logo]overlay=x='(W-w)*clip(${position("x")},0,1)':y='(H-h)*clip(${position("y")},0,1)':enable='${visible}':eval=frame:format=auto[watermarked]`
  );
}
