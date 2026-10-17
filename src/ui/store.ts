import { create } from 'zustand';
import type { SeasonKey } from '../sim/constants';
import type { AwayReport, TickerLine, DayRecord } from '../sim/world';

export type CamMode = 'cinematic' | 'free' | 'follow';

export interface HudState {
  ready: boolean;
  day: number; clock: string; progress: number; season: SeasonKey; seasonPref: SeasonKey | 'auto'; speed: number;
  cash: number; lifetime: number; bots: number; shoppers: number; soldToday: number; earnedToday: number; best: number;
  ticker: TickerLine[];
  camMode: CamMode; followId: number; uiHidden: boolean;
  away: AwayReport | null; dayClosed: DayRecord | null;
  rev: number; qLevel: number;
  set: (p: Partial<HudState>) => void;
}

export const useHud = create<HudState>(set => ({
  ready: false, day: 1, clock: '05:30', progress: 0, season: 'spring', seasonPref: 'auto', speed: 1,
  cash: 0, lifetime: 0, bots: 0, shoppers: 0, soldToday: 0, earnedToday: 0, best: 0, ticker: [],
  camMode: 'cinematic', followId: 0, uiHidden: false, away: null, dayClosed: null, rev: 0, qLevel: 2,
  set: p => set(p),
}));

/** Render quality, adjusted automatically by the performance monitor. Read every frame, so it is a plain object. */
export const quality = {
  level: 2, // 0 = lowest, 3 = highest
  shadowMap: 2048,
  ao: true,
  grassDensity: 1,
};
export const isLowEnd = typeof window !== 'undefined' && (matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600 || (navigator.hardwareConcurrency || 8) <= 4);
if (isLowEnd) { quality.level = 1; quality.shadowMap = 1024; quality.ao = false; quality.grassDensity = 0.45; }
