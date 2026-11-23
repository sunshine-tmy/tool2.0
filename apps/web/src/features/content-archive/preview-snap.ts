export interface PreviewSnapLock {
  anchor: -1 | 0 | 1;
  target: number;
}

/** The same screen-pixel acquire/release distances apply at any preview zoom. */
export function snapPreviewAxis(center: number, half: number, span: number, scale: number, previous?: PreviewSnapLock) {
  const fit = Math.max(0.001, scale),
    acquire = 6 / fit,
    release = 10 / fit;
  const candidates: PreviewSnapLock[] = [
    { anchor: 0, target: span / 2 },
    { anchor: -1, target: 0 },
    { anchor: 1, target: span },
    { anchor: -1, target: span },
    { anchor: 1, target: 0 }
  ];
  const distance = (point: PreviewSnapLock) => Math.abs(center + point.anchor * half - point.target);
  let lock = previous && distance(previous) <= release ? previous : undefined;
  if (!lock) {
    let nearest = acquire;
    for (const candidate of candidates) {
      const delta = distance(candidate);
      if (delta <= acquire && (!lock || delta < nearest - 1e-8)) {
        lock = candidate;
        nearest = delta;
      }
    }
  }
  const value = lock ? lock.target - lock.anchor * half : center;
  const guides = lock
    ? candidates
        .filter((candidate) => Math.abs(value + candidate.anchor * half - candidate.target) < 1e-6)
        .map((candidate) => candidate.target)
    : [];
  return { value, lock, guides: [...new Set(guides)] };
}

export function previewRotatedExtents(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180,
    cos = Math.abs(Math.cos(radians)),
    sin = Math.abs(Math.sin(radians));
  return { halfW: (width * cos + height * sin) / 2, halfH: (width * sin + height * cos) / 2 };
}
