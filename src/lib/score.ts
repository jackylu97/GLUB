export type Band = 'whopper' | 'prize' | 'keeper' | 'minnow' | 'boot';

export const MAX_POINTS = 1000;

/** Points fall off exponentially: about two thirds at 600 km, a quarter at 2,000 km. */
const DECAY_KM = 1500;

export function pointsFor(km: number): number {
  if (!Number.isFinite(km)) return 0;
  if (km <= 0) return MAX_POINTS;
  return Math.round(MAX_POINTS * Math.exp(-km / DECAY_KM));
}

export function bandFor(km: number): Band {
  if (km <= 0) return 'whopper';
  if (km < 500) return 'prize';
  if (km < 1500) return 'keeper';
  if (km < 4000) return 'minnow';
  return 'boot';
}

export const BAND_LABEL: Record<Band, string> = {
  whopper: 'In range',
  prize: 'Under 500 km',
  keeper: 'Under 1,500 km',
  minnow: 'Under 4,000 km',
  boot: '4,000 km or more',
};
