import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getMats } from '../gfx/materials';
import { CROPS, CROP_TYPES, type CropKey } from '../sim/constants';
import { sim } from '../sim/instance';
import { blobGeo } from './Landscape';
import { srand } from './terrain';

const smooth = (v: number) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
const M4 = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function leafStrip(len: number, w: number) {
  const g = new THREE.PlaneGeometry(w, len, 2, 10); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + len / 2, t = y / len; const x = p.getX(i) * (1 - t * 0.85); p.setXYZ(i, x, y * 0.9 - t * t * len * 0.3, t * t * len * 0.55 - Math.abs(x) * 0.6); }
  g.computeVertexNormals(); return g;
}
interface PartDef { geo: THREE.BufferGeometry; mat: THREE.Material; kind: 'plant' | 'fruit' | 'static'; L: THREE.Matrix4[]; cols?: [number, number]; shadow?: boolean; im?: THREE.InstancedMesh; c0?: THREE.Color; c1?: THREE.Color }

function partDefs(type: CropKey): PartDef[] {
  const M = getMats(); const D: PartDef[] = []; const R = srand(type.length * 97);
  if (type === 'tomato') {
    D.push({ geo: new THREE.CylinderGeometry(0.022, 0.03, 1.7, 6), mat: M.woodDark, kind: 'plant', L: [M4(0.3, 0.85, 0.05)], shadow: true });
    D.push({ geo: blobGeo(0.5, 4, 0.3, 18), mat: M.crop, kind: 'plant', L: [M4(0, 0.55, 0, 0, 0, 0, 1, 1.1, 1), M4(0.15, 0.95, 0.1, 0, 1, 0, 0.75), M4(-0.12, 1.25, -0.05, 0, 2, 0, 0.55), M4(0.1, 0.35, -0.25, 0, 3, 0, 0.6)], cols: [0x5c9a3e, 0x4a8433], shadow: true });
    const L: THREE.Matrix4[] = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + R(); L.push(M4(Math.cos(a) * 0.42, 0.4 + (i % 3) * 0.3, Math.sin(a) * 0.42, 0, 0, 0, 1, 0.88, 1)); }
    D.push({ geo: new THREE.SphereGeometry(0.1, 16, 12), mat: M.fruit, kind: 'fruit', L, cols: [0x6aa13e, 0xc0301c] });
  } else if (type === 'corn') {
    const st = new THREE.CylinderGeometry(0.035, 0.07, 2.6, 8); st.translate(0, 1.3, 0);
    D.push({ geo: st, mat: M.crop, kind: 'plant', L: [M4(0, 0, 0)], cols: [0x6aa548, 0x9ea64e], shadow: true });
    const L: THREE.Matrix4[] = []; for (let i = 0; i < 7; i++) L.push(M4(0, 0.2 + i * 0.3, 0, 0, i * 2.4, 0, 1, 1 + i * 0.04, 1));
    D.push({ geo: leafStrip(1.35, 0.14), mat: M.crop, kind: 'plant', L, cols: [0x5e9c42, 0xa5a54e], shadow: true });
    D.push({ geo: new THREE.CapsuleGeometry(0.07, 0.3, 4, 12), mat: M.fruit, kind: 'fruit', L: [M4(0.12, 1.25, 0, 0, 0, -0.3), M4(-0.1, 1.55, 0.05, 0, 0, 0.3)], cols: [0xa8c46e, 0xe2bb44] });
    const silk = new THREE.ConeGeometry(0.03, 0.25, 5); silk.translate(0, 0.12, 0);
    D.push({ geo: silk, mat: M.grain, kind: 'fruit', L: [M4(0.18, 1.45, 0, 0, 0, -0.5), M4(-0.16, 1.75, 0.05, 0, 0, 0.5)], cols: [0xd8d08a, 0x8a5a2c] });
    D.push({ geo: new THREE.ConeGeometry(0.12, 0.6, 7), mat: M.grain, kind: 'plant', L: [M4(0, 2.78, 0)], cols: [0x8fae54, 0xc9a35a] });
  } else if (type === 'rice') {
    const bg = new THREE.ConeGeometry(0.022, 1.15, 3); bg.translate(0, 0.57, 0); const L: THREE.Matrix4[] = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; L.push(M4(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28, 1, 0.8 + R() * 0.4, 1)); }
    D.push({ geo: bg, mat: M.grain, kind: 'plant', L, cols: [0x5ea547, 0xcdb560], shadow: true });
    const H: THREE.Matrix4[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; H.push(M4(Math.cos(a) * 0.38, 1.06, Math.sin(a) * 0.38, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55, 1, 2.6, 1)); }
    D.push({ geo: new THREE.SphereGeometry(0.05, 8, 6), mat: M.grain, kind: 'fruit', L: H, cols: [0x9fcf6f, 0xdcb955] });
  } else {
    const tr = new THREE.CylinderGeometry(0.16, 0.3, 2.0, 12, 3); tr.translate(0, 1.0, 0);
    D.push({ geo: tr, mat: M.bark, kind: 'static', L: [M4(0, 0, 0)], shadow: true });
    D.push({ geo: blobGeo(1.25, 5, 0.22), mat: M.crop, kind: 'static', L: [M4(0, 2.55, 0), M4(0.6, 2.2, 0.35, 0, 1, 0, 0.72), M4(-0.5, 2.35, -0.4, 0, 2, 0, 0.74), M4(0.1, 3.1, 0.1, 0, 3, 0, 0.6)], cols: [0x4f8f3a, 0x4f8f3a], shadow: true });
    const L: THREE.Matrix4[] = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + R() * 0.4; L.push(M4(Math.cos(a) * 1.15, 1.85 + (i % 4) * 0.36, Math.sin(a) * 1.15)); }
    D.push({ geo: new THREE.SphereGeometry(0.13, 16, 12), mat: M.fruit, kind: 'fruit', L, cols: [0x8fbf4a, 0xb3242b] });
  }
  return D;
}

export function Crops() {
  const built = useMemo(() => {
    const root = new THREE.Group(); const parts = {} as Record<CropKey, PartDef[]>; const mounds = {} as Record<CropKey, THREE.InstancedMesh | null>;
    const M = getMats();
    for (const t of CROP_TYPES) {
      const d = CROPS[t]; const cap = d.cols * d.maxRows;
      parts[t] = partDefs(t).map(def => {
        const im = new THREE.InstancedMesh(def.geo, def.mat, cap * def.L.length); im.count = 0; im.castShadow = !!def.shadow; im.receiveShadow = true; im.frustumCulled = false;
        if (def.cols) { def.c0 = new THREE.Color(def.cols[0]); def.c1 = new THREE.Color(def.cols[1]); im.setColorAt(0, def.c0); }
        root.add(im); def.im = im; return def;
      });
      if (t !== 'apple') { const mg = new THREE.SphereGeometry(0.45, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2); const im = new THREE.InstancedMesh(mg, M.soil, cap); im.count = 0; im.receiveShadow = true; root.add(im); mounds[t] = im; } else mounds[t] = null;
    }
    const beds = new THREE.Group(); root.add(beds);
    return { root, parts, mounds, beds, rowsKey: '' };
  }, []);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), b: new THREE.Matrix4(), f: new THREE.Matrix4(), c: new THREE.Color(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const acc = useRef(0);

  useFrame((_, dt) => {
    const M = getMats();
    // Rebuild soil beds when the manager expands the fields
    const key = CROP_TYPES.map(t => sim.rows[t]).join(',');
    if (key !== built.rowsKey) {
      built.rowsKey = key;
      built.beds.children.slice().forEach(o => { built.beds.remove(o); (o as THREE.Mesh).geometry.dispose(); });
      for (const t of CROP_TYPES) {
        const d = CROPS[t]; const dir = Math.sign(d.pz); const rows = sim.rows[t];
        const w = d.cols * d.sp + 1.2, dd = rows * d.sp + 1.2, cz = d.pz - dir * d.sp + (dir * (rows - 1) * d.sp) / 2;
        const g = new THREE.BoxGeometry(w, 0.3, dd, 1, 1, 1); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 5, (uv.getY(i) * dd) / 5);
        const soil = new THREE.Mesh(g, t === 'apple' ? M.orchard : M.soil); soil.position.set(d.px, 0.1, cz); soil.receiveShadow = true; built.beds.add(soil);
        if (t === 'rice') { const wg = new THREE.PlaneGeometry(w - 0.5, dd - 0.5); wg.rotateX(-Math.PI / 2); const wm = new THREE.Mesh(wg, M.water); wm.position.set(d.px, 0.27, cz); built.beds.add(wm); }
        for (const [bw, bd, bx, bz] of [[w + 0.3, 0.14, d.px, cz - dd / 2], [w + 0.3, 0.14, d.px, cz + dd / 2], [0.14, dd, d.px - w / 2, cz], [0.14, dd, d.px + w / 2, cz]]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.36, bd), M.woodDark); b.position.set(bx, 0.15, bz); b.castShadow = b.receiveShadow = true; built.beds.add(b);
        }
        const mi = built.mounds[t]; if (mi) { const list = sim.slotsOf(t); list.forEach((s, i) => mi.setMatrixAt(i, M4(s.x, 0.22, s.z, 0, s.rot, 0, 1, 0.35, 1))); mi.count = list.length; mi.instanceMatrix.needsUpdate = true; }
      }
    }
    acc.current += dt; if (acc.current < 0.06) return; acc.current = 0;
    const time = performance.now() / 1000;
    for (const type of CROP_TYPES) {
      const defs = built.parts[type]; const list = sim.slotsOf(type);
      for (const def of defs) def.im!.count = list.length * def.L.length;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const pr = s.state === 'empty' ? 0 : s.state === 'ripe' ? 1 : s.t;
        const g = s.state === 'empty' ? 0.0001 : 0.1 + 0.9 * smooth(pr * 1.25);
        const f = Math.max(0.0001, smooth((pr - 0.5) / 0.5) * (s.state === 'ripe' ? 1 + 0.04 * Math.sin(time * 3 + s.x) : 1));
        const rk = smooth((pr - 0.55) / 0.45);
        tmp.q.setFromAxisAngle(tmp.up, s.rot); tmp.v.set(s.x, 0.25, s.z);
        for (const def of defs) {
          tmp.s.setScalar(def.kind === 'static' || type === 'apple' ? 1 : g); tmp.b.compose(tmp.v, tmp.q, tmp.s);
          for (let j = 0; j < def.L.length; j++) {
            tmp.m.multiplyMatrices(tmp.b, def.L[j]); if (def.kind === 'fruit') { tmp.f.makeScale(f, f, f); tmp.m.multiply(tmp.f); }
            def.im!.setMatrixAt(i * def.L.length + j, tmp.m);
            if (def.c0) { tmp.c.copy(def.c0).lerp(def.c1!, rk); def.im!.setColorAt(i * def.L.length + j, tmp.c); }
          }
        }
      }
      for (const def of defs) { def.im!.instanceMatrix.needsUpdate = true; if (def.im!.instanceColor) def.im!.instanceColor.needsUpdate = true; }
    }
  });
  return <primitive object={built.root} />;
}
