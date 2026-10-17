import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getMats, pbr } from '../gfx/materials';
import { CROPS, CROP_TYPES, ITEMS, POND } from '../sim/constants';
import { drawIcon } from '../ui/icons';
import { makeItem } from './items';
import { env } from './envState';
import { sim } from '../sim/instance';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (a: number, b: number, h: number, s = 18) => new THREE.CylinderGeometry(a, b, h, s);
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D, shadow = true) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent?.add(o); return o;
}
function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function Buildings() {
  const built = useMemo(() => {
    const M = getMats(); const root = new THREE.Group();

    /* ---- barn & silo ---- */
    const barn = new THREE.Group(); barn.position.set(-39, 0, -37); barn.rotation.y = 0.5; root.add(barn);
    mesh(box(10, 5.2, 7), M.barn, 0, 2.6, 0, barn);
    mesh(box(10.4, 0.5, 7.4), M.rock, 0, 0.25, 0, barn);
    const r1 = mesh(box(10.8, 0.16, 4.6), M.metal, 0, 6.6, -1.78, barn); r1.rotation.x = -0.64;
    const r2 = mesh(box(10.8, 0.16, 4.6), M.metal, 0, 6.6, 1.78, barn); r2.rotation.x = 0.64;
    mesh(box(10.9, 0.2, 0.3), M.metal, 0, 7.85, 0, barn);
    const gable = new THREE.Shape(); gable.moveTo(-3.5, 0); gable.lineTo(3.5, 0); gable.lineTo(0, 2.6); gable.closePath();
    const gg = new THREE.ExtrudeGeometry(gable, { depth: 9.9, bevelEnabled: false }); gg.rotateY(Math.PI / 2); gg.translate(-4.95, 5.2, 0); mesh(gg, M.barn, 0, 0, 0, barn);
    mesh(box(0.15, 3.8, 3.2), M.woodDark, 5.05, 1.9, 0, barn);
    for (const z of [-1.55, 1.55]) mesh(box(0.12, 3.8, 0.14), M.white, 5.14, 1.9, z, barn);
    mesh(box(0.12, 0.14, 3.2), M.white, 5.14, 3.75, 0, barn);
    for (const a of [0.72, -0.72]) { const xb = mesh(box(0.1, 4.6, 0.12), M.white, 5.15, 1.9, 0, barn); xb.rotation.x = a; }
    // loft window with warm light at night
    const win = mesh(box(0.1, 1.1, 1.4), M.bulb, 5.06, 6.0, 0, barn, false);
    mesh(cyl(1.8, 1.8, 10, 40), M.metal, -7.4, 5, 1, barn);
    mesh(new THREE.SphereGeometry(1.85, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, -7.4, 10, 1, barn);
    for (let i = 0; i < 6; i++) mesh(new THREE.TorusGeometry(1.82, 0.04, 6, 40), M.dark, -7.4, 1.4 * i + 1.5, 1, barn).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const hb = mesh(cyl(0.7, 0.7, 1.1, 28), M.hay, 3 + i * 1.5, 0.7, 5.2, barn); hb.rotation.z = Math.PI / 2; }
    for (let i = 0; i < 3; i++) { const hb = mesh(cyl(0.7, 0.7, 1.1, 28), M.hay, 3.75 + i * 1.5, 1.95, 5.2, barn); hb.rotation.z = Math.PI / 2; }
    // old tractor next to the barn
    const tr = new THREE.Group(); tr.position.set(7.5, 0, -1.5); tr.rotation.y = -0.6; barn.add(tr);
    const red = new THREE.MeshPhysicalMaterial({ color: 0xa8321f, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35 });
    mesh(rbox(1.2, 1.0, 2.6, 0.12), red, 0, 1.1, 0.2, tr); mesh(rbox(1.3, 1.3, 1.2, 0.1), red, 0, 1.9, -0.8, tr);
    mesh(box(1.1, 0.8, 0.05), M.glass, 0, 2.05, -0.18, tr);
    mesh(cyl(0.06, 0.06, 1.1), M.dark, 0.35, 2.2, 1.0, tr);
    for (const [x, z, r] of [[-0.75, -0.8, 0.8], [0.75, -0.8, 0.8], [-0.7, 1.1, 0.45], [0.7, 1.1, 0.45]] as number[][]) { const w = mesh(cyl(r, r, 0.4, 28), M.rubber, x, r, z, tr); w.rotation.z = Math.PI / 2; const h = mesh(cyl(r * 0.5, r * 0.5, 0.42, 20), red, x, r, z, tr); h.rotation.z = Math.PI / 2; }

    /* ---- windmill ---- */
    const wm = new THREE.Group(); wm.position.set(41, 0, -38); wm.rotation.y = -0.6; root.add(wm);
    mesh(cyl(0.6, 1.6, 13, 12), M.white, 0, 6.5, 0, wm);
    mesh(new THREE.ConeGeometry(1.2, 1.7, 12), M.metal, 0, 13.85, 0, wm);
    for (let i = 0; i < 3; i++) mesh(box(0.5, 0.8, 0.06), M.glass, 0, 3 + i * 3.4, 1.1 - i * 0.12, wm);
    mesh(box(0.9, 1.8, 0.1), M.woodDark, 0, 0.9, 1.5, wm);
    const hub = new THREE.Group(); hub.position.set(0, 12.6, 1.25); wm.add(hub);
    mesh(cyl(0.3, 0.3, 0.6, 16), M.dark, 0, 0, 0, hub).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI) / 2; hub.add(arm);
      mesh(box(0.16, 6.4, 0.08), M.woodDark, 0, 3.3, 0.2, arm);
      for (let k = 0; k < 6; k++) mesh(box(1.2, 0.05, 0.05), M.woodDark, 0.6, 1.9 + k * 0.8, 0.22, arm);
      mesh(box(1.1, 4.6, 0.02), M.white, 0.62, 3.9, 0.25, arm);
    }

    /* ---- market stall ---- */
    const stall = new THREE.Group(); stall.position.set(0, 0, -0.4); root.add(stall);
    mesh(rbox(9.4, 1.1, 1.6, 0.06), M.wood, 0, 0.55, 1.6, stall);
    mesh(box(9.8, 0.12, 1.9), M.woodDark, 0, 1.16, 1.6, stall);
    mesh(box(9.4, 2.6, 0.4), M.wood, 0, 1.3, -2.1, stall);
    for (const [x, z] of [[-4.6, 2.3], [4.6, 2.3], [-4.6, -2.3], [4.6, -2.3]]) mesh(cyl(0.11, 0.13, 3.6, 12), M.woodDark, x, 1.8, z, stall);
    const clothT = canvasTex(1024, 128, x => {
      for (let i = 0; i < 14; i++) { x.fillStyle = i % 2 ? '#ece3d0' : '#b23f2c'; x.fillRect((i * 1024) / 14, 0, 1024 / 14 + 1, 128); }
      const im = x.getImageData(0, 0, 1024, 128); for (let i = 0; i < im.data.length; i += 4) { const n = (Math.random() - 0.5) * 16; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; } x.putImageData(im, 0, 0);
    });
    const cloth = pbr(null, { map: clothT, roughness: 0.85, side: THREE.DoubleSide }, { snow: 1 });
    cloth.normalMap = M.tex.fabric.normal; cloth.normalScale = new THREE.Vector2(0.5, 0.5);
    const aw = new THREE.PlaneGeometry(10.6, 5.6, 24, 12); { const ap = aw.attributes.position; for (let i = 0; i < ap.count; i++) { const x = ap.getX(i), y = ap.getY(i); ap.setZ(i, -0.12 * Math.cos((x / 10.6) * Math.PI * 7) * (0.5 + 0.5 * (y / 2.8))); } aw.computeVertexNormals(); }
    aw.rotateX(-Math.PI / 2 + 0.14); mesh(aw, cloth, 0, 3.62, 0, stall);
    const valG = new THREE.PlaneGeometry(10.6, 0.5, 60, 1); { const vp = valG.attributes.position; for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), y = vp.getY(i); if (y < 0) vp.setY(i, y + Math.abs(Math.sin((x * Math.PI) / 0.53)) * 0.25); } }
    mesh(valG, cloth, 0, 3.0, 2.82, stall);
    const signT = canvasTex(1024, 220, x => { x.fillStyle = '#211e1a'; x.fillRect(0, 0, 1024, 220); x.strokeStyle = '#b8954f'; x.lineWidth = 6; x.strokeRect(14, 14, 996, 192); x.fillStyle = '#efe6d4'; x.font = 'italic 124px "Instrument Serif", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Farm Market', 512, 116); });
    mesh(box(4.6, 1.0, 0.1), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.55 }), 0, 4.6, 1.4, stall);
    (['tomato', 'corn', 'rice', 'apple', 'salmon'] as const).forEach((t, i) => {
      const cx = -3.6 + i * 1.8; mesh(rbox(1.5, 0.4, 1, 0.04), M.wood, cx, 1.42, 1.55, stall);
      for (let k = 0; k < 9; k++) { const it = makeItem(t); it.position.set(cx - 0.45 + (k % 3) * 0.45, 1.66 + (k > 5 ? 0.14 : 0), 1.3 + Math.floor((k % 6) / 3) * 0.42 + (k > 5 ? 0.2 : 0)); it.rotation.y = k * 1.3; stall.add(it); }
    });
    // price tags & scale
    mesh(cyl(0.25, 0.25, 0.05, 20), M.chrome, 4.1, 1.26, 1.2, stall); mesh(rbox(0.5, 0.25, 0.4, 0.04), M.white, 4.1, 1.35, 1.2, stall);
    for (const lx of [-4.6, 4.6]) mesh(new THREE.SphereGeometry(0.16, 16, 12), M.bulb, lx, 3.15, 2.5, stall, false);
    // string lights along the awning edge
    { const bulbG = new THREE.SphereGeometry(0.06, 8, 6); const sl = new THREE.InstancedMesh(bulbG, M.bulb, 24); const m = new THREE.Matrix4(); for (let i = 0; i < 24; i++) { const x = -5 + (i * 10) / 23; m.makeTranslation(x, 2.95 - Math.sin((i / 23) * Math.PI) * 0.15, 2.88); sl.setMatrixAt(i, m); } stall.add(sl); }
    // barrels and crates behind the stall
    for (const [x, z] of [[-6.2, -1.5], [-6.9, -0.6], [6.4, -1.2]]) { mesh(cyl(0.45, 0.4, 1.0, 20), M.wood, x, 0.5, z, stall); mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 24), M.dark, x, 0.75, z, stall).rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(0.44, 0.03, 6, 24), M.dark, x, 0.25, z, stall).rotation.x = Math.PI / 2; }
    for (const [x, z, h] of [[6.6, 0.2, 0], [6.6, 0.2, 0.6], [7.3, -0.4, 0]]) mesh(rbox(0.6, 0.6, 0.6, 0.03), M.wood, x, 0.3 + h, z, stall);

    /* ---- plaza furniture ---- */
    for (const [lx, lz] of [[-11.6, 2.4], [11.6, 2.4], [-11.6, 14.8], [11.6, 14.8]]) {
      mesh(cyl(0.07, 0.1, 4.2, 12), M.dark, lx, 2.1, lz); mesh(cyl(0.15, 0.2, 0.25, 12), M.dark, lx, 0.12, lz);
      mesh(new THREE.ConeGeometry(0.32, 0.28, 12, 1, true), M.dark, lx, 4.42, lz); mesh(new THREE.SphereGeometry(0.17, 14, 10), M.bulb, lx, 4.2, lz, undefined, false);
    }
    const benchMat = M.wood;
    for (const [bx, bz, ry] of [[-10.5, 9, Math.PI / 2], [10.5, 9, -Math.PI / 2]]) {
      const b = new THREE.Group(); b.position.set(bx, 0, bz); b.rotation.y = ry; root.add(b);
      for (let k = 0; k < 3; k++) mesh(box(2, 0.05, 0.14), benchMat, 0, 0.48, -0.2 + k * 0.17, b);
      for (let k = 0; k < 2; k++) mesh(box(2, 0.12, 0.04), benchMat, 0, 0.75 + k * 0.17, -0.32, b);
      for (const sx of [-0.85, 0.85]) { mesh(box(0.06, 0.48, 0.5), M.dark, sx, 0.24, -0.05, b); mesh(box(0.06, 0.5, 0.06), M.dark, sx, 0.75, -0.33, b); }
    }
    for (const [px, pz] of [[-3.4, 15.2], [3.4, 15.2]]) {
      mesh(rbox(1.0, 0.5, 1.0, 0.05), M.rock, px, 0.25, pz);
      const bush = mesh(new THREE.SphereGeometry(0.45, 16, 12), M.crop, px, 0.75, pz); bush.scale.y = 0.8;
    }

    /* ---- charging dock ---- */
    const dock = new THREE.Group(); dock.position.set(0, 0, -11.5); root.add(dock);
    mesh(cyl(3, 3.1, 0.18, 64), M.stone, 0, 0.09, 0, dock);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 2.2 });
    const ring = mesh(new THREE.TorusGeometry(2.45, 0.045, 10, 96), ringMat, 0, 0.19, 0, dock, false); ring.rotation.x = Math.PI / 2;
    mesh(rbox(0.5, 2.2, 0.5, 0.08), M.dark, 2.3, 1.1, -1.5, dock);
    mesh(box(0.34, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x7fd1c9, emissive: 0x5fbfb5, emissiveIntensity: 1.6 }), 2.3, 1.7, -1.24, dock, false);
    mesh(cyl(0.03, 0.03, 1.4, 6), M.dark, 2.0, 1.1, -1.0, dock).rotation.z = 0.8;

    /* ---- field signs & borders are in Crops ---- */
    for (const type of CROP_TYPES) {
      const d = CROPS[type]; const dir = Math.sign(d.pz); const sz = d.pz - dir * d.sp - dir * (d.sp / 2 + 1.9);
      const t = canvasTex(512, 192, x => { x.fillStyle = '#ece3d0'; x.fillRect(0, 0, 512, 192); x.strokeStyle = '#6e5a44'; x.lineWidth = 8; x.strokeRect(8, 8, 496, 176); drawIcon(x, type, 96, 96, 56); x.fillStyle = '#2a2620'; x.font = 'italic 80px "Instrument Serif", Georgia, serif'; x.textBaseline = 'middle'; x.fillText(ITEMS[type].name, 180, 80); x.font = '500 40px "Geist", sans-serif'; x.fillStyle = '#6b5a44'; x.fillText('$' + ITEMS[type].price + ' each', 184, 144); });
      const g = new THREE.Group(); g.position.set(d.px + (d.cols * d.sp) / 2 - 0.6, 0, sz); g.rotation.y = dir > 0 ? Math.PI : 0; root.add(g);
      mesh(cyl(0.05, 0.05, 1.6, 8), M.woodDark, -0.8, 0.8, 0, g); mesh(cyl(0.05, 0.05, 1.6, 8), M.woodDark, 0.8, 0.8, 0, g);
      mesh(box(2, 0.75, 0.06), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), 0, 1.35, 0.05, g);
    }
    return { root, hub, win };
  }, []);

  useFrame((_, dt) => {
    built.hub.rotation.z -= Math.min(dt, 0.1) * sim.speed * (0.4 + env.n.wind * 2.4);
  });
  return <primitive object={built.root} />;
}

/* ================= Pond ================= */
export function Pond() {
  const built = useMemo(() => {
    const M = getMats(); const root = new THREE.Group();
    const circ = new THREE.CircleGeometry(1, 96); circ.rotateX(-Math.PI / 2);
    mesh(circ, M.sand, POND.cx, 0.012, POND.cz, root, false).scale.set(POND.rx + 2.2, 1, POND.rz + 2.2);
    // a shallow bowl so the water has depth when seen at an angle
    // pond bed: darker toward the middle so the water reads as deep
    const bedG = new THREE.CircleGeometry(1, 96); bedG.rotateX(-Math.PI / 2);
    { const cols: number[] = []; const bp = bedG.attributes.position; const c0 = new THREE.Color(0x4a5a3c), c1 = new THREE.Color(0x0c1612), c = new THREE.Color(); for (let i = 0; i < bp.count; i++) { const r = Math.hypot(bp.getX(i), bp.getZ(i)); c.copy(c0).lerp(c1, Math.min(1, (1 - r) * 1.6)); cols.push(c.r, c.g, c.b); } bedG.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); }
    const bed = mesh(bedG, pbr(null, { vertexColors: true, roughness: 1 }), POND.cx, 0.03, POND.cz, root, false); bed.scale.set(POND.rx, 1, POND.rz);
    const water = mesh(circ, M.water, POND.cx, 0.16, POND.cz, root, false); water.scale.set(POND.rx, 1, POND.rz);
    // pier
    mesh(rbox(1.8, 0.16, 4.6, 0.04), M.wood, 0, 0.36, -25.2, root);
    for (const z of [-23.4, -25.2, -27]) for (const x of [-0.8, 0.8]) mesh(cyl(0.09, 0.09, 1.2, 10), M.woodDark, x, 0.0, z, root);
    // reeds, cattails, lilies, rocks
    const R = Math.random;
    const reedG = new THREE.ConeGeometry(0.03, 1.4, 4); reedG.translate(0, 0.7, 0);
    const reeds = new THREE.InstancedMesh(reedG, M.crop, 200); const tails = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.045, 0.22, 2, 6), pbr(null, { color: 0x5a3a22, roughness: 0.9 }, { sway: 0.6 }), 40);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color(); let ri = 0, ti = 0;
    for (let i = 0; i < 60; i++) {
      const a = R() * Math.PI * 2; if (Math.sin(a) > 0.8) continue; const k = 0.98 + R() * 0.14; const bx = POND.cx + Math.cos(a) * POND.rx * k, bz = POND.cz + Math.sin(a) * POND.rz * k;
      for (let j = 0; j < 3 && ri < 200; j++) { q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3)); const h = 0.7 + R() * 0.7; sv.set(1, h, 1); v.set(bx + (R() - 0.5) * 0.6, 0, bz + (R() - 0.5) * 0.6); m.compose(v, q, sv); reeds.setMatrixAt(ri, m); reeds.setColorAt(ri++, c.setHSL(0.2 + R() * 0.06, 0.4, 0.34)); if (ti < 40 && R() < 0.3) { m.compose(v.setY(1.3 * h), q, sv.set(1, 1, 1)); tails.setMatrixAt(ti++, m); } }
    }
    reeds.count = ri; tails.count = ti; reeds.castShadow = true; root.add(reeds, tails);
    const lilyG = new THREE.CircleGeometry(0.42, 18, 0.3, Math.PI * 1.8); lilyG.rotateX(-Math.PI / 2);
    const lilies = new THREE.InstancedMesh(lilyG, pbr(null, { color: 0x3f7d3a, roughness: 0.45, side: THREE.DoubleSide }), 18);
    const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 6), pbr(null, { color: 0xf3c6d6, roughness: 0.5 }), 8); let fi = 0;
    for (let i = 0; i < 18; i++) { const a = R() * Math.PI * 2, k = 0.3 + R() * 0.55; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6); sv.setScalar(0.7 + R() * 0.5); v.set(POND.cx + Math.cos(a) * POND.rx * k, 0.19, POND.cz + Math.sin(a) * POND.rz * k); m.compose(v, q, sv); lilies.setMatrixAt(i, m); if (fi < 8 && R() < 0.45) { m.makeTranslation(v.x + 0.12, 0.25, v.z); flowers.setMatrixAt(fi++, m); } }
    flowers.count = fi; lilies.receiveShadow = true; root.add(lilies, flowers);
    const rockG = new THREE.DodecahedronGeometry(0.8, 2); { const rp = rockG.attributes.position; for (let i = 0; i < rp.count; i++) { const k = 1 + 0.18 * Math.sin(rp.getX(i) * 5 + rp.getZ(i) * 4); rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k, rp.getZ(i) * k); } rockG.computeVertexNormals(); }
    for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2; if (Math.sin(a) > 0.7) continue; const r = mesh(rockG, M.rock, POND.cx + Math.cos(a) * (POND.rx + 1.6), 0.1, POND.cz + Math.sin(a) * (POND.rz + 1.6), root); r.scale.set(0.4 + R() * 0.5, 0.3 + R() * 0.3, 0.4 + R() * 0.5); r.rotation.set(R() * 3, R() * 3, 0); }
    const fish: { m: THREE.Object3D; a: number; k: number; sp: number; jump: number }[] = [];
    for (let i = 0; i < 14; i++) { const t = (['catfish', 'catfish', 'trout', 'trout', 'salmon', 'koi'] as const)[Math.floor(R() * 6)]; const f = makeItem(t); f.scale.setScalar(1.25); root.add(f); fish.push({ m: f, a: R() * Math.PI * 2, k: 0.25 + R() * 0.55, sp: (0.12 + R() * 0.23) * (R() < 0.5 ? -1 : 1), jump: -1 }); }
    return { root, fish, lilies, flowers };
  }, []);

  useFrame((_, rdt) => {
    const dt = Math.min(rdt, 0.1) * sim.speed; const frozen = env.n.frozen > 0.5; const t = performance.now() / 1000;
    built.lilies.visible = built.flowers.visible = !frozen;
    for (const f of built.fish) {
      f.m.visible = !frozen;
      if (f.jump >= 0) {
        f.jump += dt / 0.9; const u = Math.min(1, f.jump); const x = POND.cx + Math.cos(f.a) * POND.rx * f.k, z = POND.cz + Math.sin(f.a) * POND.rz * f.k;
        f.m.position.set(x, 0.1 + Math.sin(u * Math.PI) * 1.2, z); f.m.rotation.z = Math.cos(u * Math.PI) * 1.1;
        if (u >= 1) { f.jump = -1; f.m.rotation.z = 0; fxBus.ripple(x, z, 1); } continue;
      }
      f.a += f.sp * dt; const x = POND.cx + Math.cos(f.a) * POND.rx * f.k, z = POND.cz + Math.sin(f.a) * POND.rz * f.k;
      f.m.position.set(x, 0.04 + Math.sin(t * 2 + f.k * 9) * 0.02, z);
      const dx = -Math.sin(f.a) * POND.rx * f.sp, dz = Math.cos(f.a) * POND.rz * f.sp; f.m.rotation.y = Math.atan2(-dz, dx) + Math.PI;
      if (!frozen && Math.random() < dt * 0.03) { f.jump = 0; fxBus.ripple(x, z, 1); }
    }
    if (env.n.rain > 0.3 && !frozen && Math.random() < dt * 14 * env.n.rain) { const a = Math.random() * Math.PI * 2, k = Math.sqrt(Math.random()) * 0.95; fxBus.ripple(POND.cx + Math.cos(a) * POND.rx * k, POND.cz + Math.sin(a) * POND.rz * k, 0.35); }
  });
  return <primitive object={built.root} />;
}

/** Tiny event bus so the pond, bots and effects can trigger ripples without coupling. */
export const fxBus = { ripple: (_x: number, _z: number, _s: number) => {} };
