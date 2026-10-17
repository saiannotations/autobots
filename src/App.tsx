import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { loadTextures } from './gfx/textures';
import { buildMaterials } from './gfx/materials';
import { bootSim, onAway, sim } from './sim/instance';
import { snapEnv, env } from './scene/envState';
import { World, dprFor } from './scene/World';
import { Hud } from './ui/Hud';
import { useHud, isLowEnd } from './ui/store';
import { SEASONS } from './sim/constants';

export default function App() {
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const qLevel = useHud(s => s.qLevel);
  const set = useHud(s => s.set);

  useEffect(() => {
    let alive = true;
    const texP = loadTextures(!isLowEnd);
    // Fast-forward the farm through the time this page was closed while textures build in the worker.
    const away = bootSim();
    snapEnv(sim.season);
    set({ away, seasonPref: sim.seasonPref, speed: sim.speed, qLevel: isLowEnd ? 1 : 2 });
    const off = onAway(r => set({ away: r }));
    if ((window as any).__farm) { (window as any).__seasons = SEASONS; }
    if ((window as any).__farm) (window as any).__snap = (k: any) => { sim.seasonPref = k; snapEnv(k); env.snowCover = k === 'winter' ? 1 : 0; };
    texP.then(t => { if (!alive) return; buildMaterials(t); setReady(true); });
    return () => { alive = false; off(); };
  }, [set]);

  return (
    <>
      {ready && (
        <Canvas
          shadows={{ type: THREE.PCFSoftShadowMap }}
          dpr={dprFor(qLevel)}
          flat
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }}
          camera={{ fov: 42, near: 0.3, far: 3000, position: [58, 40, 52] }}
          onCreated={() => setTimeout(() => setShown(true), 400)}
        >
          <World />
        </Canvas>
      )}
      {ready && <Hud />}
      <div className={'loader' + (shown ? ' done' : '')} aria-hidden={shown}>
        <p>Growing the farm…</p>
      </div>
    </>
  );
}
