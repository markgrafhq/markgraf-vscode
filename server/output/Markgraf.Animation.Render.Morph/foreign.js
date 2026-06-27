// Editor (JS) backend for Markgraf.Animation.Render.Morph.
//
// Direct port of the original PureScript implementation that used to live
// in this module.  The CLI runs the Go port at cli/ffi/morph/Morph.go;
// keeping a JS twin lets the in-browser editor work unchanged.
//
// Both implementations must stay byte-for-byte equivalent in their
// floating-point output, so the genie morph looks the same in the
// editor preview and the rendered MP4.

// distP :: Point -> Point -> Number
function distP(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// closedSegments :: Array Point -> Array { a, b, len }
function closedSegments(pts) {
  const m = pts.length;
  const out = new Array(m);
  for (let i = 0; i < m; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % m];
    out[i] = { a, b, len: distP(a, b) };
  }
  return out;
}

// pointAtCumLen — find the point at arc length `targetLen` along `segs`.
function pointAtCumLen(segs, pts, targetLen) {
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const segStart = acc;
    const segEnd = segStart + seg.len;
    if (targetLen <= segEnd) {
      const local = seg.len > 1e-6 ? (targetLen - segStart) / seg.len : 0;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * local,
        y: seg.a.y + (seg.b.y - seg.a.y) * local,
      };
    }
    acc = segEnd;
  }
  return pts.length > 0 ? pts[pts.length - 1] : { x: 0, y: 0 };
}

// arcLengthSample :: Int -> Array Point -> Array Point
function arcLengthSample(n, pts) {
  if (n <= 0 || pts.length === 0) return [];
  const segs = closedSegments(pts);
  let totalLen = 0;
  for (let i = 0; i < segs.length; i++) totalLen += segs[i].len;
  const out = new Array(n);
  for (let k = 0; k < n; k++) {
    out[k] = pointAtCumLen(segs, pts, (k * totalLen) / n);
  }
  return out;
}

// rotateBy :: Int -> Array Point -> Array Point
function rotateBy(i, pts) {
  const n = pts.length;
  if (n === 0) return pts;
  const k = (((i % n) + n) % n) | 0;
  const out = new Array(n);
  for (let j = 0; j < n; j++) out[j] = pts[(j + k) % n];
  return out;
}

// bestRotation :: Array Point -> Array Point -> Array Point
function bestRotation(a, b) {
  const n = b.length;
  if (n === 0) return b;
  let bestI = 0;
  let bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    let score = 0;
    for (let j = 0; j < n; j++) {
      const ap = a[j] || { x: 0, y: 0 };
      const bp = b[(j + i) % n] || { x: 0, y: 0 };
      const dx = ap.x - bp.x;
      const dy = ap.y - bp.y;
      score += dx * dx + dy * dy;
    }
    if (score < bestScore) {
      bestScore = score;
      bestI = i;
    }
  }
  return rotateBy(bestI, b);
}

// prepareMorph :: Int -> Array Point -> Array Point -> { from, to }
export const prepareMorph = (n) => (from) => (to) => {
  const fromSampled = arcLengthSample(n, from);
  const toSampled = arcLengthSample(n, to);
  const aligned = bestRotation(fromSampled, toSampled);
  return { from: fromSampled, to: aligned };
};

// centroid :: Array Point -> Point
function centroid(pts) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sx += pts[i].x;
    sy += pts[i].y;
  }
  return { x: sx / n, y: sy / n };
}

// unitVec :: Point -> Point -> Point
function unitVec(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 1e-4) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

// relaxPass :: Number -> Array Point -> Array Point
function relaxPass(alpha, pts) {
  const m = pts.length;
  if (m === 0) return pts;
  const out = new Array(m);
  for (let i = 0; i < m; i++) {
    const prev = pts[((i - 1) % m + m) % m];
    const next = pts[((i + 1) % m + m) % m];
    const v = pts[i];
    out[i] = {
      x: v.x + ((prev.x + next.x) / 2 - v.x) * alpha,
      y: v.y + ((prev.y + next.y) / 2 - v.y) * alpha,
    };
  }
  return out;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// morphAtGenie :: Number -> Array Point -> Array Point -> { maxDelay, smoothPasses } -> Array Point
export const morphAtGenie = (t) => (fromV) => (toV) => (opts) => {
  const n = fromV.length;
  if (n === 0) return [];

  const fromCenter = centroid(fromV);
  const toCenter = centroid(toV);
  const motionDir = unitVec(fromCenter, toCenter);

  const projections = new Array(n);
  let minProj = Infinity;
  let maxProj = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = fromV[i];
    const p =
      (v.x - fromCenter.x) * motionDir.x +
      (v.y - fromCenter.y) * motionDir.y;
    projections[i] = p;
    if (p < minProj) minProj = p;
    if (p > maxProj) maxProj = p;
  }
  const range = maxProj - minProj;

  let out = new Array(n);
  for (let i = 0; i < n; i++) {
    const from = fromV[i];
    const to = toV[i];
    if (to === undefined) {
      out[i] = from;
      continue;
    }
    const d = range <= 1e-4 ? 0 : opts.maxDelay * (1 - (projections[i] - minProj) / range);
    const denom = Math.max(1e-4, 1 - d);
    const localT = clamp01((t - d) / denom);
    const eased = localT * localT * (3 - 2 * localT);
    out[i] = {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
    };
  }

  for (let pass = 0; pass < opts.smoothPasses; pass++) {
    out = relaxPass(0.5, out);
  }
  return out;
};
