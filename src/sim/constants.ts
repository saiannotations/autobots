export type CropKey = 'tomato' | 'corn' | 'rice' | 'apple';
export type FishKey = 'catfish' | 'trout' | 'salmon' | 'koi';
export type PoultryKey = 'eggs' | 'duckEggs';
export type ProduceKey = CropKey | PoultryKey;
export type ItemKey = CropKey | FishKey | PoultryKey;
export type SeasonKey = 'spring' | 'summer' | 'rainy' | 'winter';

export interface ItemDef {
  name: string;
  plural: string;
  price: number;
  kind: 'crop' | 'fish' | 'poultry';
  color?: number;
  odds?: number;
}

export const ITEMS: Record<ItemKey, ItemDef> = {
  tomato: { name: 'Tomato', plural: 'tomatoes', price: 4, kind: 'crop' },
  corn: { name: 'Corn', plural: 'corn', price: 3, kind: 'crop' },
  rice: { name: 'Rice Bag', plural: 'rice bags', price: 12, kind: 'crop' },
  apple: { name: 'Apple', plural: 'apples', price: 5, kind: 'crop' },
  catfish: { name: 'Catfish', plural: 'catfish', price: 6, kind: 'fish', color: 0x7c7a5c, odds: 0.4 },
  trout: { name: 'Trout', plural: 'trout', price: 8, kind: 'fish', color: 0x8aa6b5, odds: 0.33 },
  salmon: { name: 'Salmon', plural: 'salmon', price: 14, kind: 'fish', color: 0xd98764, odds: 0.21 },
  koi: { name: 'Golden Koi', plural: 'golden koi', price: 40, kind: 'fish', color: 0xe8a93a, odds: 0.06 },
  eggs: { name: 'Egg Carton', plural: 'egg cartons', price: 6, kind: 'poultry', color: 0xf1e6d2 },
  duckEggs: { name: 'Duck Eggs', plural: 'duck egg cartons', price: 9, kind: 'poultry', color: 0xcfe3dc },
};

export interface CropDef { grow: number; px: number; pz: number; cols: number; rows: number; sp: number; maxRows: number }
export const CROPS: Record<CropKey, CropDef> = {
  tomato: { grow: 9, px: -22, pz: -18, cols: 4, rows: 3, sp: 2.6, maxRows: 5 },
  corn: { grow: 11, px: 22, pz: -18, cols: 4, rows: 3, sp: 2.6, maxRows: 5 },
  rice: { grow: 20, px: -22, pz: 18, cols: 4, rows: 3, sp: 2.6, maxRows: 5 },
  apple: { grow: 14, px: 22, pz: 18, cols: 3, rows: 2, sp: 4.2, maxRows: 3 },
};

export const CROP_TYPES = Object.keys(CROPS) as CropKey[];
export const FISH: FishKey[] = ['catfish', 'trout', 'salmon', 'koi'];
export const ALL_ITEMS = Object.keys(ITEMS) as ItemKey[];
export const NOUN: Record<CropKey, string> = { tomato: 'tomatoes', corn: 'corn', rice: 'rice', apple: 'apples' };

export interface SeasonDef {
  name: string;
  sub: string;
  grow: number; cust: number; wind: number; rain: number; snow: number; wet: number; haze: number; frozen: number;
  cloud: number; turb: number; ray: number; mie: number; fog: number; fogDay: number;
  grass: number; leaf: number; tint: [number, number, number]; sat: number; exp: number; bloom: number;
  sun: number; hemi: number; grassH: number; fireflies: number;
}

export const SEASONS: Record<SeasonKey, SeasonDef> = {
  spring: { name: 'Spring', sub: 'Windy, with leaves on the air', grow: 1.1, cust: 1.1, wind: 1.0, rain: 0, snow: 0, wet: 0, haze: 0, frozen: 0, cloud: 0.26, turb: 2.2, ray: 2.6, mie: 0.003, fog: 0.0021, fogDay: 0xbcd3e6, grass: 0xc4d9a4, leaf: 0xeaffd8, tint: [1.0, 1.0, 0.98], sat: 1.05, exp: 1.0, bloom: 0.35, sun: 3.2, hemi: 0.5, grassH: 1.0, fireflies: 0.8 },
  summer: { name: 'Summer', sub: 'Hot and sunny, heat rising off the fields', grow: 1.25, cust: 1.25, wind: 0.22, rain: 0, snow: 0, wet: 0, haze: 1, frozen: 0, cloud: 0.1, turb: 2.0, ray: 1.9, mie: 0.003, fog: 0.0018, fogDay: 0xd2dadf, grass: 0xd3c690, leaf: 0xd6e8c0, tint: [1.05, 1.0, 0.92], sat: 1.0, exp: 0.95, bloom: 0.5, sun: 3.8, hemi: 0.45, grassH: 0.85, fireflies: 1.0 },
  rainy: { name: 'Rainy', sub: 'Steady rainfall, crops drink it up', grow: 1.4, cust: 0.75, wind: 0.6, rain: 1, snow: 0, wet: 1, haze: 0, frozen: 0, cloud: 0.95, turb: 12, ray: 0.45, mie: 0.02, fog: 0.0085, fogDay: 0x8e9aa3, grass: 0xaac58c, leaf: 0xc9dcc0, tint: [0.93, 0.98, 1.05], sat: 0.85, exp: 1.45, bloom: 0.25, sun: 0.9, hemi: 0.8, grassH: 1.0, fireflies: 0.25 },
  winter: { name: 'Winter', sub: 'Snowfall, and the pond freezes over', grow: 0.55, cust: 0.85, wind: 0.4, rain: 0, snow: 1, wet: 0, haze: 0, frozen: 1, cloud: 0.78, turb: 7, ray: 0.9, mie: 0.01, fog: 0.0058, fogDay: 0xc7d1db, grass: 0xbcc0aa, leaf: 0x9fb0a0, tint: [0.95, 0.98, 1.06], sat: 0.88, exp: 0.85, bloom: 0.3, sun: 1.8, hemi: 0.6, grassH: 0.3, fireflies: 0 },
};
export const SEASON_ORDER: SeasonKey[] = ['spring', 'summer', 'rainy', 'winter'];

/** Real seconds per in-game day at 1× speed. */
export const DAY_SECONDS = 600;
export const MAX_BOTS = 16;

export const POND = { cx: 0, cz: -31, rx: 10, rz: 6.5 };
export const STALL = { x0: -5.9, x1: 5.9, z0: -3.6, z1: 2.9 };
export const DOCK = { x: 0, z: -11.5 };
export const ROAD_Z = 74;

export const BOT_COLORS = [0xe9b949, 0x3f9f9a, 0xd8664a, 0x4f7fd0, 0x8d74c9, 0x72b35e, 0xd77fa5, 0xcfc4ad, 0x4aa8d6, 0xc4873a, 0x9aa3ad, 0xe1d36a];
export const BOT_NAMES = ['Bolt', 'Rivet', 'Sprocket', 'Pip', 'Tilly', 'Cog', 'Nimbus', 'Widget', 'Dynamo', 'Gizmo', 'Ratchet', 'Tinker', 'Beacon', 'Ziggy', 'Juniper', 'Spark', 'Clover', 'Pebble', 'Rusty', 'Mochi'];

/** Customer waiting spots on the plaza. */
export const SHOP_SPOTS: { x: number; z: number }[] = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) SHOP_SPOTS.push({ x: -8.4 + c * 2.8, z: 5.8 + r * 2.9 });

export interface FishSpot { x: number; z: number; lx: number; lz: number; pier?: boolean }
export const FISH_SPOTS: FishSpot[] = [];
for (const deg of [15, 50, 130, 165, 200, 240, 300, 340]) {
  const a = (deg * Math.PI) / 180;
  FISH_SPOTS.push({
    x: POND.cx + Math.cos(a) * (POND.rx + 0.9), z: POND.cz + Math.sin(a) * (POND.rz + 0.9),
    lx: POND.cx + Math.cos(a) * POND.rx * 0.4, lz: POND.cz + Math.sin(a) * POND.rz * 0.4,
  });
}
FISH_SPOTS.push({ x: 0, z: -27.1, lx: 0, lz: -33, pier: true });

export const WISH_POOL: [ItemKey, number][] = [['tomato', 3], ['corn', 3], ['rice', 2], ['apple', 3], ['catfish', 2], ['trout', 2], ['salmon', 1.4], ['eggs', 2.6], ['duckEggs', 1.2]];

/* ---------------- poultry ---------------- */
/** Seconds for a nest to produce a full carton at 1× in daylight. */
export const LAY: Record<PoultryKey, number> = { eggs: 16, duckEggs: 26 };
/** Chicken coop: raised house on the east edge of a fenced run; nest boxes open to the outside. */
export const COOP = { x: -37, z: 1.5, w: 4.2, d: 4.2 };
export const RUN = { x0: -49, x1: -34.9, z0: -7, z1: 10 };
export const DUCK_HOUSE = { x: 15.2, z: -37.6 };
export interface NestDef { type: PoultryKey; x: number; z: number; sx: number; sz: number }
export const NESTS: NestDef[] = [];
for (let i = 0; i < 6; i++) { const z = COOP.z - 1.6 + i * 0.64; NESTS.push({ type: 'eggs', x: COOP.x + COOP.w / 2 + 0.45, z, sx: COOP.x + COOP.w / 2 + 1.55, sz: z }); }
for (const [dx, dz] of [[-2.0, -0.4], [-2.3, 0.9], [-1.4, 1.8]]) { const x = DUCK_HOUSE.x + dx, z = DUCK_HOUSE.z + dz; NESTS.push({ type: 'duckEggs', x, z, sx: x - 1.0, sz: z + 0.9 }); }
/** Rectangles robots must not drive through (coop + run, duck house). */
export const OBSTACLES = [
  { x0: RUN.x0, x1: RUN.x1, z0: RUN.z0, z1: RUN.z1 },
  { x0: DUCK_HOUSE.x - 1.3, x1: DUCK_HOUSE.x + 1.3, z0: DUCK_HOUSE.z - 1.1, z1: DUCK_HOUSE.z + 1.1 },
];
export const isPoultry = (t: string): t is PoultryKey => t === 'eggs' || t === 'duckEggs';
