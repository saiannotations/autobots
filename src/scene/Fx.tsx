import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { sim } from '../sim/instance';
import { fxBus } from './Buildings';
import { makeItem } from './items';
import { env } from './envState';

interface P { o: THREE.Object3D; v: THREE.Vector3; life: number; max: number; kind: 'coin' | 'puff' | 'ring' | 'arc' | 'spark'; s?: number; a?: THREE.Vector3; b?: THREE.Vector3; mat?: THREE.Material & { opacity: number } }

export function Fx() {
  const world = useMemo(() => new THREE.Group(), []);
  const R = useMemo(() => ({
    coinG: new THREE.CylinderGeometry(0.12, 0.12, 0.025, 24), coinM: new THREE.MeshStandardMaterial({ color: 0xf0c24a, metalness: 1, roughness: 0.2 }),
    puffG: new THREE.SphereGeometry(0.18, 10, 8), ringG: new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), sparkG: new THREE.OctahedronGeometry(0.06, 0),
    sparkM: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.4) }),
  }), []);
  const list = useMemo<P[]>(() => [], []);

  useEffect(() => {
    fxBus.ripple = (x, z, s) => {
      if (list.filter(p => p.kind === 'ring').length > 40) return;
      const mat = new THREE.MeshBasicMaterial({ color: 0xdfeef2, transparent: true, opacity: 0.5, depthWrite: false });
      const m = new THREE.Mesh(R.ringG, mat); m.position.set(x, 0.18, z); m.scale.setScalar(0.2); world.add(m);
      list.push({ o: m, v: new THREE.Vector3(), life: 0, max: 1.2, kind: 'ring', s, mat });
    };
    return () => { fxBus.ripple = () => {}; };
  }, [R, list, world]);

  useFrame((_, rdt) => {
    const dt = Math.min(rdt, 0.1) * sim.speed;
    for (const e of sim.events.splice(0)) {
      if (e.k === 'sale') for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(R.coinG, R.coinM); m.position.set(e.x, 2.1, e.z); m.rotation.x = Math.PI / 2; m.castShadow = true; world.add(m); list.push({ o: m, v: new THREE.Vector3((Math.random() - 0.5) * 2.4, 3 + Math.random() * 1.5, (Math.random() - 0.5) * 2.4), life: 0, max: 0.8 + Math.random() * 0.25, kind: 'coin' }); }
      else if (e.k === 'plant') for (let i = 0; i < 5; i++) { const mat = new THREE.MeshStandardMaterial({ color: env.snowCover > 0.5 ? 0xe8eef2 : 0x7a5a3a, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false }); const m = new THREE.Mesh(R.puffG, mat); m.position.set(e.x + (Math.random() - 0.5) * 0.6, 0.35, e.z + (Math.random() - 0.5) * 0.6); world.add(m); list.push({ o: m, v: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2), life: 0, max: 1, kind: 'puff', mat }); }
      else if (e.k === 'catch') { if (env.n.frozen < 0.5) fxBus.ripple(e.fx, e.fz, 1.2); const f = makeItem(e.item); f.scale.setScalar(1.4); world.add(f); list.push({ o: f, v: new THREE.Vector3(), life: 0, max: 0.7, kind: 'arc', a: new THREE.Vector3(e.fx, 0.2, e.fz), b: new THREE.Vector3(e.x, 1.8, e.z) }); }
      else if (e.k === 'miss') { if (env.n.frozen < 0.5) fxBus.ripple(e.fx, e.fz, 0.8); }
      else if (e.k === 'level' || e.k === 'newbot') { const b = sim.botById(e.bot); if (b) for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(R.sparkG, R.sparkM); m.position.set(b.x, 1.4, b.z); world.add(m); list.push({ o: m, v: new THREE.Vector3((Math.random() - 0.5) * 3.6, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3.6), life: 0, max: 0.6 + Math.random() * 0.4, kind: 'spark' }); } }
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.life += dt; const k = Math.min(1, p.life / p.max);
      if (p.kind === 'coin' || p.kind === 'spark') { p.v.y -= 9 * dt; p.o.position.addScaledVector(p.v, dt); p.o.rotation.y += dt * 10; p.o.scale.setScalar(Math.max(0.01, 1 - k * k)); }
      else if (p.kind === 'puff') { p.o.position.addScaledVector(p.v, dt); p.v.multiplyScalar(0.95); p.o.scale.setScalar(1 + k * 2); p.mat!.opacity = 0.5 * (1 - k); }
      else if (p.kind === 'ring') { p.o.scale.setScalar((0.2 + k * 1.5) * (p.s || 1)); p.mat!.opacity = 0.5 * (1 - k); }
      else if (p.kind === 'arc') { p.o.position.lerpVectors(p.a!, p.b!, k); p.o.position.y += Math.sin(k * Math.PI) * 2; p.o.rotation.z += dt * 12; }
      if (k >= 1) { world.remove(p.o); p.mat?.dispose(); list.splice(i, 1); }
    }
  });
  return <primitive object={world} />;
}
