import {
  ITEMS, CROPS, CROP_TYPES, FISH, ALL_ITEMS, SEASONS, SEASON_ORDER, DAY_SECONDS, MAX_BOTS, POND, STALL, DOCK, ROAD_Z,
  BOT_COLORS, BOT_NAMES, SHOP_SPOTS, FISH_SPOTS, WISH_POOL, NESTS, LAY, OBSTACLES, isPoultry,
  type ItemKey, type CropKey, type SeasonKey, type ProduceKey,
} from './constants';

/* ------------------------------------------------------------------ types */
export type SlotState = 'empty' | 'growing' | 'ripe';
export interface Slot { idx: number; type: ProduceKey; sx?: number; sz?: number; x: number; z: number; state: SlotState; t: number; reserved: number; rot: number }
export type TaskType = 'collect' | 'harvest' | 'plant' | 'sell' | 'wholesale' | 'fish' | 'wait' | 'idle';
export interface Task {
  type: TaskType; tx: number; tz: number; lx: number; lz: number; path: { x: number; z: number }[];
  phase: 'move' | 'act'; t: number; slot?: number; cust?: number; spot?: number; dur?: number; done?: boolean; started?: boolean;
}
export interface Bot {
  id: number; name: string; color: number; level: number; xp: number; earned: number; sold: number; job: 'any' | 'fish';
  carry: ItemKey[]; x: number; z: number; yaw: number; task: Task | null; waitTime: number;
  fish: { spot: number; t: number; dur: number } | null; act: string; moving: boolean; dist: number; born: number;
}
export type Outfit = 'casual' | 'summer' | 'umbrella' | 'raincoat' | 'sweater';
export interface Customer {
  id: number; x: number; z: number; y: number; yaw: number; wish: Partial<Record<ItemKey, number>>; wallet: number; startWallet: number;
  spot: number; state: 'arrive' | 'wait' | 'leave'; path: { x: number; z: number }[]; patience: number; reservedBy: number;
  grumpy: boolean; speed: number; outfit: Outfit; seed: number; moving: boolean; walkT: number; rev: number;
}
export type SimEvent =
  | { k: 'sale'; x: number; z: number; amount: number }
  | { k: 'plant'; x: number; z: number }
  | { k: 'catch'; x: number; z: number; fx: number; fz: number; item: ItemKey; bot: number }
  | { k: 'miss'; fx: number; fz: number }
  | { k: 'level'; bot: number }
  | { k: 'newbot'; bot: number };
export interface DayRecord { day: number; season: SeasonKey; earned: number; sold: number; bots: number; koi: number }
export interface TickerLine { id: number; html: string }
export interface AwayReport { seconds: number; earned: number; newBots: number; days: number; upgrades: number }

const SAVE_KEY = 'robofarm-world-v1';
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const xpNeed = (l: number) => 3 + l * 3;
export const botSpeed = (b: Bot) => 4.4 * (1 + 0.07 * (b.level - 1));
export const botCap = (b: Bot) => Math.min(6, 2 + Math.floor((b.level - 1) / 2));
export const botScale = (b: Bot) => Math.min(1.35, 0.95 + 0.04 * (b.level - 1));
const onPier = (x: number, z: number) => Math.abs(x) < 1.1 && z > -27.8 && z < -22.6;
export const inPond = (x: number, z: number, pad = 0) => {
  const dx = (x - POND.cx) / (POND.rx + pad), dz = (z - POND.cz) / (POND.rz + pad);
  return dx * dx + dz * dz < 1 && !onPier(x, z);
};
const pondAng = (x: number, z: number) => Math.atan2((z - POND.cz) / POND.rz, (x - POND.cx) / POND.rx);

/* ------------------------------------------------------------------ sim */
export class Sim {
  clock = 0;               // game seconds since the world began (05:30 on day 1)
  speed = 1;
  seasonPref: SeasonKey | 'auto' = 'auto';
  cash = 40; lifetime = 0; bought = 0; fert = 0; ads = 0; expand = 0; tune = 0;
  today = { earned: 0, spent: 0, sold: 0, koi: 0 };
  soldToday: Record<string, number> = {};
  history: DayRecord[] = [];
  best = 0;
  bots: Bot[] = []; slots: Slot[] = []; customers: Customer[] = [];
  rows: Record<CropKey, number> = { tomato: 3, corn: 3, rice: 3, apple: 2 };
  fishReserved: number[] = FISH_SPOTS.map(() => 0);
  spotUsed: number[] = SHOP_SPOTS.map(() => 0);
  botSeq = 0; custSeq = 0; tickSeq = 0;
  events: SimEvent[] = [];
  ticker: TickerLine[] = [];
  quiet = false;           // true while fast-forwarding: no events, no ticker
  rev = 0;                 // bumps when the set of bots/customers or the field layout changes
  private spawnT = 2; private mgrT = 2; private lastDay = 1;
  daylight = 1;

  /* ---------- clock ---------- */
  get day() { return Math.floor(this.clock / DAY_SECONDS) + 1; }
  /** Hour 5.5 → 29.5 within the current day; daytime takes 80 % of the cycle. */
  get hourRaw() {
    const u = (this.clock % DAY_SECONDS) / DAY_SECONDS;
    return u < 0.8 ? 5.5 + (u / 0.8) * 15 : 20.5 + ((u - 0.8) / 0.2) * 9;
  }
  get hour() { return ((this.hourRaw % 24) + 24) % 24; }
  get dayProgress() { return (this.clock % DAY_SECONDS) / DAY_SECONDS; }
  seasonForDay(day: number): SeasonKey { return this.seasonPref === 'auto' ? SEASON_ORDER[(day - 1) % 4] : this.seasonPref; }
  get season(): SeasonKey { return this.seasonForDay(this.day); }
  static daylightAt(h: number) {
    const dayF = (h - 6) / 14;
    const elev = h >= 6 && h <= 20 ? Math.sin(dayF * Math.PI) : -Math.min(1, Math.min(Math.abs(h - 6), Math.abs(h - 20), Math.abs(h + 4)) / 3) * 0.4;
    const v = clamp((elev + 0.08) / 0.35, 0, 1);
    return v * v * (3 - 2 * v);
  }

  /* ---------- economy ---------- */
  botCost() { return Math.round(40 * Math.pow(1.32, this.bought)); }
  fertCost() { return Math.round(95 * Math.pow(1.85, this.fert)); }
  adsCost() { return Math.round(100 * Math.pow(1.85, this.ads)); }
  expCost() { return Math.round(320 * Math.pow(2.1, this.expand)); }
  tuneCost() { return Math.round(400 * Math.pow(2, this.tune)); }

  /* ---------- setup ---------- */
  constructor() { this.buildFields(); }
  private buildFields() {
    this.slots = [];
    for (const t of CROP_TYPES) {
      const d = CROPS[t]; const dir = Math.sign(d.pz);
      for (let r = 0; r < this.rows[t]; r++) for (let c = 0; c < d.cols; c++) this.addSlot(t, c, r, dir);
    }
    for (const n of NESTS) this.slots.push({ idx: this.slots.length, type: n.type, x: n.x, z: n.z, sx: n.sx, sz: n.sz, state: 'growing', t: Math.random() * 0.9, reserved: 0, rot: Math.random() * Math.PI * 2 });
  }
  /** Seconds a slot takes to become ready. */
  growTime(t: ProduceKey) { return isPoultry(t) ? LAY[t] : CROPS[t].grow; }
  slotPos(t: CropKey, c: number, r: number) {
    const d = CROPS[t]; const dir = Math.sign(d.pz);
    return { x: d.px + (c - (d.cols - 1) / 2) * d.sp, z: d.pz - dir * d.sp + dir * r * d.sp };
  }
  private addSlot(t: CropKey, c: number, r: number, _dir?: number) {
    const p = this.slotPos(t, c, r);
    const s: Slot = { idx: this.slots.length, type: t, x: p.x, z: p.z, state: 'empty', t: 0, reserved: 0, rot: Math.random() * Math.PI * 2 };
    this.slots.push(s); return s;
  }
  slotsOf(t: ProduceKey) { return this.slots.filter(s => s.type === t); }

  freshWorld() {
    Object.assign(this, { clock: 0, cash: 40, lifetime: 0, bought: 0, fert: 0, ads: 0, expand: 0, tune: 0, botSeq: 0, custSeq: 0 });
    this.today = { earned: 0, spent: 0, sold: 0, koi: 0 }; this.soldToday = {}; this.history = [];
    this.rows = { tomato: 3, corn: 3, rice: 3, apple: 2 };
    this.bots = []; this.customers = []; this.fishReserved = FISH_SPOTS.map(() => 0); this.spotUsed = SHOP_SPOTS.map(() => 0);
    this.buildFields();
    for (const s of this.slots) { const r = Math.random(); if (r < 0.3) { s.state = 'ripe'; s.t = 1; } else if (r < 0.85 || isPoultry(s.type)) { s.state = 'growing'; s.t = rand(0.1, 0.85); } }
    for (let i = 0; i < 3; i++) this.addBot(0);
    for (let i = 0; i < 4; i++) this.spawnCustomer(true);
    this.lastDay = 1; this.rev++;
    this.tick(`A new farm opens. ${SEASONS[this.season].name}: ${SEASONS[this.season].sub.toLowerCase()}`);
  }

  /* ---------- ticker & events ---------- */
  tick(html: string) {
    if (this.quiet) return;
    this.ticker.push({ id: ++this.tickSeq, html });
    if (this.ticker.length > 6) this.ticker.shift();
  }
  private emit(e: SimEvent) { if (!this.quiet) this.events.push(e); }
  private earn(n: number) { this.cash += n; this.lifetime += n; this.today.earned += n; }
  private spend(n: number) { this.cash -= n; this.today.spent += n; }

  /* ---------- bots ---------- */
  private addBot(paid: number) {
    const fishers = this.bots.filter(b => b.job === 'fish').length;
    const job: 'any' | 'fish' = fishers < Math.floor((this.bots.length + 1) / 4) ? 'fish' : 'any';
    const used = new Set(this.bots.map(b => b.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || `Unit ${this.bots.length + 1}`;
    const b: Bot = {
      id: ++this.botSeq, name, color: BOT_COLORS[(this.botSeq - 1) % BOT_COLORS.length], level: 1, xp: 0, earned: 0, sold: 0, job, carry: [],
      x: DOCK.x + rand(-1.2, 1.2), z: DOCK.z + rand(-1.2, 1.2), yaw: Math.PI, task: null, waitTime: 0, fish: null, act: '', moving: false, dist: 0, born: this.clock,
    };
    this.bots.push(b); this.rev++;
    if (paid) this.tick(`Manager added a new bot, ${b.name} <span class="neg">−$${paid}</span>`);
    this.emit({ k: 'newbot', bot: b.id });
    return b;
  }
  botById(id: number) { return this.bots.find(b => b.id === id); }
  custById(id: number) { return this.customers.find(c => c.id === id); }

  private route(ax: number, az: number, bx: number, bz: number) {
    const out: { x: number; z: number }[] = []; let px = ax, pz = az;
    for (const p of this.routeStall(ax, az, bx, bz)) { out.push(...this.routePond(px, pz, p.x, p.z)); px = p.x; pz = p.z; }
    return out;
  }
  private routeStall(ax: number, az: number, bx: number, bz: number) {
    let hit = false;
    for (let i = 1; i < 24 && !hit; i++) { const t = i / 24, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (x > STALL.x0 && x < STALL.x1 && z > STALL.z0 && z < STALL.z1) hit = true; }
    if (!hit) return [{ x: bx, z: bz }];
    const X = (ax + bx >= 0 ? 1 : -1) * 7.4; const down = az < bz;
    return [{ x: X, z: down ? STALL.z0 - 1 : STALL.z1 + 1 }, { x: X, z: down ? STALL.z1 + 1 : STALL.z0 - 1 }, { x: bx, z: bz }];
  }
  private routePond(ax: number, az: number, bx: number, bz: number) {
    let hit = false;
    for (let i = 1; i < 30 && !hit; i++) { const t = i / 30; if (inPond(ax + (bx - ax) * t, az + (bz - az) * t, 0.3)) hit = true; }
    if (!hit) return [{ x: bx, z: bz }];
    const a0 = pondAng(ax, az), a1 = pondAng(bx, bz); const d = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.5)); const out: { x: number; z: number }[] = [];
    for (let i = 1; i < n; i++) { const a = a0 + (d * i) / n; out.push({ x: POND.cx + Math.cos(a) * (POND.rx + 1.6), z: POND.cz + Math.sin(a) * (POND.rz + 1.6) }); }
    out.push({ x: bx, z: bz }); return out;
  }
  private setTask(b: Bot, t: Omit<Task, 'phase' | 't' | 'path'>) { const task: Task = { ...t, phase: 'move', t: 0, path: this.route(b.x, b.z, t.tx, t.tz) }; b.task = task; return task; }
  private releaseTask(b: Bot) {
    const t = b.task; if (!t) return;
    if (t.slot != null && this.slots[t.slot]?.reserved === b.id) this.slots[t.slot].reserved = 0;
    if (t.cust != null) { const c = this.custById(t.cust); if (c && c.reservedBy === b.id) c.reservedBy = 0; }
    if (t.spot != null && this.fishReserved[t.spot] === b.id && !b.fish) this.fishReserved[t.spot] = 0;
    b.task = null;
  }
  private canSellTo(b: Bot, c: Customer) {
    if (c.state !== 'wait') return false;
    for (const it of b.carry) if ((c.wish[it] || 0) > 0 && c.wallet >= ITEMS[it].price) return true;
    return false;
  }
  private findCustomer(b: Bot) {
    let best: Customer | null = null, bd = 1e9;
    for (const c of this.customers) { if (c.reservedBy && c.reservedBy !== b.id) continue; if (!this.canSellTo(b, c)) continue; const d = Math.hypot(c.x - b.x, c.z - b.z); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  private nearestSlot(b: Bot, state: SlotState) {
    let best: Slot | null = null, bd = 1e9;
    for (const s of this.slots) { if (s.state !== state || s.reserved) continue; const d = Math.hypot(s.x - b.x, s.z - b.z) + Math.random() * 6 - (isPoultry(s.type) ? 14 : 0); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  private freeSpot(b: Bot) {
    let best = -1, bd = 1e9;
    FISH_SPOTS.forEach((s, i) => { if (this.fishReserved[i]) return; const d = Math.hypot(s.x - b.x, s.z - b.z) + Math.random() * 5; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  private standNear(b: Bot, x: number, z: number, r: number) { const dx = b.x - x, dz = b.z - z; const d = Math.hypot(dx, dz) || 1; return { x: x + (dx / d) * r, z: z + (dz / d) * r }; }
  private chooseTask(b: Bot) {
    const cap = botCap(b), full = b.carry.length >= cap, farm = b.job !== 'fish', fish = true;
    if (b.carry.length && (b.waitTime > 18 || (b.carry.includes('koi') && !this.findCustomer(b)))) { const x = clamp(b.x, -4, 4); return this.setTask(b, { type: 'wholesale', tx: x, tz: 3.4, lx: x, lz: 0 }); }
    if (full) { const c = this.findCustomer(b); if (c) return this.sellTask(b, c); }
    if (!full && farm) { const s = this.nearestSlot(b, 'ripe'); if (s) return this.slotTask(b, s, 'harvest'); }
    if (!full && b.job === 'fish') { const s = this.freeSpot(b); if (s >= 0) return this.fishTask(b, s); }
    if (b.carry.length) { const c = this.findCustomer(b); if (c) return this.sellTask(b, c); }
    if (farm) { const e = this.nearestSlot(b, 'empty'); if (e) return this.slotTask(b, e, 'plant'); }
    if (!full && fish) { const s = this.freeSpot(b); if (s >= 0) return this.fishTask(b, s); }
    if (b.carry.length) return this.setTask(b, { type: 'wait', tx: rand(-4.2, 4.2), tz: 3.5, lx: 0, lz: 10 });
    const a = Math.random() * Math.PI * 2;
    return this.setTask(b, { type: 'idle', tx: DOCK.x + Math.cos(a) * 1.6, tz: DOCK.z + Math.sin(a) * 1.6, lx: 0, lz: -6, dur: rand(1.2, 2.5) });
  }
  private slotTask(b: Bot, s: Slot, type: 'harvest' | 'plant') {
    s.reserved = b.id;
    if (s.sx != null) return this.setTask(b, { type: 'collect', slot: s.idx, tx: s.sx, tz: s.sz!, lx: s.x, lz: s.z });
    const st = this.standNear(b, s.x, s.z, s.type === 'apple' ? 1.7 : 1.05); return this.setTask(b, { type, slot: s.idx, tx: st.x, tz: st.z, lx: s.x, lz: s.z });
  }
  private sellTask(b: Bot, c: Customer) { c.reservedBy = b.id; const st = this.standNear(b, c.x, c.z, 1.2); return this.setTask(b, { type: 'sell', cust: c.id, tx: st.x, tz: st.z, lx: c.x, lz: c.z }); }
  private fishTask(b: Bot, i: number) { this.fishReserved[i] = b.id; const s = FISH_SPOTS[i]; return this.setTask(b, { type: 'fish', spot: i, tx: s.x, tz: s.z, lx: s.lx, lz: s.lz }); }
  private taskValid(b: Bot, t: Task) {
    if (t.type === 'harvest' || t.type === 'collect') { const s = this.slots[t.slot!]; return !!s && s.state === 'ripe' && s.reserved === b.id && b.carry.length < botCap(b); }
    if (t.type === 'plant') { const s = this.slots[t.slot!]; return !!s && s.state === 'empty' && s.reserved === b.id; }
    if (t.type === 'sell') { const c = this.custById(t.cust!); return !!c && c.state === 'wait' && c.reservedBy === b.id; }
    if (t.type === 'fish') return this.fishReserved[t.spot!] === b.id;
    return true;
  }
  private turnTo(b: Bot, tx: number, tz: number, dt: number, rate = 10) { const want = Math.atan2(tx - b.x, tz - b.z); const d = Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw)); b.yaw += d * Math.min(1, dt * rate); }
  private stepPath(b: Bot, path: { x: number; z: number }[], dt: number) {
    if (!path.length) return true; const w = path[0]; const dx = w.x - b.x, dz = w.z - b.z, d = Math.hypot(dx, dz); const step = botSpeed(b) * (1 + 0.06 * this.tune) * dt;
    if (d <= Math.max(step, 0.12)) { b.x = w.x; b.z = w.z; path.shift(); b.dist += d; return !path.length; }
    b.x += (dx / d) * step; b.z += (dz / d) * step; b.dist += step; this.turnTo(b, w.x, w.z, dt, 8); return false;
  }
  private gainXp(b: Bot, n: number) {
    b.xp += n;
    while (b.xp >= xpNeed(b.level)) { b.xp -= xpNeed(b.level); b.level++; this.tick(`${b.name} upgraded to level ${b.level}`); this.emit({ k: 'level', bot: b.id }); }
  }
  private doSale(b: Bot, c: Customer) {
    let total = 0, n = 0; const sold: Record<string, number> = {};
    for (let i = b.carry.length - 1; i >= 0; i--) {
      const it = b.carry[i]; const pr = ITEMS[it].price;
      if ((c.wish[it] || 0) > 0 && c.wallet >= pr) { c.wish[it]!--; c.wallet -= pr; total += pr; n++; sold[it] = (sold[it] || 0) + 1; b.carry.splice(i, 1); this.soldToday[it] = (this.soldToday[it] || 0) + 1; }
    }
    if (!n) return;
    c.rev++; b.earned += total; b.sold += n; this.earn(total); this.today.sold += n; b.waitTime = 0;
    const txt = Object.keys(sold).map(k => `${sold[k]} ${sold[k] > 1 ? ITEMS[k as ItemKey].plural : ITEMS[k as ItemKey].name.toLowerCase()}`).join(', ');
    this.tick(`${b.name} sold ${txt} <em>+$${total}</em>`);
    this.emit({ k: 'sale', x: c.x, z: c.z, amount: total });
    this.gainXp(b, n);
  }
  private wholesale(b: Bot) {
    let total = 0;
    for (const it of b.carry) { total += ITEMS[it].price * (it === 'koi' ? 1 : ITEMS[it].kind === 'fish' ? 0.7 : 0.5); this.soldToday[it] = (this.soldToday[it] || 0) + 1; }
    total = Math.round(total); const n = b.carry.length; b.carry = []; b.waitTime = 0;
    this.earn(total); this.today.sold += n; b.earned += total; b.sold += n;
    this.tick(`${b.name} sold extra stock to the stall <em>+$${total}</em>`);
    this.gainXp(b, Math.ceil(n / 2));
  }
  private bobber(b: Bot) { const s = b.fish ? FISH_SPOTS[b.fish.spot] : null; const d = s?.pier ? 3.4 : 3.0; return { x: b.x + Math.sin(b.yaw) * d, z: b.z + Math.cos(b.yaw) * d }; }
  private startFishing(b: Bot, i: number) {
    if (b.fish || b.carry.length >= botCap(b)) return false;
    const E = SEASONS[this.season];
    this.fishReserved[i] = b.id; b.fish = { spot: i, t: 0, dur: rand(3.5, 7.5) / (1 + 0.5 * E.rain) * (1 + 0.4 * E.frozen) }; return true;
  }
  private cancelFish(b: Bot) { if (!b.fish) return; if (this.fishReserved[b.fish.spot] === b.id) this.fishReserved[b.fish.spot] = 0; b.fish = null; }
  private updateFishing(b: Bot, dt: number) {
    const f = b.fish!; f.t += dt; const s = FISH_SPOTS[f.spot]; this.turnTo(b, s.lx, s.lz, dt, 6);
    if (f.t < f.dur) return;
    const bp = this.bobber(b); this.cancelFish(b);
    if (Math.random() < 0.15) { this.emit({ k: 'miss', fx: bp.x, fz: bp.z }); return; }
    let r = Math.random(); let type: ItemKey = 'catfish';
    for (const k of FISH) { r -= ITEMS[k].odds!; if (r <= 0) { type = k; break; } }
    if (b.carry.length < botCap(b)) b.carry.push(type);
    this.emit({ k: 'catch', x: b.x, z: b.z, fx: bp.x, fz: bp.z, item: type, bot: b.id });
    if (type === 'koi') { this.today.koi++; this.tick(`${b.name} landed a golden koi`); }
  }
  private pushOut(b: { x: number; z: number }) {
    if (b.x > STALL.x0 + 0.4 && b.x < STALL.x1 - 0.4 && b.z > STALL.z0 + 0.4 && b.z < STALL.z1 - 0.4) {
      const dl = b.x - STALL.x0, dr = STALL.x1 - b.x, db = b.z - STALL.z0, df = STALL.z1 - b.z; const m = Math.min(dl, dr, db, df);
      if (m === dl) b.x = STALL.x0 + 0.4; else if (m === dr) b.x = STALL.x1 - 0.4; else if (m === db) b.z = STALL.z0 + 0.4; else b.z = STALL.z1 - 0.4;
    }
    for (const o of OBSTACLES) if (b.x > o.x0 && b.x < o.x1 && b.z > o.z0 && b.z < o.z1) {
      const dl = b.x - o.x0, dr = o.x1 - b.x, db = b.z - o.z0, df = o.z1 - b.z; const m = Math.min(dl, dr, db, df);
      if (m === dl) b.x = o.x0; else if (m === dr) b.x = o.x1; else if (m === db) b.z = o.z0; else b.z = o.z1;
    }
    if (inPond(b.x, b.z, 0.2)) { const a = pondAng(b.x, b.z); b.x = POND.cx + Math.cos(a) * (POND.rx + 0.25); b.z = POND.cz + Math.sin(a) * (POND.rz + 0.25); }
  }
  private updateBot(b: Bot, dt: number) {
    let moving = false; let acting = '';
    if (!b.task) this.chooseTask(b);
    const t = b.task!;
    if (t.type === 'wait') b.waitTime += dt;
    if (!this.taskValid(b, t)) this.releaseTask(b);
    else if (t.phase === 'move') { const arrived = this.stepPath(b, t.path, dt); moving = !arrived; if (arrived) { t.phase = 'act'; t.t = 0; } }
    else {
      t.t += dt; if (t.type !== 'fish') this.turnTo(b, t.lx, t.lz, dt, 8); acting = t.type;
      if (t.type === 'harvest' && t.t >= 0.9) { const s = this.slots[t.slot!]; s.state = 'empty'; s.t = 0; s.reserved = 0; b.carry.push(s.type); this.releaseTask(b); }
      else if (t.type === 'collect' && t.t >= 1.3) { const s = this.slots[t.slot!]; s.state = 'growing'; s.t = 0; s.reserved = 0; b.carry.push(s.type); this.releaseTask(b); }
      else if (t.type === 'plant' && t.t >= 1.1) { const s = this.slots[t.slot!]; s.state = 'growing'; s.t = 0.02; s.reserved = 0; this.emit({ k: 'plant', x: s.x, z: s.z }); this.releaseTask(b); }
      else if (t.type === 'sell') { if (!t.done && t.t >= 0.45) { t.done = true; const c = this.custById(t.cust!); if (c) this.doSale(b, c); } if (t.t >= 0.9) this.releaseTask(b); }
      else if (t.type === 'wholesale') { if (!t.done && t.t >= 0.5) { t.done = true; this.wholesale(b); } if (t.t >= 0.9) this.releaseTask(b); }
      else if (t.type === 'fish') { acting = ''; if (!t.started) { t.started = true; if (!this.startFishing(b, t.spot!)) this.releaseTask(b); } else if (!b.fish) this.releaseTask(b); }
      else if (t.type === 'wait' && t.t >= 1.2) this.releaseTask(b);
      else if (t.type === 'idle' && t.t >= (t.dur || 2)) this.releaseTask(b);
    }
    if (b.fish) { this.updateFishing(b, dt); if (b.fish) acting = 'fish'; }
    b.moving = moving; b.act = acting;
  }
  private separate() {
    const B = this.bots;
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      for (let j = i + 1; j < B.length; j++) { const c = B[j]; const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz); if (d < 1.2 && d > 1e-4) { const k = ((1.2 - d) * 0.25) / d; a.x -= dx * k; a.z -= dz * k; c.x += dx * k; c.z += dz * k; } }
      for (const cu of this.customers) { const dx = a.x - cu.x, dz = a.z - cu.z, d = Math.hypot(dx, dz); if (d < 0.9 && d > 1e-4) { const k = ((0.9 - d) * 0.5) / d; a.x += dx * k; a.z += dz * k; } }
      this.pushOut(a);
    }
  }

  /* ---------- customers ---------- */
  private spawnCustomer(atSpot: boolean) {
    const free = this.spotUsed.map((u, i) => (u ? -1 : i)).filter(i => i >= 0); if (!free.length) return;
    const spot = pick(free); const id = ++this.custSeq; const season = this.season;
    const wish: Partial<Record<ItemKey, number>> = {}; let cost = 0;
    const nk = Math.random() < 0.55 ? 1 : Math.random() < 0.8 ? 2 : 3; const pool = WISH_POOL.slice();
    for (let i = 0; i < nk && pool.length; i++) {
      const tot = pool.reduce((s, p) => s + p[1], 0); let r = Math.random() * tot, j = 0;
      for (; j < pool.length; j++) { r -= pool[j][1]; if (r <= 0) break; }
      j = Math.min(j, pool.length - 1); const k = pool.splice(j, 1)[0][0];
      const n = 1 + Math.floor(Math.random() * (k === 'rice' || k === 'salmon' ? 2 : 3)); wish[k] = n; cost += n * ITEMS[k].price;
    }
    const wallet = Math.max(6, Math.round(cost * rand(1.0, 1.5)));
    const outfit: Outfit = season === 'winter' ? 'sweater' : season === 'rainy' ? (Math.random() < 0.72 ? 'umbrella' : 'raincoat') : season === 'summer' ? 'summer' : 'casual';
    const sp = SHOP_SPOTS[spot]; const sx = rand(-1.3, 1.3);
    const c: Customer = {
      id, x: atSpot ? sp.x : sx, z: atSpot ? sp.z : ROAD_Z, y: 0, yaw: Math.PI, wish, wallet, startWallet: wallet, spot, state: atSpot ? 'wait' : 'arrive',
      path: atSpot ? [] : [{ x: sx * 0.6, z: 15.5 }, { x: sp.x, z: sp.z }], patience: rand(45, 62), reservedBy: 0, grumpy: false, speed: rand(1.25, 1.6),
      outfit, seed: id * 9301 + 49297, moving: false, walkT: Math.random() * 10, rev: 0,
    };
    this.spotUsed[spot] = id; this.customers.push(c); this.rev++;
  }
  private leave(c: Customer, happy: boolean) {
    c.state = 'leave'; if (c.spot >= 0 && this.spotUsed[c.spot] === c.id) this.spotUsed[c.spot] = 0; c.spot = -1;
    if (c.reservedBy) { const b = this.botById(c.reservedBy); if (b?.task?.cust === c.id) this.releaseTask(b); c.reservedBy = 0; }
    const ex = rand(-1.3, 1.3); c.path = [{ x: ex * 0.6, z: 15.5 }, { x: ex, z: ROAD_Z + 2 }];
    if (!happy) { c.grumpy = true; c.rev++; }
  }
  private updateCustomer(c: Customer, dt: number) {
    let moving = false;
    if (c.path.length) {
      const w = c.path[0]; const dx = w.x - c.x, dz = w.z - c.z, d = Math.hypot(dx, dz), st = c.speed * dt;
      if (d <= st) { c.x = w.x; c.z = w.z; c.path.shift(); }
      else { c.x += (dx / d) * st; c.z += (dz / d) * st; const want = Math.atan2(dx, dz); c.yaw += Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)) * Math.min(1, dt * 8); }
      moving = true;
    } else if (c.state === 'arrive') c.state = 'wait';
    if (c.state === 'wait') {
      const want = Math.atan2(-c.x * 0.3, -c.z); c.yaw += Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)) * Math.min(1, dt * 4);
      if (!c.reservedBy) c.patience -= dt;
      const rem = (Object.keys(c.wish) as ItemKey[]).filter(k => (c.wish[k] || 0) > 0);
      if (!rem.length) this.leave(c, true);
      else if (c.wallet < Math.min(...rem.map(k => ITEMS[k].price))) this.leave(c, c.wallet < c.startWallet);
      else if (c.patience <= 0) this.leave(c, false);
      else if (c.patience < 12 && !c.grumpy) { c.grumpy = true; c.rev++; }
    }
    c.moving = moving; if (moving) c.walkT += dt;
    if (c.state === 'leave' && !c.path.length) { this.customers.splice(this.customers.indexOf(c), 1); this.rev++; }
  }
  private spawnLogic(dt: number) {
    this.spawnT -= dt; if (this.spawnT > 0) return;
    const S = SEASONS[this.season];
    const maxC = Math.min(SHOP_SPOTS.length, 4 + Math.round(this.bots.length * 1.6) + this.ads * 2);
    const waiting = this.customers.filter(c => c.state !== 'leave').length;
    const interval = 3.1 / (1 + 0.3 * this.ads) / (0.18 + 0.82 * this.daylight) / (1 + this.bots.length * 0.05) / S.cust;
    this.spawnT = interval * rand(0.7, 1.3);
    if (waiting < maxC && this.customers.length < SHOP_SPOTS.length + 5) this.spawnCustomer(false);
  }

  /* ---------- manager ---------- */
  private manager() {
    const bc = this.botCost();
    if (this.bots.length < MAX_BOTS && this.cash >= bc && (this.bots.length < 6 || this.cash >= bc * 1.15)) { this.spend(bc); this.bought++; this.addBot(bc); return true; }
    if (this.fert < 5 && this.bots.length >= 4 && this.cash >= this.fertCost() * 1.25) { const c = this.fertCost(); this.spend(c); this.fert++; this.tick(`Manager bought fertilizer, level ${this.fert} <span class="neg">−$${c}</span>`); return true; }
    if (this.ads < 5 && this.bots.length >= 5 && this.cash >= this.adsCost() * 1.25) { const c = this.adsCost(); this.spend(c); this.ads++; this.tick(`Manager put up a billboard, level ${this.ads} <span class="neg">−$${c}</span>`); return true; }
    if (this.expand < 2 && this.bots.length >= 8 && this.cash >= this.expCost() * 1.2) { const c = this.expCost(); this.spend(c); this.expand++; this.expandFields(); this.tick(`Manager expanded the fields to ${this.slots.length} plots <span class="neg">−$${c}</span>`); return true; }
    if (this.tune < 5 && this.bots.length >= MAX_BOTS && this.cash >= this.tuneCost() * 1.3) { const c = this.tuneCost(); this.spend(c); this.tune++; this.tick(`Manager tuned every motor, level ${this.tune} <span class="neg">−$${c}</span>`); return true; }
    return false;
  }
  private expandFields() {
    for (const t of CROP_TYPES) {
      if (this.rows[t] >= CROPS[t].maxRows) continue;
      const r = this.rows[t]; this.rows[t]++;
      for (let c = 0; c < CROPS[t].cols; c++) { const s = this.addSlot(t, c, r); s.state = 'growing'; s.t = 0.05; }
    }
    this.rev++;
  }

  /* ---------- day rollover ---------- */
  private rollDay() {
    const prev = this.day - 1; const season = this.seasonForDay(prev);
    const rec: DayRecord = { day: prev, season, earned: Math.round(this.today.earned), sold: this.today.sold, bots: this.bots.length, koi: this.today.koi };
    this.history.push(rec); if (this.history.length > 60) this.history.shift();
    if (rec.earned > this.best) this.best = rec.earned;
    this.today = { earned: 0, spent: 0, sold: 0, koi: 0 }; this.soldToday = {};
    this.tick(`Day ${prev} closed with <em>$${rec.earned.toLocaleString('en-US')}</em>. Day ${this.day} is ${SEASONS[this.season].name.toLowerCase()}`);
    this.dayClosed = rec;
  }
  dayClosed: DayRecord | null = null;

  /* ---------- main step ---------- */
  step(dt: number) {
    this.clock += dt;
    this.daylight = Sim.daylightAt(this.hour);
    if (this.day !== this.lastDay) { this.lastDay = this.day; this.rollDay(); }
    this.mgrT -= dt; if (this.mgrT <= 0) { this.mgrT = 1.5; this.manager(); }
    this.spawnLogic(dt);
    const gm = (1 + 0.2 * this.fert) * SEASONS[this.season].grow;
    const lay = (0.15 + 0.85 * this.daylight) * (this.season === 'winter' ? 0.6 : this.season === 'summer' ? 0.9 : 1);
    for (const s of this.slots) if (s.state === 'growing') { s.t += (dt * (isPoultry(s.type) ? lay : gm)) / this.growTime(s.type); if (s.t >= 1) { s.t = 1; s.state = 'ripe'; } }
    for (const b of this.bots) this.updateBot(b, dt);
    this.separate();
    for (let i = this.customers.length - 1; i >= 0; i--) this.updateCustomer(this.customers[i], dt);
  }
  /** Advance by real seconds, in safe sub-steps. */
  advance(realDt: number) {
    let dt = realDt * this.speed;
    while (dt > 1e-6) { const s = Math.min(dt, 0.05); this.step(s); dt -= s; }
  }

  /* ---------- offline catch-up ---------- */
  catchUp(seconds: number): AwayReport | null {
    if (seconds < 2) return null;
    const startCash = this.lifetime, startBots = this.bots.length, startDay = this.day;
    const startUp = this.fert + this.ads + this.expand + this.tune;
    this.quiet = true;
    // Detailed simulation for the first 20 game-minutes, coarse after that.
    const detailed = Math.min(seconds, 1200);
    const t0 = this.lifetime; const c0 = this.clock;
    let left = detailed; while (left > 0) { const s = Math.min(left, 0.2); this.step(s); left -= s; }
    let rest = seconds - detailed;
    if (rest > 0) {
      const measured = (this.lifetime - t0) / Math.max(1, this.clock - c0);
      let perBot = Math.max(0.12, measured / Math.max(1, this.bots.length));
      while (rest > 0) {
        const chunk = Math.min(rest, 60); rest -= chunk;
        const dl = Sim.daylightAt(this.hour); const S = SEASONS[this.season];
        const rate = perBot * this.bots.length * (0.35 + 0.65 * dl) * (0.8 + 0.2 * S.cust) * (1 + 0.06 * this.ads);
        const gained = rate * chunk; this.earn(gained); this.today.sold += Math.round(gained / 6);
        this.clock += chunk; this.daylight = Sim.daylightAt(this.hour);
        if (this.day !== this.lastDay) { this.lastDay = this.day; this.rollDay(); }
        const nb = this.bots.length; while (this.manager()) { /* buy everything affordable */ }
        if (this.bots.length > nb) perBot *= 0.98;
        for (const b of this.bots) { const xpGain = chunk / 40; this.gainXp(b, xpGain); b.earned += gained / this.bots.length; }
      }
      // Fields and pond look lived-in after a long absence
      for (const s of this.slots) { s.reserved = 0; const r = Math.random(); if (r < 0.35) { s.state = 'ripe'; s.t = 1; } else if (r < 0.9 || isPoultry(s.type)) { s.state = 'growing'; s.t = rand(0.15, 0.95); } else { s.state = 'empty'; s.t = 0; } }
      for (const b of this.bots) { b.task = null; b.fish = null; b.carry = b.carry.slice(0, botCap(b)); }
      this.fishReserved = FISH_SPOTS.map(() => 0);
      for (const c of this.customers.slice()) { if (c.spot >= 0) this.spotUsed[c.spot] = 0; }
      this.customers = []; this.spotUsed = SHOP_SPOTS.map(() => 0);
      for (let i = 0; i < 5; i++) this.spawnCustomer(true);
      // settle positions with a short detailed run
      let s2 = 30; while (s2 > 0) { this.step(0.2); s2 -= 0.2; }
    }
    this.quiet = false; this.events.length = 0; this.rev++;
    return { seconds, earned: Math.round(this.lifetime - startCash), newBots: this.bots.length - startBots, days: this.day - startDay, upgrades: this.fert + this.ads + this.expand + this.tune - startUp };
  }

  /* ---------- persistence ---------- */
  save() {
    const data = {
      v: 1, savedAt: Date.now(), clock: this.clock, speed: this.speed, seasonPref: this.seasonPref,
      cash: this.cash, lifetime: this.lifetime, bought: this.bought, fert: this.fert, ads: this.ads, expand: this.expand, tune: this.tune,
      today: this.today, soldToday: this.soldToday, history: this.history, best: this.best, rows: this.rows, botSeq: this.botSeq, custSeq: this.custSeq, lastDay: this.lastDay,
      slots2: this.slots.map(s => [`${s.type}:${s.x.toFixed(1)}:${s.z.toFixed(1)}`, s.state === 'empty' ? 0 : s.state === 'growing' ? 1 : 2, Math.round(s.t * 1000) / 1000, Math.round(s.rot * 100) / 100]),
      bots: this.bots.map(b => ({ id: b.id, name: b.name, color: b.color, level: b.level, xp: b.xp, earned: Math.round(b.earned), sold: b.sold, job: b.job, carry: b.carry, x: b.x, z: b.z, yaw: b.yaw, born: b.born })),
      customers: this.customers.filter(c => c.state !== 'leave').map(c => ({ id: c.id, x: c.x, z: c.z, yaw: c.yaw, wish: c.wish, wallet: c.wallet, startWallet: c.startWallet, spot: c.spot, state: c.state, path: c.path, patience: c.patience, speed: c.speed, outfit: c.outfit, seed: c.seed })),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage unavailable: the farm still runs */ }
  }
  /** Loads the saved world. Returns seconds elapsed since it was saved, or -1 when there is no save. */
  load(): number {
    let d: any = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { d = null; }
    if (!d || d.v !== 1) return -1;
    try {
      Object.assign(this, {
        clock: d.clock || 0, speed: [1, 2, 4].includes(d.speed) ? d.speed : 1, seasonPref: d.seasonPref || 'auto', cash: d.cash, lifetime: d.lifetime || 0,
        bought: d.bought | 0, fert: d.fert | 0, ads: d.ads | 0, expand: d.expand | 0, tune: d.tune | 0, history: d.history || [], best: d.best || 0,
        botSeq: d.botSeq | 0, custSeq: d.custSeq | 0, lastDay: d.lastDay || 1,
      });
      this.today = d.today || { earned: 0, spent: 0, sold: 0, koi: 0 }; this.soldToday = d.soldToday || {};
      this.rows = d.rows || this.rows; this.buildFields();
      const st = (n: number): SlotState => (n === 0 ? 'empty' : n === 1 ? 'growing' : 'ripe');
      if (d.slots2) {
        const byKey = new Map(this.slots.map(s => [`${s.type}:${s.x.toFixed(1)}:${s.z.toFixed(1)}`, s]));
        for (const v of d.slots2 as [string, number, number, number][]) { const s = byKey.get(v[0]); if (!s) continue; s.state = isPoultry(s.type) && v[1] === 0 ? 'growing' : st(v[1]); s.t = v[2]; s.rot = v[3]; }
      } else (d.slots || []).forEach((v: number[], i: number) => { const s = this.slots[i]; if (!s || isPoultry(s.type)) return; s.state = st(v[0]); s.t = v[1]; s.rot = v[2]; });
      this.bots = (d.bots || []).map((b: any) => ({ ...b, task: null, waitTime: 0, fish: null, act: '', moving: false, dist: 0 }));
      this.spotUsed = SHOP_SPOTS.map(() => 0); this.fishReserved = FISH_SPOTS.map(() => 0);
      this.customers = (d.customers || []).map((c: any) => ({ ...c, y: 0, reservedBy: 0, grumpy: false, moving: false, walkT: 0, rev: 0 }));
      for (const c of this.customers) if (c.spot >= 0 && c.spot < SHOP_SPOTS.length) { if (this.spotUsed[c.spot]) c.spot = -1; else this.spotUsed[c.spot] = c.id; }
      this.customers = this.customers.filter(c => c.spot >= 0 || c.state === 'leave');
      if (!this.bots.length) for (let i = 0; i < 3; i++) this.addBot(0);
      this.daylight = Sim.daylightAt(this.hour); this.rev++;
      return Math.max(0, (Date.now() - (d.savedAt || Date.now())) / 1000);
    } catch { return -1; }
  }
  reset() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } this.freshWorld(); this.save(); }
}
