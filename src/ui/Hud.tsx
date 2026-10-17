import { useEffect, useRef, useState } from 'react';
import { useHud } from './store';
import { sim } from '../sim/instance';
import { SEASONS, ITEMS, type SeasonKey } from '../sim/constants';
import { iconUrl } from './icons';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const hex = (c: number) => '#' + (c >>> 0).toString(16).padStart(6, '0');
function dur(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} day${d > 1 ? 's' : ''} ${h % 24} h`; }
  return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
}
const STATE: Record<string, string> = { harvest: 'harvesting', plant: 'planting', sell: 'selling to a shopper', wholesale: 'selling to the stall', fish: 'heading to the pond', wait: 'waiting for a buyer', idle: 'charging at the dock' };

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={String(v)} type="button" className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

function BotCard() {
  const followId = useHud(s => s.followId); const set = useHud(s => s.set); const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 300); return () => clearInterval(t); }, []);
  const b = sim.botById(followId); if (!b) return null;
  const state = b.fish ? 'fishing' : b.task ? STATE[b.task.type] : 'thinking';
  return (
    <div className="botcard" role="status">
      <span className="sw" style={{ background: hex(b.color) }} />
      <div><div className="nm">{b.name} · level {b.level}</div><div className="ds">{b.job === 'fish' ? 'Fisher' : 'Farmer'}, {state} · earned {fmt(b.earned)}</div></div>
      <div className="carry">{b.carry.map((t, i) => <img key={i} src={iconUrl(t)} alt={ITEMS[t].name} />)}</div>
      <button className="x" type="button" aria-label="Stop following" onClick={() => set({ camMode: 'cinematic', followId: 0 })}>×</button>
    </div>
  );
}

function Away() {
  const away = useHud(s => s.away); const set = useHud(s => s.set);
  useEffect(() => { if (!away) return; const t = setTimeout(() => set({ away: null }), 12000); return () => clearTimeout(t); }, [away, set]);
  if (!away) return null;
  return (
    <div className="away" role="status">
      <div className="k">While you were away · {dur(away.seconds)}</div>
      <div className="row">
        <div><b>{fmt(away.earned)}</b><span>earned</span></div>
        {away.days > 0 && <div><b>{away.days}</b><span>{away.days === 1 ? 'day passed' : 'days passed'}</span></div>}
        {away.newBots > 0 && <div><b>+{away.newBots}</b><span>new bots</span></div>}
        {away.upgrades > 0 && <div><b>{away.upgrades}</b><span>upgrades</span></div>}
      </div>
      <button className="chipbtn" type="button" onClick={() => set({ away: null })}>Back to the farm</button>
    </div>
  );
}

function DayToast() {
  const rec = useHud(s => s.dayClosed); const set = useHud(s => s.set);
  useEffect(() => { if (!rec) return; const t = setTimeout(() => set({ dayClosed: null }), 7000); return () => clearTimeout(t); }, [rec, set]);
  if (!rec) return null;
  return (
    <div className="daytoast" role="status">
      <div className="k">Day {rec.day} · {SEASONS[rec.season].name}</div>
      <div className="v">{fmt(rec.earned)} <span>earned · {rec.sold} sold · {rec.bots} bots</span></div>
    </div>
  );
}

export function Hud() {
  const h = useHud();
  const [armed, setArmed] = useState(false); const armT = useRef<number>();
  const cashRef = useRef<HTMLDivElement>(null); const lastCash = useRef(h.cash);
  useEffect(() => {
    if (h.cash > lastCash.current + 0.5 && cashRef.current) { const el = cashRef.current; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    lastCash.current = h.cash;
  }, [h.cash]);
  const S = SEASONS[h.season];
  const reset = () => {
    if (armed) { sim.reset(); setArmed(false); h.set({ camMode: 'cinematic', followId: 0 }); return; }
    setArmed(true); clearTimeout(armT.current); armT.current = window.setTimeout(() => setArmed(false), 3000);
  };
  return (
    <>
      <div className={'hud' + (h.uiHidden ? ' off' : '')}>
        <div className="scrim top" /><div className="scrim bot" />
        <div className="progress" aria-hidden="true"><i style={{ width: `${h.progress * 100}%` }} /></div>
        <header className="tl shadow">
          <div className="brand">RoboFarm · live</div>
          <div className="season">{S.name}</div>
          <div className="sub"><span>{S.sub}</span><span>Day <b className="num">{h.day}</b> · <b className="num">{h.clock}</b></span></div>
        </header>
        <div className="tr shadow">
          <div className="cash" ref={cashRef}>{fmt(h.cash)}</div>
          <div className="stats"><span className="num">{h.bots}</span> bots · <span className="num">{h.shoppers}</span> shoppers · <span className="num">{h.soldToday}</span> sold today</div>
          <div className="best">Today {fmt(h.earnedToday)} · all time {fmt(h.lifetime)}{h.best ? ` · best day ${fmt(h.best)}` : ''}</div>
        </div>
        <div className="ticker shadow" aria-live="polite">
          {h.ticker.map((t, i, a) => <div key={t.id} style={{ opacity: 0.3 + (0.7 * (i + 1)) / a.length }} dangerouslySetInnerHTML={{ __html: t.html }} />)}
        </div>
        <nav className="controls" aria-label="Simulation controls">
          <Seg<SeasonKey | 'auto'> label="Season" value={h.seasonPref} onChange={v => { sim.seasonPref = v; sim.save(); h.set({ seasonPref: v }); }}
            options={[['auto', 'Auto'], ['spring', 'Spring'], ['summer', 'Summer'], ['rainy', 'Rainy'], ['winter', 'Winter']]} />
          <Seg<number> label="Speed" value={h.speed} onChange={v => { sim.speed = v; sim.save(); h.set({ speed: v }); }} options={[[1, '1×'], [2, '2×'], [4, '4×']]} />
          <button className="chipbtn" type="button" onClick={() => h.set({ camMode: h.camMode === 'cinematic' ? 'free' : 'cinematic', followId: 0 })}>
            {h.camMode === 'cinematic' ? 'Cinematic' : h.camMode === 'follow' ? 'Following' : 'Free camera'}
          </button>
          <button className="chipbtn" type="button" title="Hide the interface (H)" onClick={() => h.set({ uiHidden: true })}>Hide UI</button>
          <button className={'chipbtn' + (armed ? ' warn' : '')} type="button" onClick={reset}>{armed ? 'Tap again to start over' : 'Start over'}</button>
        </nav>
        {h.camMode === 'follow' && <BotCard />}
        <DayToast />
      </div>
      {h.uiHidden && <button className="chipbtn showui" type="button" onClick={() => h.set({ uiHidden: false })}>Show UI</button>}
      <Away />
    </>
  );
}
