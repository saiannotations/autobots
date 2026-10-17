import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getMats, pbr } from '../gfx/materials';
import { COOP, RUN, DUCK_HOUSE, NESTS, POND } from '../sim/constants';
import { sim } from '../sim/instance';
import { env } from './envState';
import { fxBus } from './Buildings';

/* ---------- small helpers ---------- */
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (a: number, b: number, h: number, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const sph = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D, shadow = true) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent?.add(o); return o;
}
const R = Math.random;
const rr = (a: number, b: number) => a + R() * (b - a);
const feather = (color: number, rough = 0.82) => pbr(null, { color, roughness: rough }, { snow: 0, wet: 0.4 });

/** Hexagonal galvanised chicken wire, drawn once into an alpha texture. */
function wireTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  x.strokeStyle = '#aeb2ae'; x.lineWidth = 1.8;
  const s = 16, h = s * Math.sqrt(3) / 2;
  for (let row = -1; row < 128 / h + 2; row++) for (let col = -1; col < 128 / (s * 1.5) + 2; col++) {
    const cx = col * s * 1.5, cy = row * h * 2 + (col % 2 ? h : 0);
    x.beginPath(); for (let i = 0; i <= 6; i++) { const a = Math.PI / 3 * i; x.lineTo(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55); } x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }

/* ---------- birds ---------- */
interface Bird {
  root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Object3D[]; kind: 'hen' | 'rooster' | 'duck' | 'duckling';
  x: number; z: number; yaw: number; tx: number; tz: number; state: string; t: number; walk: number; speed: number; seed: number;
  mother?: Bird; idx?: number; swim: number; crow: number;
}

function makeChicken(kind: 'hen' | 'rooster', plumage: number, accent: number): Bird {
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(); root.add(body);
  const big = kind === 'rooster' ? 1.18 : 1;
  const F = feather(plumage), A = feather(accent), comb = pbr(null, { color: 0xc4231c, roughness: 0.5 }, { snow: 0 }), yellow = pbr(null, { color: 0xe0a93a, roughness: 0.55 }, { snow: 0 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x120a04, roughness: 0.15 });
  const torso = mesh(sph(0.2, 18, 14), F, 0, 0.36, 0, body); torso.scale.set(0.95, 0.92, 1.35);
  const breast = mesh(sph(0.15, 14, 10), F, 0, 0.32, 0.14, body); breast.scale.set(1, 1.05, 0.9);
  for (const s of [-1, 1]) { const w = mesh(sph(0.15, 12, 8), A, s * 0.15, 0.38, -0.02, body); w.scale.set(0.35, 0.7, 1.2); w.rotation.x = 0.25; }
  // tail: hens a neat fan, roosters long arched sickle feathers
  if (kind === 'rooster') {
    const tailM = pbr(null, { color: 0x0d1712, roughness: 0.3, metalness: 0.35 }, { snow: 0 });
    for (let i = 0; i < 5; i++) { const t = mesh(new THREE.TorusGeometry(0.2 + i * 0.03, 0.022, 6, 14, Math.PI * 0.9), tailM, (i - 2) * 0.03, 0.5, -0.26, body); t.rotation.set(0, Math.PI / 2, 0.4 + i * 0.06); }
  } else { const t = mesh(new THREE.ConeGeometry(0.11, 0.26, 10), A, 0, 0.53, -0.25, body); t.rotation.x = -0.75; t.scale.z = 0.45; }
  // neck + head pivot (pecking bends here)
  head.position.set(0, 0.48, 0.2); body.add(head);
  const neck = mesh(sph(0.09, 12, 10), kind === 'rooster' ? A : F, 0, 0.04, 0.0, head); neck.scale.set(1, 1.5, 1);
  mesh(sph(0.075, 14, 12), F, 0, 0.15, 0.04, head);
  const bk = mesh(new THREE.ConeGeometry(0.025, 0.08, 8), yellow, 0, 0.14, 0.13, head); bk.rotation.x = Math.PI / 2;
  for (let i = 0; i < (kind === 'rooster' ? 5 : 3); i++) mesh(sph(kind === 'rooster' ? 0.032 : 0.022, 8, 6), comb, 0, 0.215 + Math.sin(i / 4 * Math.PI) * 0.03, 0.09 - i * 0.03, head);
  mesh(sph(kind === 'rooster' ? 0.03 : 0.02, 8, 6), comb, 0, 0.09, 0.1, head).scale.set(0.7, 1.5, 0.7);
  for (const s of [-1, 1]) mesh(sph(0.012, 6, 6), eye, s * 0.058, 0.17, 0.08, head, false);
  const legs: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.07, 0.22, 0); body.add(leg);
    mesh(cyl(0.016, 0.014, 0.2, 6), yellow, 0, -0.1, 0, leg);
    for (const a of [-0.5, 0, 0.5]) { const toe = mesh(cyl(0.008, 0.006, 0.07, 4), yellow, Math.sin(a) * 0.03, -0.2, Math.cos(a) * 0.03, leg, false); toe.rotation.set(Math.PI / 2 - 0.1, 0, -a); }
    legs.push(leg);
  }
  body.scale.setScalar(big);
  return { root, body, head, legs, kind, x: 0, z: 0, yaw: R() * 6, tx: 0, tz: 0, state: 'wander', t: R() * 3, walk: 0, speed: rr(0.55, 0.85), seed: R() * 100, swim: 0, crow: rr(20, 60) };
}

type DuckLook = 'mallard' | 'hen' | 'pekin' | 'duckling';
function makeDuck(look: DuckLook): Bird {
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(); root.add(body);
  const base = { mallard: 0x9c9a90, hen: 0x8a6844, pekin: 0xf1ede2, duckling: 0xe9cf55 }[look];
  const F = feather(base, look === 'duckling' ? 0.95 : 0.78);
  const billM = pbr(null, { color: look === 'mallard' ? 0xc9b33a : look === 'duckling' ? 0xd88a2a : 0xe28a24, roughness: 0.45 }, { snow: 0 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x080604, roughness: 0.1 });
  const torso = mesh(sph(0.22, 18, 14), F, 0, 0.2, 0, body); torso.scale.set(0.85, 0.62, 1.3);
  const tail = mesh(new THREE.ConeGeometry(0.08, 0.18, 10), look === 'mallard' ? feather(0x1b1b1b, 0.5) : F, 0, 0.26, -0.3, body); tail.rotation.x = -1.9;
  if (look === 'mallard') {
    const chest = mesh(sph(0.15, 14, 10), feather(0x5e3221, 0.6), 0, 0.2, 0.17, body); chest.scale.set(1, 0.85, 0.8);
    for (const s of [-1, 1]) { const sp = mesh(box(0.02, 0.05, 0.1), pbr(null, { color: 0x2b3ea8, roughness: 0.3, metalness: 0.4 }, { snow: 0 }), s * 0.18, 0.24, -0.1, body); sp.rotation.y = s * 0.15; }
  }
  for (const s of [-1, 1]) { const w = mesh(sph(0.16, 12, 8), feather(look === 'mallard' ? 0x7e7a70 : base, 0.8), s * 0.13, 0.24, -0.04, body); w.scale.set(0.3, 0.5, 1.25); }
  head.position.set(0, 0.28, 0.2); body.add(head);
  const headM = look === 'mallard' ? pbr(null, { color: 0x0f4a2a, roughness: 0.28, metalness: 0.45 }, { snow: 0 }) : F;
  const neck = mesh(sph(0.075, 12, 10), headM, 0, 0.08, 0.01, head); neck.scale.set(1, 1.6, 1);
  mesh(sph(0.085, 14, 12), headM, 0, 0.19, 0.03, head).scale.set(0.9, 1, 1.15);
  if (look === 'mallard') { const ring = mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 18), feather(0xf4f2ea, 0.6), 0, 0.03, 0.02, head); ring.rotation.x = Math.PI / 2; }
  const bill = mesh(new RoundedBoxGeometry(0.07, 0.025, 0.12, 2, 0.01), billM, 0, 0.17, 0.15, head); bill.rotation.x = 0.15;
  for (const s of [-1, 1]) mesh(sph(0.013, 6, 6), eye, s * 0.062, 0.21, 0.07, head, false);
  const legs: THREE.Object3D[] = []; const legM = pbr(null, { color: 0xe07a22, roughness: 0.6 }, { snow: 0 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.07, 0.1, 0); body.add(leg);
    mesh(cyl(0.015, 0.013, 0.1, 6), legM, 0, -0.05, 0, leg);
    const foot = mesh(new THREE.CircleGeometry(0.045, 3), legM, 0, -0.098, 0.03, leg, false); foot.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    legs.push(leg);
  }
  if (look === 'duckling') body.scale.setScalar(0.45);
  return { root, body, head, legs, kind: look === 'duckling' ? 'duckling' : 'duck', x: 0, z: 0, yaw: R() * 6, tx: 0, tz: 0, state: 'swim', t: R() * 4, walk: 0, speed: look === 'duckling' ? 0.9 : rr(0.45, 0.65), seed: R() * 100, swim: 1, crow: 0 };
}

/* ---------- places ---------- */
const inPond = (x: number, z: number, k = 1) => { const dx = (x - POND.cx) / POND.rx, dz = (z - POND.cz) / POND.rz; return dx * dx + dz * dz < k * k; };
const runPoint = () => ({ x: rr(RUN.x0 + 0.8, RUN.x1 - 0.8), z: rr(RUN.z0 + 0.8, RUN.z1 - 0.8) });
const underCoop = () => ({ x: COOP.x + rr(-COOP.w / 2 + 0.4, COOP.w / 2 - 0.4), z: COOP.z + rr(-COOP.d / 2 + 0.4, COOP.d / 2 - 0.4) });
const RAMP = { x: COOP.x - 0.6, z: COOP.z + COOP.d / 2 + 1.9 };
// ducks keep to the east half of the pond, clear of the pier and close to their house
const pondPoint = () => { for (;;) { const a = R() * Math.PI * 2, k = Math.sqrt(R()) * 0.78; const x = POND.cx + Math.cos(a) * POND.rx * k, z = POND.cz + Math.sin(a) * POND.rz * k; if (x > 2 && !(Math.abs(x) < 1.6 && z > -27)) return { x, z }; } };
const shorePoint = () => ({ x: DUCK_HOUSE.x + rr(-3.6, -1.6), z: DUCK_HOUSE.z + rr(-2.2, 2.6) });

export function Poultry() {
  const built = useMemo(() => {
    const M = getMats(); const root = new THREE.Group();
    const white = M.white, post = M.woodDark;

    /* --- the coop: raised hen house, tin roof, ramp, nest boxes on the east wall --- */
    const coop = new THREE.Group(); coop.position.set(COOP.x, 0, COOP.z); root.add(coop);
    const W = COOP.w, D = COOP.d, floorY = 0.75, wallH = 1.7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.16, floorY + wallH, 0.16), post, sx * (W / 2 - 0.08), (floorY + wallH) / 2, sz * (D / 2 - 0.08), coop);
    mesh(box(W, 0.1, D), M.wood, 0, floorY, 0, coop);
    const walls = mesh(box(W - 0.06, wallH, D - 0.06), M.barn, 0, floorY + wallH / 2 + 0.05, 0, coop);
    walls.scale.set(1, 1, 1);
    // white trim at the corners and eaves
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.1, wallH, 0.1), white, sx * W / 2, floorY + wallH / 2 + 0.05, sz * D / 2, coop);
    // gable ends + tin roof
    const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(0, 1.05); gable.closePath();
    const gG = new THREE.ExtrudeGeometry(gable, { depth: 0.06, bevelEnabled: false });
    for (const sz of [-1, 1]) mesh(gG, M.barn, 0, floorY + wallH + 0.05, sz * (D / 2) - (sz > 0 ? 0.06 : 0), coop);
    const slope = Math.atan2(1.05, W / 2), len = Math.hypot(W / 2, 1.05) + 0.35;
    for (const s of [-1, 1]) { const r = mesh(box(len, 0.05, D + 0.5), M.metal, s * (W / 4 + 0.08), floorY + wallH + 0.58, 0, coop); r.rotation.z = -s * slope; }
    mesh(box(0.14, 0.12, D + 0.55), white, 0, floorY + wallH + 1.12, 0, coop);
    // pop door + window (window glows warm after dusk — the hens are tucked in)
    mesh(box(0.42, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }), -0.6, floorY + 0.3, D / 2 + 0.01, coop, false);
    const glow = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffb36a, emissiveIntensity: 0, roughness: 0.4 });
    mesh(box(0.55, 0.42, 0.04), glow, 0.75, floorY + 1.1, D / 2 + 0.01, coop, false);
    for (const [w, h, x, y] of [[0.65, 0.05, 0.75, 0.21], [0.65, 0.05, 0.75, -0.21], [0.05, 0.47, 0.5, 0], [0.05, 0.47, 1.0, 0], [0.04, 0.42, 0.75, 0]] as const) mesh(box(w, h, 0.05), white, x, floorY + 1.1 + y, D / 2 + 0.03, coop, false);
    // ramp with cleats down into the run
    const ramp = new THREE.Group(); ramp.position.set(-0.6, floorY / 2, D / 2 + 0.95); ramp.rotation.x = Math.atan2(floorY, 1.9); coop.add(ramp);
    mesh(box(0.42, 0.04, 2.05), M.wood, 0, 0, 0, ramp);
    for (let i = 0; i < 6; i++) mesh(box(0.42, 0.03, 0.03), post, 0, 0.03, -0.85 + i * 0.34, ramp, false);
    // nest boxes: an open-fronted row of cubbies on the east wall, roofed with a sloped lid
    const nb = new THREE.Group(); nb.position.set(W / 2, 0, 0); coop.add(nb);
    const nbY = 1.0, nbD = 0.6, span = 6 * 0.64;
    mesh(box(nbD, 0.05, span + 0.1), M.wood, nbD / 2, nbY, -0.0, nb);
    mesh(box(nbD, 0.05, span + 0.1), M.wood, nbD / 2, nbY + 0.55, 0, nb).rotation.z = -0.28;
    mesh(box(nbD, 0.12, span + 0.1), M.wood, nbD / 2 + 0.0, nbY + 0.06, 0, nb, false).position.x = nbD - 0.02;
    for (let i = 0; i <= 6; i++) mesh(box(nbD, 0.5, 0.04), M.wood, nbD / 2, nbY + 0.27, -span / 2 + i * 0.64, nb);
    for (const s of [-1, 1]) mesh(box(0.08, nbY, 0.08), post, nbD - 0.06, nbY / 2, s * (span / 2), nb);
    const straw = M.hay;
    for (let i = 0; i < 6; i++) { const s = mesh(sph(0.2, 10, 6), straw, nbD / 2, nbY + 0.04, -span / 2 + 0.32 + i * 0.64, nb, false); s.scale.set(1, 0.25, 1); }
    // feeder + waterer inside the run
    const feeder = new THREE.Group(); feeder.position.set(COOP.x - 4.2, 0, COOP.z + 3.6); root.add(feeder);
    mesh(cyl(0.22, 0.22, 0.55, 18), M.metal, 0, 0.42, 0, feeder); mesh(cyl(0.34, 0.3, 0.1, 20), M.metal, 0, 0.12, 0, feeder); mesh(new THREE.ConeGeometry(0.28, 0.16, 18), M.metal, 0, 0.78, 0, feeder);
    mesh(cyl(0.3, 0.3, 0.04, 20), straw, 0, 0.17, 0, feeder, false);
    const waterer = new THREE.Group(); waterer.position.set(COOP.x - 6.2, 0, COOP.z + 1.2); root.add(waterer);
    mesh(cyl(0.3, 0.3, 0.08, 20), pbr(null, { color: 0xb3262a, roughness: 0.4 }), 0, 0.04, 0, waterer); mesh(cyl(0.2, 0.2, 0.42, 18), pbr(null, { color: 0xe9e5dc, roughness: 0.25, transparent: true, opacity: 0.85 }), 0, 0.3, 0, waterer);
    mesh(cyl(0.21, 0.21, 0.06, 18), pbr(null, { color: 0xb3262a, roughness: 0.4 }), 0, 0.53, 0, waterer);
    // dust-bath dirt and scattered straw on the run floor
    const floor = new THREE.PlaneGeometry(RUN.x1 - RUN.x0, RUN.z1 - RUN.z0, 1, 1); floor.rotateX(-Math.PI / 2); scaleUV(floor, 3, 4);
    mesh(floor, pbr(null, { map: M.path.map, normalMap: M.path.normalMap, roughnessMap: M.path.roughnessMap, color: 0xb59a76 }, { wet: 1.3, snow: 0.9 }), (RUN.x0 + RUN.x1) / 2, 0.015, (RUN.z0 + RUN.z1) / 2, root, false);
    const strawG = box(0.012, 0.006, 0.16); const strawI = new THREE.InstancedMesh(strawG, M.hay, 900);
    { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1); for (let i = 0; i < 900; i++) { const p = R() < 0.4 ? underCoop() : runPoint(); e.set(0, R() * 6, (R() - 0.5) * 0.3); q.setFromEuler(e); s.set(1, 1, 0.6 + R() * 0.9); m4.compose(v.set(p.x, 0.024, p.z), q, s); strawI.setMatrixAt(i, m4); } }
    strawI.receiveShadow = true; root.add(strawI);

    /* --- run fence: posts, rails and galvanised chicken wire --- */
    const wire = wireTexture();
    const wireM = new THREE.MeshStandardMaterial({ map: wire, alphaMap: wire, alphaTest: 0.35, transparent: false, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide, color: 0x9ea29e });
    wire.colorSpace = THREE.NoColorSpace;
    const H = 1.45;
    const side = (x0: number, z0: number, x1: number, z1: number, gate = false) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(L / 2.2));
      for (let i = 0; i <= n; i++) { const u = i / n; mesh(box(0.11, H + 0.15, 0.11), post, x0 + (x1 - x0) * u, (H + 0.15) / 2, z0 + (z1 - z0) * u, root); }
      const segs = gate ? [[0, 0.42], [0.58, 1]] : [[0, 1]];
      for (const [a, b] of segs) {
        const l = L * (b - a), cx = x0 + (x1 - x0) * (a + b) / 2, cz = z0 + (z1 - z0) * (a + b) / 2;
        const g = scaleUV(new THREE.PlaneGeometry(l, H), l * 3.2, H * 3.2); const p = mesh(g, wireM, cx, H / 2 + 0.02, cz, root, true); p.rotation.y = -ang;
        for (const y of [0.08, H]) { const r = mesh(box(l, 0.06, 0.05), M.wood, cx, y, cz, root); r.rotation.y = -ang; }
      }
      if (gate) { // a little timber gate standing ajar
        const g = new THREE.Group(); const gx = x0 + (x1 - x0) * 0.42, gz = z0 + (z1 - z0) * 0.42; g.position.set(gx, 0, gz); g.rotation.y = -ang - 0.5; root.add(g);
        const gl = L * 0.16; for (const y of [0.25, 0.75, 1.25]) mesh(box(gl, 0.08, 0.04), white, gl / 2, y, 0, g);
        for (const x of [0.04, gl - 0.04]) mesh(box(0.06, 1.3, 0.05), white, x, 0.7, 0, g);
        const br = mesh(box(Math.hypot(gl, 1), 0.06, 0.04), white, gl / 2, 0.75, 0, g); br.rotation.z = Math.atan2(1, gl);
      }
    };
    side(RUN.x0, RUN.z0, RUN.x1, RUN.z0);
    side(RUN.x1, RUN.z0, RUN.x1, COOP.z - COOP.d / 2);
    side(RUN.x1, COOP.z + COOP.d / 2, RUN.x1, RUN.z1, true);
    side(RUN.x1, RUN.z1, RUN.x0, RUN.z1);
    side(RUN.x0, RUN.z1, RUN.x0, RUN.z0);

    /* --- duck house: a low A-frame by the pond with straw nests out front --- */
    const dh = new THREE.Group(); dh.position.set(DUCK_HOUSE.x, 0, DUCK_HOUSE.z); dh.rotation.y = 0; root.add(dh);
    const dW = 2.4, dD = 2.0;
    mesh(box(dW + 0.2, 0.12, dD + 0.2), M.woodDark, 0, 0.06, 0, dh);
    const back = mesh(box(0.08, 0.95, dD), M.wood, dW / 2 - 0.04, 0.6, 0, dh); back.castShadow = true;
    for (const s of [-1, 1]) mesh(box(dW, 0.95, 0.08), M.wood, 0, 0.6, s * (dD / 2 - 0.04), dh);
    mesh(box(0.08, 0.95, 0.5), M.wood, -dW / 2 + 0.04, 0.6, -dD / 2 + 0.25, dh); mesh(box(0.08, 0.95, 0.5), M.wood, -dW / 2 + 0.04, 0.6, dD / 2 - 0.25, dh);
    mesh(box(0.08, 0.3, dD), M.wood, -dW / 2 + 0.04, 0.95, 0, dh);
    for (const s of [-1, 1]) { const r = mesh(box(dW + 0.4, 0.06, Math.hypot(dD / 2, 0.7) + 0.2), pbr(null, { color: 0x3d5a4a, roughness: 0.7 }, { snow: 1 }), 0, 1.43, s * dD / 4 * 1.05, dh); r.rotation.x = s * Math.atan2(0.7, dD / 2); }
    mesh(sph(0.6, 12, 6), straw, -dW / 2 + 0.3, 0.12, 0, dh, false).scale.set(0.6, 0.15, 1.2);
    // a little plank ramp from house into the reeds
    const dr = mesh(box(0.5, 0.04, 1.6), M.wood, -dW / 2 - 0.7, 0.08, 0.0, dh); dr.rotation.set(0, Math.PI / 2, 0.08);

    /* --- nests and their eggs (shown when the sim says the nest is ready to collect) --- */
    const henEgg = pbr(null, { color: 0xc98f5f, roughness: 0.45 }, { snow: 0 }), creamEgg = pbr(null, { color: 0xf0e4cf, roughness: 0.42 }, { snow: 0 }), duckEgg = pbr(null, { color: 0xd8e6dd, roughness: 0.35 }, { snow: 0 });
    const eggG = sph(0.045, 12, 10); eggG.scale(1, 1.3, 1);
    const nestEggs: THREE.Group[] = [];
    const nestRing = new THREE.TorusGeometry(0.24, 0.09, 8, 18); nestRing.rotateX(Math.PI / 2);
    for (const n of NESTS) {
      const g = new THREE.Group(); root.add(g);
      if (n.type === 'eggs') { g.position.set(n.x, 1.06 + 0.02, n.z); for (let i = 0; i < 3; i++) { const e = mesh(eggG, i === 1 ? creamEgg : henEgg, Math.cos(i * 2.1) * 0.07, 0.02, Math.sin(i * 2.1) * 0.07, g); e.rotation.set(Math.PI / 2 - 0.2, i, 0.3); } }
      else {
        g.position.set(n.x, 0.02, n.z); mesh(nestRing, straw, n.x, 0.06, n.z, root, false); const bowl = mesh(new THREE.CircleGeometry(0.24, 16), straw, n.x, 0.035, n.z, root, false); bowl.rotation.x = -Math.PI / 2;
        for (let i = 0; i < 5; i++) { const e = mesh(eggG, duckEgg, Math.cos(i * 1.26) * 0.09, 0.07, Math.sin(i * 1.26) * 0.09, g); e.scale.setScalar(1.18); e.rotation.set(Math.PI / 2 - 0.15, i, 0.2); }
      }
      nestEggs.push(g);
    }

    /* --- the flock --- */
    const birds: Bird[] = [];
    const hens: [number, number][] = [[0x8a4a22, 0x6b3416], [0x8a4a22, 0x6b3416], [0x9a5a2c, 0x5a2a12], [0xefe9de, 0xdcd3c4], [0xefe9de, 0xdcd3c4], [0x262422, 0x3b3530], [0xb07a3a, 0x8a5524], [0x8a4a22, 0x6b3416], [0xd9c7a4, 0xb79e75], [0x5a3a2a, 0x2a1a12]];
    const roost = (b: Bird) => { const p = runPoint(); b.x = p.x; b.z = p.z; b.tx = p.x; b.tz = p.z; };
    const rooster = makeChicken('rooster', 0xb8541e, 0xe08a2c); roost(rooster); birds.push(rooster); root.add(rooster.root);
    for (const [c, a] of hens) { const b = makeChicken('hen', c, a); roost(b); birds.push(b); root.add(b.root); }
    const looks: DuckLook[] = ['mallard', 'mallard', 'hen', 'hen', 'hen', 'pekin', 'pekin'];
    const ducks: Bird[] = [];
    for (const l of looks) { const d = makeDuck(l); const p = pondPoint(); d.x = d.tx = p.x; d.z = d.tz = p.z; ducks.push(d); birds.push(d); root.add(d.root); }
    const mum = ducks[2];
    for (let i = 0; i < 5; i++) { const d = makeDuck('duckling'); d.mother = mum; d.idx = i; d.x = mum.x - 0.3 * (i + 1); d.z = mum.z; d.state = 'follow'; birds.push(d); root.add(d.root); }
    for (const b of birds) b.root.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false; });
    return { root, birds, nestEggs, glow };
  }, []);

  useFrame((_, rdt) => {
    const dt = Math.min(rdt, 0.1) * Math.min(sim.speed, 4), t = performance.now() / 1000;
    const night = sim.daylight < 0.12, rain = env.n.rain > 0.35, frozen = env.n.frozen > 0.5;
    built.glow.emissiveIntensity = THREE.MathUtils.lerp(built.glow.emissiveIntensity, night ? 2.2 : 0, 1 - Math.exp(-rdt * 1.5));
    // eggs: the n-th nest slot in the sim maps to the n-th nest built above
    let ni = 0; for (const s of sim.slots) { if (s.sx == null) continue; const g = built.nestEggs[ni++]; if (g) g.visible = s.state === 'ripe'; }

    for (const b of built.birds) {
      const chicken = b.kind === 'hen' || b.kind === 'rooster';
      b.t -= dt;
      let tx = b.tx, tz = b.tz, sp = b.speed;
      if (chicken) {
        if (night) { // file up the ramp and vanish into the coop
          if (b.state !== 'inside') { b.state = 'bed'; tx = b.tx = RAMP.x; tz = b.tz = RAMP.z; if (Math.hypot(b.x - RAMP.x, b.z - RAMP.z) < 0.3) b.state = 'inside'; }
        } else if (b.state === 'inside' || b.state === 'bed') { b.state = 'idle'; b.x = RAMP.x; b.z = RAMP.z; b.root.visible = false; b.t = rr(0.2, 8); const p = runPoint(); b.tx = p.x; b.tz = p.z; }
        if (b.state === 'idle' && b.x === RAMP.x && b.t > 0) { b.root.visible = false; continue; }
        if (b.state === 'idle' && b.x === RAMP.x) { b.state = 'wander'; b.t = rr(3, 6); b.x += 0.001; }
        if (!night && b.t <= 0) {
          const r = R();
          if (rain && r < 0.8) { const p = underCoop(); b.tx = p.x; b.tz = p.z; b.state = 'shelter'; b.t = rr(4, 9); }
          else if (r < 0.45) { const p = runPoint(); b.tx = p.x; b.tz = p.z; b.state = 'wander'; b.t = rr(2, 5); }
          else if (r < 0.75) { b.state = 'peck'; b.t = rr(1.5, 4); }
          else if (r < 0.9) { b.state = 'scratch'; b.t = rr(1, 2.5); }
          else { b.state = 'idle'; b.t = rr(1, 3); }
          tx = b.tx; tz = b.tz;
        }
        b.root.visible = b.state !== 'inside';
      } else if (b.kind === 'duck') {
        if (b.t <= 0) {
          if (night) { const p = shorePoint(); b.tx = p.x; b.tz = p.z; b.state = 'sleep'; b.t = rr(8, 15); }
          else { const r = R(); if (r < 0.62 || frozen) { const p = pondPoint(); b.tx = p.x; b.tz = p.z; b.state = 'swim'; b.t = rr(4, 9); } else if (r < 0.82) { b.state = 'dabble'; b.t = rr(1.2, 2.4); if (!frozen && inPond(b.x, b.z)) fxBus.ripple(b.x, b.z, 0.6); } else { const p = shorePoint(); b.tx = p.x; b.tz = p.z; b.state = 'waddle'; b.t = rr(6, 11); } }
        }
        tx = b.tx; tz = b.tz;
      } else if (b.mother) { // ducklings trail mum in a wobbly line
        const back = 0.4 + 0.26 * (b.idx ?? 0);
        tx = b.mother.x - Math.sin(b.mother.yaw) * back + Math.sin(t * 1.3 + b.seed) * 0.12; tz = b.mother.z - Math.cos(b.mother.yaw) * back + Math.cos(t * 1.1 + b.seed) * 0.12;
        sp = b.mother.speed * 1.5;
      }
      const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      const moveOK = chicken ? (b.state === 'wander' || b.state === 'shelter' || b.state === 'bed') : b.state !== 'dabble';
      let moving = false;
      if (moveOK && d > 0.12) {
        const step = Math.min(d, sp * dt * (b.state === 'bed' ? 1.3 : 1));
        b.x += (dx / d) * step; b.z += (dz / d) * step; moving = true;
        const want = Math.atan2(dx, dz); let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * Math.min(1, dt * 6);
      } else if (chicken && b.state === 'idle') b.yaw += Math.sin(t * 0.7 + b.seed) * dt * 0.6;
      if (chicken) { // keep inside the run
        b.x = THREE.MathUtils.clamp(b.x, RUN.x0 + 0.3, RUN.x1 - 0.3); b.z = THREE.MathUtils.clamp(b.z, RUN.z0 + 0.3, RUN.z1 - 0.3);
      }
      b.walk += moving ? dt * sp * 14 : 0;
      const water = !chicken && !frozen && inPond(b.x, b.z, 0.97);
      b.swim = THREE.MathUtils.lerp(b.swim, water ? 1 : 0, 1 - Math.exp(-dt * 4));
      // pose
      const bob = moving && !water ? Math.abs(Math.sin(b.walk)) * 0.025 : 0;
      const waterY = 0.16 - 0.1 * (b.kind === 'duckling' ? 0.45 : 1);
      const y = THREE.MathUtils.lerp(frozen && inPond(b.x, b.z) ? 0.17 : 0.02, waterY + Math.sin(t * 1.7 + b.seed) * 0.012, b.swim) + bob;
      b.root.position.set(b.x, y, b.z); b.root.rotation.y = b.yaw;
      for (let i = 0; i < b.legs.length; i++) { b.legs[i].rotation.x = moving ? Math.sin(b.walk + i * Math.PI) * (water ? 0.9 : 0.55) : 0; b.legs[i].visible = b.swim < 0.6; }
      let pitch = 0, headX = 0, roll = 0;
      if (chicken) {
        if (b.state === 'peck') headX = Math.max(0, Math.sin(t * 7 + b.seed)) * 1.25, pitch = 0.25;
        else if (b.state === 'scratch') { b.legs[0].rotation.x = Math.sin(t * 12) * 0.7; pitch = 0.12; headX = 0.6; }
        else headX = Math.sin(t * 2.2 + b.seed) * 0.12 + (moving ? Math.sin(b.walk * 2) * 0.15 : 0);
        if (b.kind === 'rooster' && !night) { b.crow -= dt; if (b.crow < 0) { b.state = 'crow'; b.t = 1.4; b.crow = rr(25, 70); } if (b.state === 'crow') { headX = -0.7; pitch = -0.3; } }
        if (b.state === 'shelter' && !moving) { pitch = 0; headX = 0.25; roll = 0; b.body.position.y = -0.06; } else b.body.position.y = 0;
      } else {
        roll = moving && !water ? Math.sin(b.walk) * 0.12 : 0; // waddle
        if (b.state === 'dabble' && water) { pitch = THREE.MathUtils.lerp(0, 1.25, Math.min(1, Math.sin(Math.min(1, (2.4 - b.t) / 2.2) * Math.PI) * 1.4)); headX = 0.6; }
        else if (b.state === 'sleep' && !moving) { headX = -1.9; b.body.position.y = -0.05; }
        else { headX = Math.sin(t * 1.4 + b.seed) * 0.1; b.body.position.y = 0; }
      }
      b.body.rotation.set(pitch, 0, roll); b.head.rotation.x = THREE.MathUtils.lerp(b.head.rotation.x, headX, 1 - Math.exp(-rdt * 14));
      // wake ripples when swimming
      if (water && moving && b.kind === 'duck' && R() < dt * 1.2) fxBus.ripple(b.x, b.z, 0.35);
    }
  });
  return <primitive object={built.root} />;
}
