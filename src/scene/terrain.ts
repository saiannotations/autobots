import { makeNoise, srand } from '../gfx/texgen';
import { CROPS, CROP_TYPES } from '../sim/constants';

export const N1 = makeNoise(7), N2 = makeNoise(19), N3 = makeNoise(31);
export { srand };
export const smooth = (v: number) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };

/** Height of the land: flat farm, rolling meadow beyond r = 62. */
export function groundH(x: number, z: number) {
  const r = Math.hypot(x, z); if (r <= 62) return -0.02;
  const k = smooth((r - 62) / 90);
  return (N1.fbm(x * 0.01 + 5, z * 0.01 + 5, 64, 4) * 14 + 2) * k - 0.02;
}

const fieldRects: number[][] = [];
for (const t of CROP_TYPES) {
  const d = CROPS[t]; const w = d.cols * d.sp + 2.2, dir = Math.sign(d.pz);
  const z0 = d.pz - dir * d.sp - dir * (d.sp / 2 + 1.1), z1 = d.pz - dir * d.sp + dir * ((d.maxRows - 1) * d.sp + d.sp / 2 + 1.1);
  fieldRects.push([d.px - w / 2, d.px + w / 2, Math.min(z0, z1) - 0.5, Math.max(z0, z1) + 0.5]);
}
/** Places where grass must not grow (fields, plaza, paths, pond, buildings). */
export function excluded(x: number, z: number) {
  if (Math.abs(x) < 2.9 && z > 13) return true;
  if (x > -12.6 && x < 12.6 && z > 1.6 && z < 15.6) return true;
  if (x > -6.4 && x < 6.4 && z > -4.2 && z < 3.4) return true;
  if (Math.hypot(x, z + 11.5) < 3.8) return true;
  if (Math.abs(x) < 1.9 && z > -24 && z < -3) return true;
  { const dx = x / 12.4, dz = (z + 31) / 8.9; if (dx * dx + dz * dz < 1) return true; }
  for (const r of fieldRects) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) return true;
  if (x > -48 && x < -30 && z > -46 && z < -28) return true;
  if (Math.hypot(x - 41, z + 38) < 2.5) return true;
  if (x > -49.5 && x < -33.5 && z > -7.5 && z < 10.5) return true;
  if (Math.hypot(x - 14, z + 38) < 3.4) return true;
  return false;
}
