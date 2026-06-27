let _ctx = null;
function getCtx() {
  if (_ctx) return _ctx;
  if (typeof document === "undefined") return null;
  return (_ctx = document.createElement("canvas").getContext("2d"));
}

const _cache = new Map();

function measure(family, size, weight, text, extract, miss) {
  const font = `${weight} ${size}px ${family}`;
  const key = font + "|" + text;
  if (_cache.has(key)) return _cache.get(key);
  const ctx = getCtx();
  if (!ctx) return miss;
  ctx.font = font;
  const value = extract(ctx.measureText(text));
  const fonts = typeof document !== "undefined" ? document.fonts : null;
  const loaded = !fonts || fonts.check(font);
  if (loaded) _cache.set(key, value);
  else if (fonts && fonts.load) { try { fonts.load(font); } catch (_) {} }
  return value;
}

export const nativeMeasureWidthImpl = (family, size, weight, text) =>
  measure(family, size, weight, text, (m) => m.width, -1);

export const nativeMeasureInkImpl = (family, size, weight, text) =>
  measure(family, size, weight, text,
    (m) => ({ ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent }),
    { ascent: -1, descent: -1 });
