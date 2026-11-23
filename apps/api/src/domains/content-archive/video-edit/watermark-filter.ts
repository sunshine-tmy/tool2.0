/** 只由校验后的数值编译轨迹；时间 t 始终是原视频时间，不随预览裁剪重置。 */
import type { ArchiveWatermarkSettings } from "@toolbox/shared";
import { archiveWatermarkBouncePath } from "@toolbox/shared";
export function watermarkFilter(
  settings: ArchiveWatermarkSettings,
  input: number,
  width: number,
  height: number,
  angle = 0,
  offsetX = 0,
  offsetY = 0,
  constrainMotion = false
) {
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
  const coordinate = (axis: "x" | "y") => {
    const total = axis === "x" ? "W" : "H";
    const original = axis === "x" ? width : height;
    const rotated = axis === "x" ? "w" : "h";
    const offset = axis === "x" ? offsetX : offsetY;
    if (constrainMotion && m.type === "bounce")
      return `if(gte(${rotated},${total}),(${total}-${rotated})/2,(${total}-${rotated})*clip(${position(axis)},0,1))`;
    const center = `(${total}-${original})*clip(${position(axis)},0,1)+${original}/2+(${offset})`;
    // 与 watermarkTrackGeometry 相同：先限制旋转后中心，再换算 overlay 左上角。
    return constrainMotion && m.type !== "fixed"
      ? `if(gte(${rotated},${total}),(${total}-${rotated})/2,clip(${center},${rotated}/2,${total}-${rotated}/2)-${rotated}/2)`
      : `(${total}-${original})*clip(${position(axis)},0,1)+${original}/2-${rotated}/2+(${offset})`;
  };
  return (
    `[${input}:v:0]scale=${width}:${height},format=rgba${angle ? `,rotate=${(angle * Math.PI) / 180}:ow=rotw(${(angle * Math.PI) / 180}):oh=roth(${(angle * Math.PI) / 180}):c=none` : ""},colorchannelmixer=aa=${settings.opacity / 100},setpts=PTS-STARTPTS[logo];` +
    `[base][logo]overlay=x='${coordinate("x")}':y='${coordinate("y")}':enable='${visible}':eval=frame:format=auto[watermarked]`
  );
}
