import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getMats, pbr, enhance } from '../gfx/materials';
import { groundH, excluded, N1, N2, N3, srand, smooth } from './terrain';
import { env } from './envState';
import { quality } from '../ui/store';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D, shadow = true) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent?.add(o); return o;
}
function planeY(w: number, d: number, m: THREE.Material, x: number, y: number, z: number, ru = 1, rv = ru) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  return mesh(g, m, x, y, z, undefined, false);
}
export function blobGeo(r: number, seed: number, amp: number, seg = 22) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amp * (Math.sin((x * 3.1) / r + seed) * Math.sin((y * 2.7) / r + seed * 2.1) * Math.sin((z * 3.3) / r + seed * 3.7)) + amp * 0.5 * Math.sin((x * 7) / r + (z * 6) / r + seed) + amp * 0.25 * Math.sin((y * 13) / r + seed * 5);
    p.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  g.computeVertexNormals(); return g;
}

export function Landscape() {
  const { group, crowns } = useMemo(() => {
    const M = getMats(); const root = new THREE.Group();
    /* ground */
    const g = new THREE.PlaneGeometry(520, 520, 160, 160); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
    g.computeVertexNormals(); const ground = new THREE.Mesh(g, M.ground); ground.receiveShadow = true; root.add(ground);
    /* distant hills */
    const hg = new THREE.RingGeometry(230, 900, 200, 12); hg.rotateX(-Math.PI / 2); const hp = hg.attributes.position; const cols: number[] = [];
    const cA = new THREE.Color(0x3a6236), cB = new THREE.Color(0x66795a), cR = new THREE.Color(0x857f73), cc = new THREE.Color();
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), z = hp.getZ(i); const r = Math.hypot(x, z); const a = Math.atan2(z, x);
      const ridge = N2.fbm(a * 3 + 10, r * 0.004, 64, 6); const y = Math.max(0, (ridge * ridge * 230 + 20) * smooth((r - 230) / 260)) + N3.n(x * 0.03, z * 0.03, 999) * 6;
      hp.setY(i, y); cc.copy(cA).lerp(cB, Math.min(1, y / 120)).lerp(cR, smooth((y - 110) / 70)); cols.push(cc.r, cc.g, cc.b);
    }
    hg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); hg.computeVertexNormals();
    root.add(new THREE.Mesh(hg, pbr(null, { vertexColors: true, roughness: 0.95 })));
    /* plaza, road, lanes */
    root.add(planeY(24, 13, M.stone, 0, 0.02, 8.6));
    root.add(planeY(4.6, 60, M.path, 0, 0.015, 44, 1.2, 16));
    root.add(planeY(3.2, 9, M.path, 0, 0.016, -7, 1, 3));
    root.add(planeY(2.6, 8, M.path, 0, 0.016, -19.5, 0.8, 2.6));
    // curb stones around the plaza
    { const curb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 0.26), M.rock, 120); const m = new THREE.Matrix4(); let n = 0; const q = new THREE.Quaternion(); const sv = new THREE.Vector3(1, 1, 1);
      for (let x = -11.75; x <= 11.8; x += 0.52) { for (const z of [2.0, 15.2]) { if (z > 15 && Math.abs(x) < 2.6) continue; m.compose(new THREE.Vector3(x, 0.06, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.06), sv); curb.setMatrixAt(n++, m); } }
      curb.count = n; curb.receiveShadow = true; curb.castShadow = true; root.add(curb); }
    /* fences */
    { const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), M.woodDark, 40); const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.09, 3.2), M.woodDark, 80);
      const m = new THREE.Matrix4(); let pi = 0, ri = 0;
      for (const sx of [-3.4, 3.4]) for (let k = 0; k < 20; k++) { const z = 17 + k * 3.2; m.makeTranslation(sx, 0.55, z); posts.setMatrixAt(pi++, m); if (k < 19) { m.makeTranslation(sx, 0.78, z + 1.6); rails.setMatrixAt(ri++, m); m.makeTranslation(sx, 0.4, z + 1.6); rails.setMatrixAt(ri++, m); } }
      posts.count = pi; rails.count = ri; for (const o of [posts, rails]) { o.castShadow = o.receiveShadow = true; root.add(o); } }
    /* grass */
    {
      const bg = new THREE.PlaneGeometry(0.08, 0.72, 1, 5); bg.translate(0, 0.36, 0); const bp = bg.attributes.position; const bc: number[] = []; const c = new THREE.Color();
      for (let i = 0; i < bp.count; i++) { const y = bp.getY(i), t = y / 0.72; bp.setX(i, bp.getX(i) * (1 - t * 0.92)); bp.setZ(i, t * t * 0.14); c.setRGB(lerp(0.13, 0.44, t), lerp(0.2, 0.54, t), lerp(0.07, 0.24, t)); bc.push(c.r, c.g, c.b); }
      bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
      const N = Math.round(26000 * quality.grassDensity);
      const mat = enhance(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82, color: 0xd2ecb0 }), { sway: 1, grass: true });
      (M as any).grassBlades = mat;
      const im = new THREE.InstancedMesh(bg, mat, N); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
      let n = 0, guard = 0; const R = srand(42);
      while (n < N && guard++ < N * 8) {
        const x = (R() * 2 - 1) * 62, z = (R() * 2 - 1) * 62; if (excluded(x, z)) continue;
        const dens = N1.fbm(x * 0.05 + 3, z * 0.05 + 3, 64, 3); if (R() > 0.35 + dens) continue;
        e.set((R() - 0.5) * 0.3, R() * Math.PI * 2, (R() - 0.5) * 0.3); q.setFromEuler(e); const sc = 0.6 + R() * 0.95; s.set(sc, sc * (0.7 + R() * 0.75), sc);
        v.set(x, groundH(x, z), z); m.compose(v, q, s); im.setMatrixAt(n, m); c.setHSL(0.2 + R() * 0.08, 0.28 + R() * 0.2, 0.38 + R() * 0.18); im.setColorAt(n, c); n++;
      }
      im.count = n; im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false; root.add(im);
      // wildflowers
      const fg = new THREE.SphereGeometry(0.06, 6, 4); const fl = new THREE.InstancedMesh(fg, pbr(null, { roughness: 0.6 }, { sway: 0.5 }), 900); let fn = 0;
      const fc = [0xf2d24a, 0xf3f0e8, 0xc678c9, 0xe56b4e, 0x8fb6f0];
      while (fn < 900) { const x = (R() * 2 - 1) * 60, z = (R() * 2 - 1) * 60; if (excluded(x, z) || N2.fbm(x * 0.08, z * 0.08, 64, 2) < 0.55) continue; m.makeTranslation(x, 0.35 + R() * 0.25, z); fl.setMatrixAt(fn, m); fl.setColorAt(fn++, c.set(fc[Math.floor(R() * fc.length)])); }
      root.add(fl); (M as any).flowers = fl;
    }
    /* trees */
    const crownMeshes: THREE.InstancedMesh[] = []; const crownBase: THREE.Matrix4[][] = []; const blossom: boolean[] = [];
    {
      const R = srand(77); const list: [number, number, number, boolean][] = [];
      for (let i = 0; i < 160; i++) { const a = R() * Math.PI * 2, r = 58 + R() * 75; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 8 && z > 40) continue; list.push([x, z, 0.8 + R() * 0.9, R() < 0.42]); }
      ([[-52, -8, 1.2, false], [-56, 6, 1.0, true], [50, -6, 1.1, false], [54, 10, 1.3, true], [-30, -52, 1.2, false], [30, -54, 1.0, true], [-12, -50, 0.9, true], [14, -48, 1.1, false]] as [number, number, number, boolean][]).forEach(s => list.push(s));
      const tG = new THREE.CylinderGeometry(0.2, 0.4, 3.4, 12, 4); tG.translate(0, 1.7, 0);
      { const tp = tG.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) * (1 + 0.15 * Math.sin(y * 3))); tp.setZ(i, tp.getZ(i) + Math.sin(y * 1.3) * 0.06); } tG.computeVertexNormals(); }
      const cG = [blobGeo(1.6, 1, 0.2), blobGeo(1.4, 2, 0.24), blobGeo(1.2, 3, 0.22), blobGeo(1.0, 4, 0.2)];
      const pG = new THREE.ConeGeometry(1.7, 2.6, 16, 4); { const pp = pG.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); const k = 1 + 0.08 * Math.sin(Math.atan2(pp.getZ(i), pp.getX(i)) * 7 + y * 4); pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); } pG.computeVertexNormals(); }
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      const tIM = new THREE.InstancedMesh(tG, M.bark, list.length); const cIM = cG.map(g => new THREE.InstancedMesh(g, M.treeLeaf, list.length)); const pIM = new THREE.InstancedMesh(pG, M.pine, list.length * 4);
      let ti = 0, ci = 0, pi = 0;
      for (const [x, z, s, isPine] of list) {
        const gy = groundH(x, z); q.setFromAxisAngle(Y, R() * 6);
        if (isPine) {
          sv.set(s * 0.7, s * 1.5, s * 0.7); v.set(x, gy, z); m.compose(v, q, sv); tIM.setMatrixAt(ti++, m);
          for (let k = 0; k < 4; k++) { const ks = s * (1.2 - k * 0.24); sv.setScalar(ks); v.set(x, gy + s * (2.4 + k * 1.3), z); q.setFromAxisAngle(Y, R() * 6); m.compose(v, q, sv); pIM.setMatrixAt(pi++, m); }
        } else {
          sv.setScalar(s); v.set(x, gy, z); m.compose(v, q, sv); tIM.setMatrixAt(ti++, m);
          [[0, 4.2, 0, 1.25], [0.95 * s, 3.6, 0.45 * s, 0.95], [-0.75 * s, 3.8, -0.6 * s, 1.0], [0.2 * s, 5.0, -0.3 * s, 0.8]].forEach((o, k) => { sv.setScalar(s * o[3]); v.set(x + o[0], gy + o[1] * s, z + o[2]); m.compose(v, q, sv); cIM[k].setMatrixAt(ci, m); cIM[k].setColorAt(ci, c.setHSL(0.26, 0.5, 0.4)); });
          blossom.push(R() < 0.35); ci++;
        }
      }
      tIM.count = ti; pIM.count = pi; cIM.forEach(im => (im.count = ci));
      for (const im of [tIM, pIM, ...cIM]) { im.castShadow = true; im.receiveShadow = true; root.add(im); }
      cIM.forEach(im => { crownMeshes.push(im); const arr: THREE.Matrix4[] = []; for (let i = 0; i < ci; i++) { const mm = new THREE.Matrix4(); im.getMatrixAt(i, mm); arr.push(mm); } crownBase.push(arr); });
    }
    return { group: root, crowns: { meshes: crownMeshes, base: crownBase, blossom, scale: -1, bloom: -1 } };
  }, []);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), c: new THREE.Color(), pink: new THREE.Color(0xee9fb8) }), []);
  useFrame(() => {
    const M = getMats(); (M as any).grassBlades.color.copy(env.grass);
    (M as any).flowers.visible = env.snowCover < 0.5;
    // Deciduous crowns thin out under snow and blossom pink in spring
    const sc = lerp(1, 0.58, env.snowCover);
    if (Math.abs(sc - crowns.scale) > 0.004) {
      crowns.scale = sc;
      crowns.meshes.forEach((im, k) => { crowns.base[k].forEach((b, i) => { b.decompose(tmp.p, tmp.q, tmp.s); tmp.s.multiplyScalar(sc); tmp.m.compose(tmp.p, tmp.q, tmp.s); im.setMatrixAt(i, tmp.m); }); im.instanceMatrix.needsUpdate = true; });
    }
    if (Math.abs(env.blossom - crowns.bloom) > 0.01) {
      crowns.bloom = env.blossom;
      crowns.meshes.forEach((im, j) => { const R = srand(9 + j); for (let i = 0; i < im.count; i++) { tmp.c.setHSL(0.22 + R() * 0.08, 0.4 + R() * 0.22, 0.32 + R() * 0.16); if (crowns.blossom[i]) tmp.c.lerp(tmp.pink, env.blossom * 0.92); im.setColorAt(i, tmp.c); } if (im.instanceColor) im.instanceColor.needsUpdate = true; });
    }
  });
  return <primitive object={group} />;
}
