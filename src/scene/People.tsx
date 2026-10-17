import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getMats } from '../gfx/materials';
import { sim } from '../sim/instance';
import type { Customer } from '../sim/world';
import { ALL_ITEMS, type ItemKey } from '../sim/constants';
import { drawIcon } from '../ui/icons';
import { srand } from './terrain';
import { env } from './envState';

const SKINS = [0xf1c9a5, 0xe0b08a, 0xc68a62, 0x9c6845, 0x6e4a32, 0x4f3424];
const HAIR = [0x1d140c, 0x3d2614, 0x6b4423, 0xb98a52, 0xd8c08a, 0x2a2a2a, 0x8f8f8f];
const JACKETS = [0x5d7a8c, 0x9c6b4a, 0x6f7d58, 0x3e4a63, 0xb4a07c, 0x8c4a4a, 0x47605c];
const TEES = [0xf2f0ea, 0xe8c35a, 0x6fa3c9, 0xd9725a, 0x83b37a, 0xe2a3b5, 0x2d2f33];
const SWEATERS = [0xa63d32, 0x2f4e6e, 0xd8c3a0, 0x3e5e3e, 0x7a4a6b, 0xc28a3a, 0x5a5a5a];
const PANTS = [0x2a3346, 0x3d4a6b, 0x6b5a3d, 0x2b2b2b, 0x56606b, 0x7a6a52];
const UMBRELLAS = [0x26384f, 0xb53a2e, 0x2f5f4a, 0x1d1d1d, 0xd8a02c, 0x6a3f72];

let GE: Record<string, THREE.BufferGeometry> | null = null;
function geos() {
  if (GE) return GE;
  const umb = new THREE.SphereGeometry(0.72, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.32);
  { const p = umb.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 - 0.06 * Math.abs(Math.sin(a * 4)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } umb.computeVertexNormals(); }
  GE = {
    thigh: new THREE.CapsuleGeometry(0.085, 0.36, 6, 12), shin: new THREE.CapsuleGeometry(0.068, 0.36, 6, 12), shoe: new RoundedBoxGeometry(0.13, 0.09, 0.27, 3, 0.04),
    boot: new RoundedBoxGeometry(0.14, 0.24, 0.27, 3, 0.05), pelvis: new RoundedBoxGeometry(0.34, 0.2, 0.22, 3, 0.07), torso: new THREE.CapsuleGeometry(0.19, 0.36, 8, 18),
    neck: new THREE.CylinderGeometry(0.055, 0.06, 0.1, 12), head: new THREE.SphereGeometry(0.115, 24, 18), upper: new THREE.CapsuleGeometry(0.055, 0.26, 6, 12),
    fore: new THREE.CapsuleGeometry(0.047, 0.24, 6, 12), hand: new THREE.SphereGeometry(0.048, 12, 10), eye: new THREE.SphereGeometry(0.014, 8, 6), nose: new THREE.ConeGeometry(0.018, 0.045, 6),
    hairShort: new THREE.SphereGeometry(0.124, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hairLong: new THREE.CapsuleGeometry(0.1, 0.18, 4, 12),
    brim: new THREE.CylinderGeometry(0.27, 0.27, 0.015, 32), crown: new THREE.CylinderGeometry(0.12, 0.13, 0.11, 24), band: new THREE.CylinderGeometry(0.131, 0.131, 0.03, 24),
    cap: new THREE.SphereGeometry(0.125, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capBill: new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20, 1, false, -Math.PI / 2, Math.PI),
    beanie: new THREE.SphereGeometry(0.128, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), pom: new THREE.SphereGeometry(0.045, 12, 8), scarf: new THREE.TorusGeometry(0.1, 0.045, 10, 22),
    scarfTail: new RoundedBoxGeometry(0.09, 0.32, 0.03, 2, 0.012), hood: new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    glasses: new RoundedBoxGeometry(0.2, 0.045, 0.02, 2, 0.01), umbrella: umb, ribs: new THREE.CylinderGeometry(0.004, 0.004, 0.7, 4), pole: new THREE.CylinderGeometry(0.012, 0.012, 1.05, 8),
    handle: new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), bag: new RoundedBoxGeometry(0.28, 0.22, 0.12, 3, 0.03), strap: new THREE.TorusGeometry(0.13, 0.01, 4, 16, Math.PI),
  };
  return GE;
}

const cloth = (color: number, kind: 'fabric' | 'knit' | 'rain' | 'denim' = 'fabric') => {
  const M = getMats();
  if (kind === 'rain') return new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 });
  const set = kind === 'knit' ? M.tex.knit : M.tex.fabric;
  return new THREE.MeshStandardMaterial({ color, roughness: kind === 'knit' ? 1 : 0.88, map: set.map, normalMap: set.normal, normalScale: new THREE.Vector2(kind === 'knit' ? 1.4 : 0.6, kind === 'knit' ? 1.4 : 0.6) });
};

interface PView {
  id: number; root: THREE.Group; hips: THREE.Group[]; knees: THREE.Group[]; shoulders: THREE.Group[]; elbows: THREE.Group[]; head: THREE.Group;
  bubble: THREE.Sprite; bctx: CanvasRenderingContext2D; btex: THREE.CanvasTexture; rev: number; mats: THREE.Material[]; umbrella: THREE.Group | null;
}

function mk(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, shadow = true) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o; }

function drawBubble(v: PView, c: Customer) {
  const x = v.bctx, W = 360; x.clearRect(0, 0, W, 104);
  const kinds = ALL_ITEMS.filter(k => (c.wish[k] || 0) > 0); const done = !kinds.length;
  const bw = done ? 170 : Math.min(W - 8, kinds.length * 82 + 92), bx = (W - bw) / 2;
  x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 10; x.shadowOffsetY = 3;
  x.fillStyle = c.grumpy ? 'rgba(255,233,220,.96)' : 'rgba(250,248,243,.95)'; x.beginPath(); (x as any).roundRect ? (x as any).roundRect(bx, 10, bw, 62, 31) : x.rect(bx, 10, bw, 62); x.fill();
  x.shadowColor = 'transparent'; x.beginPath(); x.moveTo(W / 2 - 9, 71); x.lineTo(W / 2, 84); x.lineTo(W / 2 + 9, 71); x.fill();
  x.textBaseline = 'middle';
  if (done) { x.fillStyle = '#9c4a35'; x.font = 'italic 36px "Instrument Serif", Georgia, serif'; x.textAlign = 'center'; x.fillText('Thank you', W / 2, 42); }
  else {
    let px = bx + 34;
    for (const k of kinds) { drawIcon(x, k as ItemKey, px, 41, 18); x.fillStyle = '#2a2620'; x.font = '500 23px "Geist", sans-serif'; x.textAlign = 'left'; x.fillText('×' + c.wish[k], px + 21, 43); px += 82; }
    x.fillStyle = '#4f6e33'; x.font = '500 23px "Geist Mono", monospace'; x.textAlign = 'right'; x.fillText('$' + c.wallet, bx + bw - 20, 43);
  }
  v.btex.needsUpdate = true;
}

function buildPerson(c: Customer, world: THREE.Group): PView {
  const Gm = geos(); const R = srand(c.seed); const rp = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const skin = new THREE.MeshPhysicalMaterial({ color: rp(SKINS), roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffd8c0) });
  const hairM = new THREE.MeshStandardMaterial({ color: rp(HAIR), roughness: 0.65 });
  const o = c.outfit; const female = R() < 0.5;
  const top = o === 'sweater' ? cloth(rp(SWEATERS), 'knit') : o === 'raincoat' ? cloth(0xe8b62c, 'rain') : o === 'summer' ? cloth(rp(TEES)) : cloth(rp(JACKETS));
  const pants = cloth(o === 'summer' && R() < 0.6 ? rp([0xc8b48a, 0x6f86a0, 0x3d3d3d]) : rp(PANTS), 'denim');
  const shoeM = new THREE.MeshStandardMaterial({ color: o === 'raincoat' ? 0x2c5a3a : o === 'sweater' ? 0x5a3a24 : rp([0x2a2a2a, 0xe8e4dc, 0x6b4a32, 0x3d4a6b]), roughness: o === 'raincoat' ? 0.3 : 0.6 });
  const mats: THREE.Material[] = [skin, hairM, top, pants, shoeM];
  const shorts = o === 'summer' && R() < 0.7; const shortSleeve = o === 'summer';
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const s = 0.94 + R() * 0.14; body.scale.setScalar(s);
  const hips: THREE.Group[] = [], knees: THREE.Group[] = [];
  for (const x of [-0.095, 0.095]) {
    const hip = new THREE.Group(); hip.position.set(x, 0.92, 0); body.add(hip);
    mk(Gm.thigh, pants, hip, 0, -0.2, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
    mk(Gm.shin, shorts ? skin : pants, knee, 0, -0.2, 0);
    mk(o === 'raincoat' || o === 'sweater' ? Gm.boot : Gm.shoe, shoeM, knee, 0, o === 'raincoat' || o === 'sweater' ? -0.36 : -0.43, 0.05);
    hips.push(hip); knees.push(knee);
  }
  mk(Gm.pelvis, pants, body, 0, 0.97, 0);
  const torso = mk(Gm.torso, top, body, 0, 1.27, 0); torso.scale.set(o === 'sweater' ? 1.22 : 1.12, 1, o === 'sweater' ? 0.86 : 0.78);
  if (o === 'raincoat') { const skirt = mk(new THREE.CylinderGeometry(0.21, 0.26, 0.32, 18, 1, true), top, body, 0, 0.9, 0); skirt.scale.z = 0.8; }
  mk(Gm.neck, o === 'sweater' ? top : skin, body, 0, 1.56, 0);
  const head = new THREE.Group(); head.position.set(0, 1.68, 0); body.add(head);
  const hd = mk(Gm.head, skin, head); hd.scale.set(0.92, 1.08, 1);
  for (const ex of [-0.04, 0.04]) mk(Gm.eye, new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.2 }), head, ex, 0.02, 0.1, false);
  mk(Gm.nose, skin, head, 0, -0.01, 0.115, false).rotation.x = Math.PI / 2;
  // headwear
  if (o === 'sweater') { const bc = cloth(rp(SWEATERS), 'knit'); mats.push(bc); mk(Gm.beanie, bc, head, 0, 0.02, 0); mk(Gm.pom, bc, head, 0, 0.14, 0); const sc = cloth(rp(SWEATERS), 'knit'); mats.push(sc); const sf = mk(Gm.scarf, sc, body, 0, 1.53, 0.0); sf.rotation.x = Math.PI / 2; sf.scale.set(1.25, 1, 1); mk(Gm.scarfTail, sc, body, 0.06, 1.33, 0.17).rotation.z = 0.1; }
  else if (o === 'raincoat') { mk(Gm.hood, top, head, 0, 0.0, -0.01).scale.set(1, 1.05, 1.05); }
  else if (o === 'summer' && R() < 0.75) { const straw = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.9, map: getMats().tex.knit.map }); mats.push(straw); mk(Gm.brim, straw, head, 0, 0.08, 0); mk(Gm.crown, straw, head, 0, 0.13, 0); mk(Gm.band, new THREE.MeshStandardMaterial({ color: 0x5a3a22 }), head, 0, 0.1, 0); }
  else if (o === 'casual' && R() < 0.35) { const capM = cloth(rp(JACKETS)); mats.push(capM); mk(Gm.cap, capM, head, 0, 0.02, 0); const bill = mk(Gm.capBill, capM, head, 0, 0.03, 0.09); bill.rotation.x = 0.1; }
  else { mk(Gm.hairShort, hairM, head, 0, 0.012, -0.008); if (female) mk(Gm.hairLong, hairM, head, 0, -0.1, -0.07); }
  if (o === 'summer' && R() < 0.6) mk(Gm.glasses, new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.05, metalness: 0.6 }), head, 0, 0.02, 0.108, false);
  // arms
  const shoulders: THREE.Group[] = [], elbows: THREE.Group[] = [];
  for (const x of [-0.25, 0.25]) {
    const sh = new THREE.Group(); sh.position.set(x, 1.47, 0); body.add(sh);
    mk(Gm.upper, top, sh, 0, -0.14, 0).scale.setScalar(o === 'sweater' ? 1.25 : 1);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    mk(Gm.fore, shortSleeve ? skin : top, el, 0, -0.13, 0).scale.setScalar(o === 'sweater' ? 1.2 : 1);
    const handM = o === 'sweater' && R() < 0.6 ? (() => { const m = cloth(rp(SWEATERS), 'knit'); mats.push(m); return m; })() : skin;
    mk(Gm.hand, handM, el, 0, -0.3, 0.01);
    shoulders.push(sh); elbows.push(el);
  }
  // umbrella in the right hand
  let umbrella: THREE.Group | null = null;
  if (o === 'umbrella') {
    umbrella = new THREE.Group(); umbrella.position.set(0, -0.3, 0.02); elbows[1].add(umbrella);
    const pm = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.4, metalness: 0.6 }); mats.push(pm);
    mk(Gm.pole, pm, umbrella, 0, 0.5, 0); mk(Gm.handle, pm, umbrella, 0.04, -0.02, 0, false).rotation.z = Math.PI;
    const canM = new THREE.MeshPhysicalMaterial({ color: rp(UMBRELLAS), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide }); mats.push(canM);
    const can = mk(Gm.umbrella, canM, umbrella, 0, 0.62, 0); can.scale.set(1, 0.9, 1);
    for (let i = 0; i < 8; i++) { const rib = mk(Gm.ribs, pm, umbrella, Math.cos((i / 8) * Math.PI * 2) * 0.33, 1.15, Math.sin((i / 8) * Math.PI * 2) * 0.33, false); rib.rotation.set(Math.sin((i / 8) * Math.PI * 2) * 1.2, 0, -Math.cos((i / 8) * Math.PI * 2) * 1.2); }
  } else if (R() < 0.45 && o !== 'raincoat') {
    const bm = new THREE.MeshStandardMaterial({ color: rp([0x8a6a4a, 0xd8cdb5, 0x4a5a3a, 0x7a3a2a]), roughness: 0.7 }); mats.push(bm);
    mk(Gm.bag, bm, body, 0.27, 0.98, 0.04); mk(Gm.strap, bm, body, 0.27, 1.1, 0.04, false);
  }
  // wish-list bubble
  const bc = document.createElement('canvas'); bc.width = 360; bc.height = 104; const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  bubble.scale.set(2.3, 0.66, 1); bubble.position.y = o === 'umbrella' ? 2.95 : 2.35; bubble.renderOrder = 5; root.add(bubble);
  root.position.set(c.x, 0, c.z); root.rotation.y = c.yaw; world.add(root);
  const v: PView = { id: c.id, root, hips, knees, shoulders, elbows, head, bubble, bctx: bc.getContext('2d')!, btex, rev: -1, mats, umbrella };
  return v;
}

export function People() {
  const world = useMemo(() => new THREE.Group(), []);
  const views = useMemo(() => new Map<number, PView>(), []);
  useFrame((_, rdt) => {
    const dt = Math.min(rdt, 0.1); const seen = new Set<number>();
    for (const c of sim.customers) {
      seen.add(c.id); let v = views.get(c.id); if (!v) { v = buildPerson(c, world); views.set(c.id, v); }
      if (v.rev !== c.rev) { v.rev = c.rev; drawBubble(v, c); }
      const k = Math.min(1, dt * 14); v.root.position.x += (c.x - v.root.position.x) * k; v.root.position.z += (c.z - v.root.position.z) * k;
      let dy = c.yaw - v.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); v.root.rotation.y += dy * k;
      const ph = c.walkT * c.speed * 4.2; const amp = c.moving ? 1 : 0;
      const sw = Math.sin(ph) * 0.5 * amp;
      v.hips[0].rotation.x = sw; v.hips[1].rotation.x = -sw;
      v.knees[0].rotation.x = Math.max(0, Math.sin(ph - 1.2)) * 0.8 * amp; v.knees[1].rotation.x = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 0.8 * amp;
      v.root.position.y = Math.abs(Math.cos(ph)) * 0.035 * amp;
      v.shoulders[0].rotation.x = -sw * 0.8; v.elbows[0].rotation.x = -0.25 - Math.max(0, -sw) * 0.4;
      if (v.umbrella) { v.shoulders[1].rotation.set(-0.55, 0, -0.12); v.elbows[1].rotation.set(-1.25, 0, 0); v.umbrella.rotation.set(1.5, 0, 0.1); }
      else { v.shoulders[1].rotation.x = sw * 0.8; v.elbows[1].rotation.x = -0.25 - Math.max(0, sw) * 0.4; }
      if (!c.moving) { const t = performance.now() / 1000 + c.id; v.head.rotation.y = Math.sin(t * 0.4) * 0.35; v.shoulders[0].rotation.x = Math.sin(t * 1.3) * 0.04; } else v.head.rotation.y *= 0.9;
      v.bubble.visible = c.state === 'wait' || (c.state === 'arrive' && c.z < 24);
      (v.bubble.material as THREE.SpriteMaterial).opacity = 0.45 + 0.55 * env.daylight;
    }
    for (const [id, v] of views) if (!seen.has(id)) {
      world.remove(v.root); v.btex.dispose(); (v.bubble.material as THREE.Material).dispose(); v.mats.forEach(m => m.dispose()); views.delete(id);
    }
  });
  return <primitive object={world} />;
}
