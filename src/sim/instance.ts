import { Sim, type AwayReport } from './world';

/** The one farm. It lives outside React so rendering never blocks the simulation. */
export const sim = new Sim();
if (typeof window !== 'undefined' && (import.meta.env.DEV || location.search.includes('debug'))) (window as any).__farm = sim;

let booted = false;
let bootReport: AwayReport | null = null;
let lastTick = performance.now();
let lastWall = Date.now();

/** Load the saved farm (or start one) and fast-forward through the time the page was closed. */
export function bootSim(): AwayReport | null {
  if (booted) return bootReport;
  booted = true;
  const away = sim.load();
  let report: AwayReport | null = null;
  if (away < 0) sim.freshWorld();
  else report = sim.catchUp(away);
  sim.save();
  lastTick = performance.now();
  lastWall = Date.now();
  if (typeof window !== 'undefined') {
    const persist = () => sim.save();
    setInterval(persist, 5000);
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { sim.save(); lastWall = Date.now(); return; }
      // Coming back to a background tab: the farm kept working while the tab slept.
      const gap = (Date.now() - lastWall) / 1000;
      if (gap > 3) { const r = sim.catchUp(gap); if (r && r.seconds > 60) awayListeners.forEach(fn => fn(r)); }
      lastTick = performance.now();
    });
  }
  bootReport = report && report.seconds > 20 ? report : null;
  return bootReport;
}

/** Called every frame by the renderer. Keeps sim time tied to the wall clock. */
export function driveSim() {
  const now = performance.now();
  let dt = (now - lastTick) / 1000;
  lastTick = now; lastWall = Date.now();
  if (dt > 2) { sim.catchUp(dt); return; }
  dt = Math.min(dt, 0.1);
  sim.advance(dt);
}

type AwayFn = (r: AwayReport) => void;
const awayListeners = new Set<AwayFn>();
export function onAway(fn: AwayFn) { awayListeners.add(fn); return () => { awayListeners.delete(fn); }; }
