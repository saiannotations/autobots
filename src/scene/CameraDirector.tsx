import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { sim } from '../sim/instance';
import { CROPS, CROP_TYPES, type CropKey } from '../sim/constants';
import { useHud } from '../ui/store';

type Shot = { dur: number; bot?: boolean; f?: (t: number, s: ShotState) => number[] };
interface ShotState { a: number; crop: CropKey; botId: number }

const SHOTS: Shot[] = [
  { dur: 16, f: (t, s) => { const a = s.a + t * 0.032; return [Math.cos(a) * 62, 34, Math.sin(a) * 62 - 6, 0, 0, -6]; } },
  { dur: 14, bot: true },
  { dur: 13, f: t => [-15 + t * 0.9, 4.6, 22.5, -2 + t * 0.3, 1.4, 6] },
  { dur: 13, f: (t, s) => { const a = s.a + t * 0.04; return [Math.sin(a) * 18, 5.5, -31 + Math.cos(a) * 14, 0, 0.4, -31]; } },
  { dur: 12, f: (t, s) => { const p = CROPS[s.crop]; const d = Math.sign(p.pz); return [p.px - 9 + t * 1.3, 2.8, p.pz + d * 9, p.px, 0.9, p.pz - d]; } },
  { dur: 14, bot: true },
  { dur: 14, f: t => [6 + t * 0.3, 2.4, 52 - t * 1.0, 0, 4.2, -10] },
  { dur: 13, f: (t, s) => { const a = s.a + t * 0.03; return [-39 + Math.cos(a) * 24, 8, -30 + Math.sin(a) * 24, -37, 3, -36]; } },
  { dur: 12, f: t => [10 - t * 1.6, 1.6, 9.5, -2 - t * 1.2, 1.5, 6] },
  { dur: 13, f: t => [-31 + t * 0.15, 3.2, 12 - t * 0.35, -39, 0.6, 2] },
  { dur: 12, f: t => [9 + t * 0.25, 2.2, -31.5 + t * 0.1, 7, 0.3, -35.5] },
];

export function CameraDirector() {
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const mode = useHud(s => s.camMode); const followId = useHud(s => s.followId); const set = useHud(s => s.set);
  const st = useMemo(() => ({ idx: -1, t: 0, shot: null as Shot | null, s: { a: 0, crop: 'tomato' as CropKey, botId: 0 } as ShotState, p: new THREE.Vector3(), q: new THREE.Vector3(), tv: new THREE.Vector3() }), []);
  const keys = useMemo(() => new Set<string>(), []);

  const next = () => {
    st.idx = (st.idx + 1) % SHOTS.length; st.shot = SHOTS[st.idx]; st.t = 0; st.s.a = Math.random() * Math.PI * 2;
    st.s.crop = CROP_TYPES[Math.floor(Math.random() * 4)];
    const busy = sim.bots.filter(b => b.task && b.task.type !== 'idle'); const pool = busy.length ? busy : sim.bots;
    st.s.botId = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : 0;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); if (useHud.getState().camMode !== 'free') set({ camMode: 'free' }); e.preventDefault(); }
      if (k === 'escape') set({ camMode: 'cinematic', followId: 0 });
      if (k === 'h') set({ uiHidden: !useHud.getState().uiHidden });
      if (k === 'c') set({ camMode: useHud.getState().camMode === 'cinematic' ? 'free' : 'cinematic' });
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [keys, set]);
  useEffect(() => { if (mode === 'cinematic') next(); }, [mode]); // eslint-disable-line
  useEffect(() => {
    if (!(window as any).__farm) return;
    (window as any).__cam = (a: number, b: number, c: number, d: number, e: number, f: number) => { set({ camMode: 'free' }); setTimeout(() => { camera.position.set(a, b, c); controls.current?.target.set(d, e, f); controls.current?.update(); }, 50); };
  }, [camera, set]);

  useFrame((_, rdt) => {
    const c = controls.current; if (!c) return; const dt = Math.min(rdt, 0.1);
    if (mode === 'follow') {
      const b = sim.botById(followId); if (!b) { set({ camMode: 'cinematic', followId: 0 }); return; }
      st.tv.set(b.x, 1.0, b.z).sub(c.target); const k = Math.min(1, dt * 4); c.target.addScaledVector(st.tv, k); camera.position.addScaledVector(st.tv, k);
    } else if (mode === 'cinematic') {
      if (!st.shot) next(); st.t += dt; if (st.t > st.shot!.dur) next();
      let a: number[];
      if (st.shot!.bot) {
        const b = sim.botById(st.s.botId) || sim.bots[0]; if (!b) return;
        a = [b.x - Math.sin(b.yaw) * 7 + Math.cos(b.yaw) * 1.8, 3.2, b.z - Math.cos(b.yaw) * 7 - Math.sin(b.yaw) * 1.8, b.x, 1.1, b.z];
      } else a = st.shot!.f!(st.t, st.s);
      st.p.set(a[0], a[1], a[2]); st.q.set(a[3], a[4], a[5]);
      const k = 1 - Math.exp(-dt * (st.shot!.bot ? 1.3 : 0.65)); camera.position.lerp(st.p, k); c.target.lerp(st.q, k);
    } else if (keys.size) {
      camera.getWorldDirection(st.tv); st.tv.y = 0; st.tv.normalize(); const fx = st.tv.x, fz = st.tv.z;
      const ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const iz = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const sp = camera.position.distanceTo(c.target) * 0.8 * dt; const dx = (fx * iz - fz * ix) * sp, dz = (fz * iz + fx * ix) * sp;
      c.target.x += dx; c.target.z += dz; camera.position.x += dx; camera.position.z += dz;
    }
    if (camera.position.y < 1.2) camera.position.y = 1.2;
  });

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.07} maxPolarAngle={1.47} minDistance={4} maxDistance={190} target={[0, 0, -6]}
    onStart={() => { if (useHud.getState().camMode === 'cinematic') set({ camMode: 'free' }); }} />;
}
