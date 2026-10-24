/** Bounded region history. Never duplicate a full large RGBA image for undo. */
export function createRefinement(
  width: number,
  height: number,
  initialErase?: Uint8ClampedArray,
  initialRestore?: Uint8ClampedArray,
  budget = 64 * 1024 * 1024
) {
  const erase = initialErase?.slice() ?? new Uint8ClampedArray(width * height);
  const restore = initialRestore?.slice() ?? new Uint8ClampedArray(width * height);
  type Change = { index: number; e: number; r: number; nextE: number; nextR: number };
  let history: Change[][] = [],
    cursor = 0,
    used = 0;
  let stroke = new Map<number, Change>();
  let overflow = false;
  function begin() {
    stroke = new Map();
    overflow = false;
  }
  function paint(x: number, y: number, radius: number, strength: number, mode: "erase" | "restore") {
    const left = Math.max(0, Math.floor(x - radius)),
      right = Math.min(width - 1, Math.ceil(x + radius));
    const top = Math.max(0, Math.floor(y - radius)),
      bottom = Math.min(height - 1, Math.ceil(y + radius));
    if (right < left || bottom < top) return { left: 0, top: 0, width: 0, height: 0 };
    for (let py = top; py <= bottom; py++)
      for (let px = left; px <= right; px++) {
        const weight = Math.max(0, 1 - Math.hypot(px - x, py - y) / radius) * strength;
        if (!weight) continue;
        const index = py * width + px;
        const previous = stroke.get(index) ?? { index, e: erase[index], r: restore[index], nextE: 0, nextR: 0 };
        const e = mode === "erase" ? erase[index] + (255 - erase[index]) * weight : erase[index] * (1 - weight);
        const r = mode === "restore" ? restore[index] + (255 - restore[index]) * weight : restore[index] * (1 - weight);
        erase[index] = Math.round(e);
        restore[index] = Math.min(255 - erase[index], Math.round(r));
        previous.nextE = erase[index];
        previous.nextR = restore[index];
        if (!overflow) {
          stroke.set(index, previous);
          while (used + stroke.size * 128 > budget && history.length) {
            used -= history.shift()!.length * 128;
            cursor = Math.max(0, cursor - 1);
          }
          if (stroke.size * 128 > budget) {
            stroke.clear();
            overflow = true;
          }
        }
      }
    return { left, top, width: right - left + 1, height: bottom - top + 1 };
  }
  function end() {
    if (!stroke.size) return;
    history = history.slice(0, cursor);
    const changes = Array.from(stroke.values());
    history.push(changes);
    cursor = history.length;
    // Conservatively account for JS object/array overhead as well as numeric values.
    used = history.reduce((sum, item) => sum + item.length * 128, 0);
    while (used > budget && history.length) {
      used -= history.shift()!.length * 128;
      cursor--;
    }
    stroke.clear();
  }
  function move(delta: -1 | 1) {
    if (delta === -1 && cursor > 0)
      for (const item of history[--cursor]) {
        erase[item.index] = item.e;
        restore[item.index] = item.r;
      }
    if (delta === 1 && cursor < history.length)
      for (const item of history[cursor++]) {
        erase[item.index] = item.nextE;
        restore[item.index] = item.nextR;
      }
  }
  return {
    erase,
    restore,
    begin,
    paint,
    end,
    undo: () => move(-1),
    redo: () => move(1),
    get canUndo() {
      return cursor > 0;
    },
    get canRedo() {
      return cursor < history.length;
    },
    get historyBytes() {
      return used;
    }
  };
}

export function refinePixels(
  base: Uint8ClampedArray,
  original: Uint8ClampedArray | undefined,
  erase: Uint8ClampedArray,
  restore: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  rect: { left: number; top: number; width: number; height: number }
) {
  for (let y = rect.top; y < rect.top + rect.height; y++)
    for (let x = rect.left; x < rect.left + rect.width; x++) {
      const p = y * width + x,
        i = p * 4;
      const e = erase[p] / 255,
        r = restore[p] / 255;
      const a = (base[i + 3] / 255) * Math.max(0, 1 - e - r),
        b = ((original?.[i + 3] ?? 0) / 255) * r,
        alpha = a + b;
      for (let c = 0; c < 3; c++)
        output[i + c] = alpha ? Math.round((base[i + c] * a + (original?.[i + c] ?? 0) * b) / alpha) : 0;
      output[i + 3] = Math.round(alpha * 255);
    }
}
