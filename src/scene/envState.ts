import * as THREE from 'three';
import { SEASONS, type SeasonKey } from '../sim/constants';

/** Environment values blended smoothly toward the current season every frame. */
const NUM = ['grow', 'cust', 'wind', 'rain', 'snow', 'wet', 'haze', 'frozen', 'cloud', 'turb', 'ray', 'mie', 'fog', 'sat', 'exp', 'bloom', 'sun', 'hemi', 'grassH', 'fireflies'] as const;
type NumKey = typeof NUM[number];
export const env = {
  n: {} as Record<NumKey, number>,
  fogDay: new THREE.Color(), grass: new THREE.Color(), leaf: new THREE.Color(),
  tint: new THREE.Vector3(1, 1, 1),
  snowCover: 0, blossom: 0, leafFall: 0,
  daylight: 1, night: 0, dusk: 0, hour: 12,
  sunDir: new THREE.Vector3(0.4, 0.8, 0.3),
  flash: 0,
  season: 'spring' as SeasonKey,
  ready: false,
};
const tmp = new THREE.Color();

export function snapEnv(season: SeasonKey) {
  const S = SEASONS[season];
  for (const k of NUM) env.n[k] = S[k];
  env.fogDay.set(S.fogDay); env.grass.set(S.grass); env.leaf.set(S.leaf); env.tint.set(...S.tint);
  env.snowCover = S.snow; env.blossom = season === 'spring' ? 1 : 0; env.leafFall = env.blossom; env.season = season; env.ready = true;
}

export function blendEnv(season: SeasonKey, dt: number) {
  if (!env.ready) snapEnv(season);
  env.season = season;
  const S = SEASONS[season]; const k = 1 - Math.exp(-dt * 0.6);
  for (const key of NUM) env.n[key] += (S[key] - env.n[key]) * k;
  env.fogDay.lerp(tmp.set(S.fogDay), k); env.grass.lerp(tmp.set(S.grass), k); env.leaf.lerp(tmp.set(S.leaf), k);
  env.tint.x += (S.tint[0] - env.tint.x) * k; env.tint.y += (S.tint[1] - env.tint.y) * k; env.tint.z += (S.tint[2] - env.tint.z) * k;
  env.snowCover += (S.snow - env.snowCover) * (1 - Math.exp(-dt * (S.snow > env.snowCover ? 0.07 : 0.25)));
  const spring = season === 'spring' ? 1 : 0;
  env.blossom += (spring - env.blossom) * k; env.leafFall += (spring - env.leafFall) * k;
}
