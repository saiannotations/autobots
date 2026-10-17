import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getMats } from '../gfx/materials';
import { sim } from '../sim/instance';
import { botScale, type Bot } from '../sim/world';
import { FISH_SPOTS, ITEMS } from '../sim/constants';
import { makeItem } from './items';
import { env } from './envState';
import { useHud } from '../ui/store';

const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 4, r);
let G: Record<string, THREE.BufferGeometry> | null = null;
function geos() {
  if (G) return G;
  const pool = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,210,0.9)'); g.addColorStop(0.5, 'rgba(255,230,190,0.3)'); g.addColorStop(1, 'rgba(255,230,190,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; })();
  poolTex = new THREE.CanvasTexture(pool);
  G = {
    chassis: rbox(1.1, 0.42, 1.42, 0.13), under: new THREE.BoxGeometry(0.95, 0.18, 1.2), tire: new THREE.TorusGeometry(0.25, 0.09, 12, 28), hub: new THREE.CylinderGeometry(0.2, 0.2, 0.2, 24),
    torso: rbox(0.86, 0.72, 0.72, 0.15), head: rbox(0.78, 0.46, 0.58, 0.17), visor: rbox(0.64, 0.25, 0.06, 0.03), eye: new THREE.CapsuleGeometry(0.035, 0.07, 4, 10),
    mast: new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), tip: new THREE.SphereGeometry(0.055, 12, 10), shoulder: new THREE.SphereGeometry(0.12, 16, 12),
    limb: new THREE.CapsuleGeometry(0.065, 0.38, 6, 14), grip: rbox(0.16, 0.12, 0.12, 0.03), finger: rbox(0.04, 0.12, 0.06, 0.015), tray: rbox(0.86, 0.06, 0.56, 0.02),
    wall: new THREE.BoxGeometry(0.86, 0.24, 0.04), side: new THREE.BoxGeometry(0.04, 0.24, 0.56), light: new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16),
    rod: new THREE.CylinderGeometry(0.012, 0.028, 2.0, 8), reel: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), bobber: new THREE.SphereGeometry(0.08, 16, 12),
    hole: new THREE.CircleGeometry(0.42, 32).rotateX(-Math.PI / 2), pool: new THREE.PlaneGeometry(3.2, 5.5).rotateX(-Math.PI / 2), vent: rbox(0.5, 0.04, 0.2, 0.01),
    panel: rbox(0.3, 0.18, 0.02, 0.01), led: new THREE.SphereGeometry(0.02, 6, 4),
  };
  return G;
}
let poolTex: THREE.Texture;
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xdffaff, emissive: 0x8fe6ff, emissiveIntensity: 3 });
const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0cc, emissiveIntensity: 0.4 });
const lineMat = new THREE.LineBasicMaterial({ color: 0xf2efe8, transparent: true, opacity: 0.7 });
const holeMat = new THREE.MeshStandardMaterial({ color: 0x0c2129, roughness: 0.05 });
const bobberMat = new THREE.MeshPhysicalMaterial({ color: 0xd8392a, roughness: 0.3, clearcoat: 1 });
const ledMats = [0x6fe39a, 0xf3c46b, 0x6fb7e3].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.5 }));

interface View {
  id: number; root: THREE.Group; inner: THREE.Group; head: THREE.Group; wheels: THREE.Group[]; arms: { sh: THREE.Group; el: THREE.Group }[];
  rack: THREE.Group; rod: THREE.Group; rodTip: THREE.Object3D; bobber: THREE.Mesh; hole: THREE.Mesh; line: THREE.Line; tip: THREE.MeshStandardMaterial;
  pool: THREE.Mesh; poolMat: THREE.MeshBasicMaterial; carryKey: string; lastDist: number; spawn: number; pop: number; level: number; paint: THREE.MeshPhysicalMaterial;
}

function mk(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, shadow = true) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o; }

function buildBot(b: Bot, world: THREE.Group): View {
  const M = getMats(); const Gm = geos();
  const paint = new THREE.MeshPhysicalMaterial({ color: b.color, roughness: 0.3, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, roughnessMap: M.tex.paint.rough, normalMap: M.tex.paint.normal, normalScale: new THREE.Vector2(0.15, 0.15) });
  const grey = new THREE.MeshPhysicalMaterial({ color: 0xdcd8d0, roughness: 0.42, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const root = new THREE.Group(); root.userData.botId = b.id; const inner = new THREE.Group(); root.add(inner);
  mk(Gm.under, M.dark, inner, 0, 0.32, 0); mk(Gm.chassis, paint, inner, 0, 0.6, 0);
  mk(Gm.vent, M.dark, inner, 0, 0.82, 0.35).rotation.x = -0.2;
  const wheels: THREE.Group[] = [];
  for (const x of [-0.6, 0.6]) for (const z of [-0.42, 0.42]) {
    const w = new THREE.Group(); w.position.set(x, 0.33, z); inner.add(w);
    const t = mk(Gm.tire, M.rubber, w); t.rotation.y = Math.PI / 2; const h = mk(Gm.hub, M.chrome, w); h.rotation.z = Math.PI / 2;
    for (let k = 0; k < 5; k++) { const sp = mk(new THREE.BoxGeometry(0.22, 0.03, 0.03), M.dark, w, 0, 0, 0, false); sp.rotation.x = (k / 5) * Math.PI; }
    wheels.push(w);
  }
  for (const x of [-0.32, 0.32]) mk(Gm.light, headlightMat, inner, x, 0.62, 0.72, false).rotation.x = Math.PI / 2;
  mk(Gm.torso, grey, inner, 0, 1.15, 0.05);
  mk(Gm.panel, M.glass, inner, 0, 1.22, 0.42, false);
  ledMats.forEach((lm, i) => mk(Gm.led, lm, inner, -0.08 + i * 0.08, 1.22, 0.435, false));
  const head = new THREE.Group(); head.position.set(0, 1.75, 0.06); inner.add(head);
  mk(Gm.head, paint, head); mk(Gm.visor, M.glass, head, 0, 0.01, 0.28);
  for (const x of [-0.14, 0.14]) mk(Gm.eye, eyeMat, head, x, 0.01, 0.315, false).rotation.z = Math.PI / 2;
  mk(Gm.mast, M.dark, head, 0.24, 0.45, -0.1);
  const tip = new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 2 }); mk(Gm.tip, tip, head, 0.24, 0.72, -0.1, false);
  const arms: { sh: THREE.Group; el: THREE.Group }[] = [];
  for (const x of [-0.56, 0.56]) {
    const sh = new THREE.Group(); sh.position.set(x, 1.38, 0.05); inner.add(sh); mk(Gm.shoulder, M.chrome, sh);
    mk(Gm.limb, grey, sh, 0, -0.26, 0); const el = new THREE.Group(); el.position.set(0, -0.5, 0); sh.add(el);
    mk(Gm.shoulder, M.chrome, el).scale.setScalar(0.6); mk(Gm.limb, grey, el, 0, -0.22, 0.02); mk(Gm.grip, M.dark, el, 0, -0.48, 0.02);
    for (const fx of [-0.05, 0.05]) mk(Gm.finger, M.dark, el, fx, -0.58, 0.04, false);
    arms.push({ sh, el });
  }
  const bask = new THREE.Group(); bask.position.set(0, 0.86, -0.5); inner.add(bask);
  mk(Gm.tray, M.dark, bask); mk(Gm.wall, M.dark, bask, 0, 0.12, -0.26); mk(Gm.side, M.dark, bask, -0.41, 0.12, 0); mk(Gm.side, M.dark, bask, 0.41, 0.12, 0);
  const rack = new THREE.Group(); rack.position.set(0, 0.04, 0); bask.add(rack);
  const rod = new THREE.Group(); rod.position.set(0.56, 1.0, 0.3); rod.rotation.x = 1.0; inner.add(rod);
  mk(Gm.rod, M.woodDark, rod, 0, 1.0, 0); mk(Gm.reel, M.chrome, rod, 0.05, 0.3, 0).rotation.z = Math.PI / 2;
  const rodTip = new THREE.Object3D(); rodTip.position.y = 2.0; rod.add(rodTip); rod.visible = false;
  const bobber = mk(Gm.bobber, bobberMat, world, 0, 0, 0, false); bobber.visible = false;
  const hole = mk(Gm.hole, holeMat, world, 0, 0.2, 0, false); hole.visible = false;
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(lg, lineMat); line.frustumCulled = false; line.visible = false; world.add(line);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, color: new THREE.Color(1.4, 1.25, 1.05) });
  const pool = new THREE.Mesh(Gm.pool, poolMat); pool.position.set(0, 0.04, 3.1); pool.renderOrder = 3; root.add(pool);
  root.position.set(b.x, 0, b.z); root.scale.setScalar(0.001); world.add(root);
  return { id: b.id, root, inner, head, wheels, arms, rack, rod, rodTip, bobber, hole, line, tip, pool, poolMat, carryKey: '', lastDist: b.dist, spawn: sim.clock - b.born > 3 ? 1 : 0, pop: 0, level: b.level, paint };
}

function disposeBot(v: View, world: THREE.Group) { world.remove(v.root, v.bobber, v.hole, v.line); v.line.geometry.dispose(); v.paint.dispose(); v.tip.dispose(); v.poolMat.dispose(); }
const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function Bots() {
  const world = useMemo(() => new THREE.Group(), []);
  const views = useMemo(() => new Map<number, View>(), []);
  const tv = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  const setHud = useHud(s => s.set);

  useFrame((state, rdt) => {
    const dt = Math.min(rdt, 0.1); const time = state.clock.elapsedTime;
    const seen = new Set<number>();
    for (const b of sim.bots) {
      seen.add(b.id);
      let v = views.get(b.id); if (!v) { v = buildBot(b, world); views.set(b.id, v); }
      // spawn & level-up pop
      if (v.spawn < 1) v.spawn = Math.min(1, v.spawn + dt * 1.4);
      if (b.level !== v.level) { v.level = b.level; v.pop = 1; }
      v.pop = Math.max(0, v.pop - dt * 1.5);
      const sc = botScale(b) * (v.spawn < 1 ? Math.max(0.001, easeOutBack(v.spawn)) : 1) * (1 + 0.14 * Math.sin(v.pop * Math.PI));
      v.root.scale.setScalar(sc);
      // smooth the sim's 20 Hz-ish motion
      const k = Math.min(1, dt * 18); v.root.position.x += (b.x - v.root.position.x) * k; v.root.position.z += (b.z - v.root.position.z) * k;
      let dy = b.yaw - v.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); v.root.rotation.y += dy * k;
      const moved = b.dist - v.lastDist; v.lastDist = b.dist; v.wheels.forEach(w => (w.rotation.x += moved / 0.33));
      v.inner.position.y = b.moving ? Math.abs(Math.sin(time * 16 + b.id)) * 0.022 : 0;
      v.inner.rotation.x += ((b.moving ? 0.035 : 0) - v.inner.rotation.x) * Math.min(1, dt * 6);
      // carried goods
      const key = b.carry.join(',');
      if (key !== v.carryKey) {
        v.carryKey = key; while (v.rack.children.length) v.rack.remove(v.rack.children[0]);
        b.carry.forEach((t, i) => { const it = makeItem(t); it.position.set(((i % 2) - 0.5) * 0.34, Math.floor(i / 2) * 0.26, 0); it.rotation.y = ITEMS[t].kind === 'fish' ? Math.PI / 2 : i * 0.7; v!.rack.add(it); });
      }
      // arms & tools
      const fishing = b.act === 'fish' && !!b.fish; const [L, R] = v.arms; const ak = Math.min(1, dt * 10);
      const set = (a: { sh: THREE.Group; el: THREE.Group }, s: number, e: number) => { a.sh.rotation.x += (s - a.sh.rotation.x) * ak; a.el.rotation.x += (e - a.el.rotation.x) * ak; };
      v.rod.visible = v.bobber.visible = v.line.visible = fishing; v.hole.visible = fishing && env.n.frozen > 0.5;
      if (fishing) {
        set(R, -1.0 + Math.sin(time * 1.5 + b.id) * 0.05, -0.3); set(L, -0.5, -0.6); v.head.rotation.x = 0.12; v.head.rotation.y *= 0.9;
        const spot = FISH_SPOTS[b.fish!.spot]; const d = spot.pier ? 3.4 : 3.0;
        const bx = b.x + Math.sin(b.yaw) * d, bz = b.z + Math.cos(b.yaw) * d; const nibble = b.fish!.dur - b.fish!.t < 0.7 ? -0.07 * Math.abs(Math.sin(time * 30)) : 0;
        v.bobber.position.set(bx, 0.2 + Math.sin(time * 3 + b.id) * 0.025 + nibble, bz); v.hole.position.set(bx, 0.2, bz);
        v.root.updateMatrixWorld(true); v.rodTip.getWorldPosition(tv.a);
        const a = v.line.geometry.attributes.position as THREE.BufferAttribute; a.setXYZ(0, tv.a.x, tv.a.y, tv.a.z); a.setXYZ(1, bx, v.bobber.position.y, bz); a.needsUpdate = true;
      } else if (b.act === 'harvest' || b.act === 'plant') { const s = Math.sin(time * 10 + b.id); set(L, -1.3 + s * 0.35, -0.7 - s * 0.2); set(R, -1.3 - s * 0.35, -0.7 + s * 0.2); v.head.rotation.x = 0.3; }
      else if (b.act === 'sell' || b.act === 'wholesale') { set(L, -1.25, -0.25); set(R, -1.25, -0.25); v.head.rotation.x = -0.05; }
      else if (b.moving) { const s = Math.sin(time * 9 + b.id) * 0.35; set(L, s, -0.25); set(R, -s, -0.25); v.head.rotation.x *= 0.9; v.head.rotation.y *= 0.9; }
      else { set(L, 0, -0.15); set(R, 0, -0.15); v.head.rotation.x *= 0.9; v.head.rotation.y = Math.sin(time * 0.7 + b.id) * 0.45; }
      v.tip.emissiveIntensity = 1 + 1.5 * (0.5 + 0.5 * Math.sin(time * 3 + b.id * 1.7));
      v.poolMat.opacity = env.night * 0.55 * (1 - env.snowCover * 0.4);
      v.pool.visible = v.poolMat.opacity > 0.01;
    }
    headlightMat.emissiveIntensity = 0.4 + env.night * 7;
    eyeMat.emissiveIntensity = 2.5 + env.night * 2;
    for (const [id, v] of views) if (!seen.has(id)) { disposeBot(v, world); views.delete(id); }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    let o: THREE.Object3D | null = e.object; while (o && o.userData.botId == null) o = o.parent;
    if (o) { e.stopPropagation(); setHud({ camMode: 'follow', followId: o.userData.botId }); }
  };
  return <primitive object={world} onClick={onClick} />;
}
