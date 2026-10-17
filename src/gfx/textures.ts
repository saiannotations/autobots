import * as THREE from 'three';
import type { TexOut } from './texgen';
import { generateAll } from './texgen';

export interface TexSet { map: THREE.DataTexture; normal: THREE.DataTexture; rough: THREE.DataTexture }
export type Textures = Record<string, TexSet>;

function dataTex(data: Uint8Array, size: number, srgb: boolean, aniso: number) {
  const t = new THREE.DataTexture(data as unknown as BufferSource, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function toSets(list: TexOut[], aniso: number): Textures {
  const out: Textures = {};
  for (const t of list) {
    const rough = new Uint8Array(t.size * t.size * 4);
    for (let i = 0; i < t.size * t.size; i++) { const r = t.normal[i * 4 + 3]; rough[i * 4] = r; rough[i * 4 + 1] = r; rough[i * 4 + 2] = r; rough[i * 4 + 3] = 255; }
    out[t.name] = { map: dataTex(t.albedo, t.size, t.srgb, aniso), normal: dataTex(t.normal, t.size, false, aniso), rough: dataTex(rough, t.size, false, aniso) };
  }
  return out;
}

/** Builds every texture in a worker so the page stays responsive while it loads. */
export function loadTextures(hi: boolean, aniso = 8): Promise<Textures> {
  return new Promise(resolve => {
    try {
      const w = new Worker(new URL('./texWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<TexOut[]>) => { resolve(toSets(e.data, aniso)); w.terminate(); };
      w.onerror = () => { w.terminate(); resolve(toSets(generateAll(hi), aniso)); };
      w.postMessage({ hi });
    } catch {
      resolve(toSets(generateAll(hi), aniso));
    }
  });
}

/** Return a copy of a texture set with its own repeat. */
export function repeated(set: TexSet, rx: number, ry = rx): TexSet {
  const c = (t: THREE.DataTexture) => { const n = t.clone(); n.repeat.set(rx, ry); n.needsUpdate = true; return n; };
  return { map: c(set.map), normal: c(set.normal), rough: c(set.rough) };
}
