// Offscreen 2D canvas for measuring node-label text widths at layout
// time. Cached per (family, size, weight, text) so repeated calls
// during recompiles are free.

let _ctx = null;
function getCtx() {
  if (_ctx) return _ctx;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  _ctx = c.getContext("2d");
  return _ctx;
}

const _cache = new Map();

export const measureLabelImpl = (family) => (size) => (weight) => (text) => () => {
  const key = `${weight} ${size}px ${family}|${text}`;
  const hit = _cache.get(key);
  if (hit !== undefined) return hit;
  const ctx = getCtx();
  if (!ctx) {
    // Server-side / no DOM — fall back to character-count approximation.
    return text.length * size * 0.62;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  _cache.set(key, w);
  return w;
};
