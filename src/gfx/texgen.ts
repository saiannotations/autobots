/* Procedural PBR textures: albedo + normal (+ roughness in alpha) generated without the DOM,
   so they can be built inside a Web Worker. Every texture tiles seamlessly. */

export interface TexOut { name: string; size: number; albedo: Uint8Array; normal: Uint8Array; srgb: boolean }

export function srand(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

export function makeNoise(seed: number) {
  const R = srand(seed), p = new Uint8Array(512), perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const v = new Float32Array(256); for (let i = 0; i < 256; i++) v[i] = R();
  const n = (x: number, y: number, per: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const w = (a: number) => ((a % per) + per) % per;
    const H = (i: number, j: number) => v[p[p[w(i) & 255] + (w(j) & 255)]];
    const u = xf * xf * (3 - 2 * xf), t = yf * yf * (3 - 2 * yf);
    return lerp(lerp(H(xi, yi), H(xi + 1, yi), u), lerp(H(xi, yi + 1), H(xi + 1, yi + 1), u), t);
  };
  const fbm = (x: number, y: number, per: number, oct: number) => { let s = 0, a = 0.5, f = 1, tot = 0; for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f, per * f); tot += a; a *= 0.5; f *= 2; } return s / tot; };
  return { n, fbm };
}
const N1 = makeNoise(7), N2 = makeNoise(19), N3 = makeNoise(31), N4 = makeNoise(53);

/** Worley cells, periodic over `cells`. Returns [F1, F2, cell value]. */
function worley(u: number, v: number, cells: number, pts: number[][]) {
  let f1 = 9, f2 = 9, cv = 0; const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const ii = (((ci + ox) % cells) + cells) % cells, jj = (((cj + oy) % cells) + cells) % cells;
    const p = pts[jj * cells + ii]; const px = p[0] + Math.floor((ci + ox) / cells), py = p[1] + Math.floor((cj + oy) / cells);
    const dx = u - px, dy = v - py; const d = dx * dx + dy * dy;
    if (d < f1) { f2 = f1; f1 = d; cv = p[2]; } else if (d < f2) f2 = d;
  }
  return [Math.sqrt(f1), Math.sqrt(f2), cv];
}
function cellPts(cells: number, seed: number) { const R = srand(seed), pts: number[][] = []; for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + R() * 0.7) / cells, (j + 0.15 + R() * 0.7) / cells, R()]); return pts; }

type Px = (u: number, v: number, o: number[]) => void; // o = [r,g,b,height,roughness]
function build(name: string, size: number, fn: Px, strength: number, srgb = true): TexOut {
  const albedo = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4), H = new Float32Array(size * size), Rgh = new Float32Array(size * size);
  const o = [0, 0, 0, 0, 0.8];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    o[4] = 0.8; fn(x / size, y / size, o); const i = y * size + x;
    albedo[i * 4] = clamp(o[0], 0, 1) * 255; albedo[i * 4 + 1] = clamp(o[1], 0, 1) * 255; albedo[i * 4 + 2] = clamp(o[2], 0, 1) * 255; albedo[i * 4 + 3] = 255;
    H[i] = o[3]; Rgh[i] = o[4];
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = H[y * size + ((x - 1 + size) % size)], r = H[y * size + ((x + 1) % size)], u = H[((y - 1 + size) % size) * size + x], d = H[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const i = (y * size + x) * 4;
    normal[i] = (nx * 0.5 + 0.5) * 255; normal[i + 1] = (ny * 0.5 + 0.5) * 255; normal[i + 2] = (nz * 0.5 + 0.5) * 255; normal[i + 3] = clamp(Rgh[y * size + x], 0, 1) * 255;
  }
  return { name, size, albedo, normal, srgb };
}

export function generateAll(hi: boolean): TexOut[] {
  const S = hi ? 1024 : 512, M = hi ? 512 : 256;
  const out: TexOut[] = [];
  // Meadow: mixed grass, clover patches, dry tufts and bare soil peeking through
  out.push(build('grass', S, (u, v, o) => {
    const h = N1.fbm(u * 8, v * 8, 8, 6), d = N2.n(u * 128, v * 128, 128), cl = N3.fbm(u * 5, v * 5, 5, 3), bare = N4.fbm(u * 3, v * 3, 3, 4);
    const dry = smooth((cl - 0.6) / 0.14) * 0.7, soil = smooth((bare - 0.7) / 0.1) * 0.3;
    let r = lerp(0.17, 0.33, h) + d * 0.05, g = lerp(0.29, 0.45, h) + d * 0.07, b = lerp(0.09, 0.17, h) + d * 0.03;
    r = lerp(r, 0.48, dry * 0.55); g = lerp(g, 0.44, dry * 0.55); b = lerp(b, 0.25, dry * 0.55);
    r = lerp(r, 0.32, soil); g = lerp(g, 0.24, soil); b = lerp(b, 0.16, soil);
    o[0] = r; o[1] = g; o[2] = b; o[3] = h * 0.55 + d * 0.45; o[4] = 0.92 - d * 0.1;
  }, 3.2));
  // Tilled soil with furrows, clods and pebbles
  out.push(build('soil', M, (u, v, o) => {
    const s = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 6), h0 = N1.fbm(u * 6, v * 6, 6, 5), pb = N2.n(u * 64, v * 64, 64), clod = N3.fbm(u * 16, v * 16, 16, 3);
    const h = s * 0.55 + h0 * 0.25 + clod * 0.2 + (pb > 0.84 ? 0.18 : 0); const k = 0.55 + 0.5 * h; const moist = 1 - s * 0.25;
    o[0] = 0.29 * k * moist + (pb > 0.84 ? 0.08 : 0); o[1] = 0.2 * k * moist + (pb > 0.84 ? 0.07 : 0); o[2] = 0.13 * k * moist + (pb > 0.84 ? 0.06 : 0); o[3] = h; o[4] = 0.95;
  }, 4.5));
  // Cobblestone pavement with grout, wear and moss in the gaps
  { const pts = cellPts(8, 5); out.push(build('stone', S, (u, v, o) => {
    const [f1, f2, cv] = worley(u, v, 8, pts); const e = f2 - f1; const grout = smooth(e / 0.022); const dome = smooth(1 - f1 * 8 * 0.9);
    const nn = N1.fbm(u * 24, v * 24, 24, 4), sp = N2.n(u * 200, v * 200, 200); const moss = (1 - grout) * smooth((N3.fbm(u * 6, v * 6, 6, 3) - 0.45) / 0.15);
    const k = (0.52 + cv * 0.22 + nn * 0.22 + sp * 0.05) * (0.4 + 0.6 * grout);
    o[0] = lerp(0.6 * k, 0.24, moss * 0.6); o[1] = lerp(0.56 * k, 0.3, moss * 0.6); o[2] = lerp(0.5 * k, 0.15, moss * 0.6);
    o[3] = grout * (0.65 + dome * 0.35) + nn * 0.15; o[4] = lerp(0.95, 0.68, grout) - nn * 0.08;
  }, 7)); }
  // Gravel / dirt path
  out.push(build('path', M, (u, v, o) => {
    const a = N1.n(u * 96, v * 96, 96), b = N2.fbm(u * 8, v * 8, 8, 4), c = N3.n(u * 40, v * 40, 40);
    const stone = smooth((a - 0.62) / 0.1); const k = 0.48 + b * 0.25 + c * 0.12 + stone * 0.25;
    o[0] = 0.64 * k; o[1] = 0.56 * k; o[2] = 0.45 * k; o[3] = a * 0.6 + c * 0.4; o[4] = 0.95 - stone * 0.15;
  }, 3.5));
  // Weathered wooden planks
  out.push(build('wood', M, (u, v, o) => {
    const plank = Math.floor(u * 4), pv = (u * 4) % 1; const seam = smooth(Math.min(pv, 1 - pv) / 0.025);
    const grain = 0.5 + 0.5 * Math.sin((v * 34 + N1.fbm(u * 4 + plank * 1.7, v * 2, 4, 4) * 9) * Math.PI); const knot = smooth(1 - Math.hypot(((u * 4) % 1) - 0.5, ((v * 2 + plank * 0.37) % 1) - 0.5) * 9);
    const k = (0.5 + grain * 0.25 + (plank % 2) * 0.07 - knot * 0.25) * (0.45 + 0.55 * seam);
    o[0] = 0.55 * k; o[1] = 0.38 * k; o[2] = 0.23 * k; o[3] = seam * 0.7 + grain * 0.3; o[4] = 0.7 + grain * 0.15;
  }, 3));
  // Bark with deep vertical fissures
  out.push(build('bark', M, (u, v, o) => {
    const r = N1.fbm(u * 10, v * 2, 10, 5); const ridge = 1 - Math.abs(r * 2 - 1); const lic = smooth((N2.fbm(u * 6, v * 6, 6, 3) - 0.6) / 0.1);
    const k = 0.3 + ridge * 0.45; o[0] = lerp(0.34 * k, 0.45, lic * 0.4); o[1] = lerp(0.26 * k, 0.5, lic * 0.4); o[2] = lerp(0.19 * k, 0.35, lic * 0.4); o[3] = ridge; o[4] = 0.92;
  }, 6));
  // Leaf canopy detail (grey so it can be tinted per tree)
  out.push(build('leaf', M, (u, v, o) => {
    const a = N1.n(u * 48, v * 48, 48), b = N2.fbm(u * 6, v * 6, 6, 3), c = N3.n(u * 120, v * 120, 120);
    const k = 0.55 + a * 0.3 + b * 0.3 + c * 0.1; o[0] = k; o[1] = k; o[2] = k; o[3] = a * 0.7 + c * 0.3; o[4] = 0.7 - c * 0.15;
  }, 4.5));
  // Water ripples (normal only)
  out.push(build('water', M, (u, v, o) => { const h = N3.fbm(u * 6, v * 6, 6, 6); o[0] = o[1] = o[2] = h; o[3] = h; }, 8, false));
  // Red barn boards with peeling paint
  out.push(build('barn', M, (u, v, o) => {
    const b = (u * 8) % 1; const seam = smooth(Math.min(b, 1 - b) / 0.05); const w = N1.fbm(u * 8, v * 3, 8, 4); const peel = smooth((N2.fbm(u * 5, v * 5, 5, 4) - 0.6) / 0.07);
    const k = (0.7 + w * 0.3) * (0.55 + 0.45 * seam);
    o[0] = lerp(0.5, 0.6, peel) * k; o[1] = lerp(0.11, 0.48, peel) * k; o[2] = lerp(0.09, 0.36, peel) * k; o[3] = seam * 0.8 + peel * 0.2; o[4] = lerp(0.62, 0.9, peel);
  }, 3));
  // Corrugated, lightly rusted metal
  out.push(build('metal', M, (u, v, o) => {
    const s = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 12); const r = N1.fbm(u * 4, v * 4, 4, 4); const rust = smooth((N2.fbm(u * 6, v * 6, 6, 4) - 0.62) / 0.1);
    const k = 0.55 + r * 0.25; o[0] = lerp(0.62 * k, 0.45, rust); o[1] = lerp(0.64 * k, 0.25, rust); o[2] = lerp(0.66 * k, 0.14, rust); o[3] = s; o[4] = lerp(0.35, 0.85, rust);
  }, 3));
  // Cable-knit wool (sweaters, scarves, beanies) — grey, tinted per person
  out.push(build('knit', 256, (u, v, o) => {
    const col = (u * 8) % 1, row = (v * 16) % 1; const cable = Math.abs(Math.sin((v * 16 + (Math.floor(u * 8) % 2) * 0.5) * Math.PI));
    const vshape = 1 - Math.abs(col - 0.5) * 2; const stitch = smooth(vshape * 1.4 - Math.abs(row - 0.5) * 0.6) * (0.7 + cable * 0.3);
    const fuzz = N1.n(u * 160, v * 160, 160);
    const k = 0.55 + stitch * 0.38 + fuzz * 0.07; o[0] = k; o[1] = k; o[2] = k; o[3] = stitch * 0.85 + fuzz * 0.15; o[4] = 1.0;
  }, 5));
  // Woven cotton (shirts, trousers)
  out.push(build('fabric', 256, (u, v, o) => {
    const wx = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 64), wy = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 64); const n = N1.n(u * 32, v * 32, 32);
    const k = 0.82 + (wx * wy) * 0.12 + n * 0.06; o[0] = k; o[1] = k; o[2] = k; o[3] = wx * 0.5 + wy * 0.5; o[4] = 0.9;
  }, 1.5));
  // Brushed paint for the robots: tiny orange-peel and wear on the edges
  out.push(build('paint', 256, (u, v, o) => {
    const n = N1.fbm(u * 24, v * 24, 24, 4), s = N2.n(u * 180, v * 180, 180);
    const k = 0.94 + n * 0.06; o[0] = k; o[1] = k; o[2] = k; o[3] = n * 0.4 + s * 0.6; o[4] = 0.3 + s * 0.12;
  }, 0.8));
  return out;
}
