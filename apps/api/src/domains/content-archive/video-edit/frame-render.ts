/** 同一套画布变换用于全局旧配方与逐片段预览变换，保证导出坐标一致。 */
import { archiveFrameGeometry, type ArchiveFrame } from "@toolbox/shared";
export function appendVideoFrame(
  filters: string[],
  input: string,
  width: number,
  height: number,
  settings?: ArchiveFrame
) {
  let videoLabel = input;
  let geometry = { width, height };
  let content = { width, height };
  if (settings) {
    const frame = settings;
    const size = archiveFrameGeometry(width, height, frame);
    const transforms = [
      `scale=${Math.max(2, Math.floor(width / 2) * 2)}:${Math.max(2, Math.floor(height / 2) * 2)}`,
      "setsar=1"
    ];
    if (frame.rotation === 90) transforms.push("transpose=clock");
    else if (frame.rotation === 180) transforms.push("hflip", "vflip");
    else if (frame.rotation === 270) transforms.push("transpose=cclock");
    if (frame.flipX) transforms.push("hflip");
    if (frame.flipY) transforms.push("vflip");
    if (frame.fit === "contain") transforms.push(`scale=${size.contentWidth}:${size.contentHeight}`);
    else transforms.push(`crop=${size.width}:${size.height}:${size.x}:${size.y}`);
    filters.push(`[${videoLabel}]${transforms.join(",")}[framed]`);
    videoLabel = "framed";
    geometry = size;
    content = { width: size.contentWidth, height: size.contentHeight };
  }
  if (settings) {
    const frame = settings,
      sx = frame.scaleX ?? 1,
      sy = frame.scaleY ?? 1,
      angle = ((frame.angle ?? 0) * Math.PI) / 180;
    if (
      frame.fit === "contain" ||
      sx !== 1 ||
      sy !== 1 ||
      angle ||
      frame.offsetX ||
      frame.offsetY ||
      frame.cornerRadius
    ) {
      const w = Math.max(2, Math.floor((content.width * sx) / 2) * 2),
        h = Math.max(2, Math.floor((content.height * sy) / 2) * 2),
        r = Math.min(content.width, content.height) * (frame.cornerRadius ?? 0);
      const rounded =
        r > 0
          ? `,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(max(abs(X-W/2)-(W/2-${r}),0),max(abs(Y-H/2)-(H/2-${r}),0)),${r}),255,0)',format=rgba`
          : "";
      filters.push(
        `[${videoLabel}]split=2[transformSource][transformBackground]`,
        `[transformBackground]scale=${geometry.width}:${geometry.height},drawbox=color=black:t=fill[transformBase]`,
        `[transformSource]format=rgba${rounded},scale=${w}:${h},rotate=${angle}:ow=rotw(${angle}):oh=roth(${angle}):c=none[transformImage]`,
        `[transformBase][transformImage]overlay=x=(W-w)/2+${(frame.offsetX ?? 0) * geometry.width}:y=(H-h)/2+${(frame.offsetY ?? 0) * geometry.height}:format=auto,format=yuv420p[transformed]`
      );
      videoLabel = "transformed";
    }
  }
  return { videoLabel, geometry };
}
