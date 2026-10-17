import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerformanceMonitor, AdaptiveDpr } from '@react-three/drei';
import { sim, driveSim } from '../sim/instance';
import { useHud, quality } from '../ui/store';
import { Atmosphere } from './Atmosphere';
import { Landscape } from './Landscape';
import { Buildings, Pond } from './Buildings';
import { Crops } from './Crops';
import { Poultry } from './Poultry';
import { Bots } from './Bots';
import { People } from './People';
import { Weather } from './Weather';
import { Fx } from './Fx';
import { CameraDirector } from './CameraDirector';
import { Effects } from './Effects';

/** Advances the farm every frame and mirrors its numbers into the HUD a few times a second. */
function SimDriver() {
  const acc = useRef(0);
  const set = useHud(s => s.set);
  useFrame((_, dt) => {
    driveSim();
    acc.current += dt; if (acc.current < 0.25) return; acc.current = 0;
    const h = sim.hour, mins = Math.floor(h * 60);
    const closed = sim.dayClosed; if (closed) sim.dayClosed = null;
    set({
      day: sim.day, clock: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, progress: sim.dayProgress,
      season: sim.season, seasonPref: sim.seasonPref, speed: sim.speed, cash: sim.cash, lifetime: sim.lifetime, bots: sim.bots.length,
      shoppers: sim.customers.filter(c => c.state !== 'leave').length, soldToday: sim.today.sold, earnedToday: sim.today.earned,
      best: Math.max(sim.best, Math.round(sim.today.earned)), ticker: sim.ticker.slice(-4), ...(closed ? { dayClosed: closed } : {}),
    });
  }, -2);
  return null;
}

const LEVELS = [
  { dpr: 0.75, shadow: 1024, ao: false, },
  { dpr: 1, shadow: 1024, ao: false },
  { dpr: 1.5, shadow: 2048, ao: true },
  { dpr: 2, shadow: 4096, ao: true },
];
export function applyQuality(level: number) {
  const l = Math.max(0, Math.min(3, level)); quality.level = l; quality.shadowMap = LEVELS[l].shadow;
  useHud.getState().set({ qLevel: l });
}
export const dprFor = (l: number) => Math.min(window.devicePixelRatio || 1, LEVELS[Math.max(0, Math.min(3, l))].dpr);

export function World() {
  return (
    <>
      <PerformanceMonitor flipflops={4} onIncline={() => applyQuality(quality.level + 1)} onDecline={() => applyQuality(quality.level - 1)} />
      <AdaptiveDpr pixelated={false} />
      <SimDriver />
      <Atmosphere />
      <Landscape />
      <Buildings />
      <Pond />
      <Crops />
      <Poultry />
      <Bots />
      <People />
      <Weather />
      <Fx />
      <CameraDirector />
      <Effects />
    </>
  );
}
