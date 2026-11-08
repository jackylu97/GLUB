import { distanceToRange, type LatLng, type Range } from './geo';
import { pointsFor } from './score';

export type Guess = { pin: LatLng; km: number; points: number; nearest: LatLng };

export type DayState = { day: number; fishIds: string[]; guesses: (Guess | null)[] };

export type Stats = { played: number; streak: number; best: number; lastDay: number };

export const EMPTY_STATS: Stats = { played: 0, streak: 0, best: 0, lastDay: 0 };

export function newDay(day: number, fishIds: string[]): DayState {
  return { day, fishIds, guesses: fishIds.map(() => null) };
}

/** Index of the fish being played, or `fishIds.length` once the day is done. */
export function currentIndex(s: DayState): number {
  const i = s.guesses.findIndex((g) => g === null);
  return i === -1 ? s.fishIds.length : i;
}

export function applyGuess(s: DayState, pin: LatLng, range: Range): DayState {
  const i = currentIndex(s);
  if (i >= s.fishIds.length) return s;
  const { km, nearest } = distanceToRange(pin, range);
  const guesses = [...s.guesses];
  guesses[i] = { pin, km, points: pointsFor(km), nearest };
  return { ...s, guesses };
}

export function total(s: DayState): number {
  return s.guesses.reduce((sum, g) => sum + (g?.points ?? 0), 0);
}

export function recordFinish(stats: Stats, s: DayState): Stats {
  if (stats.lastDay === s.day) return stats;
  return {
    played: stats.played + 1,
    streak: stats.lastDay === s.day - 1 ? stats.streak + 1 : 1,
    best: Math.max(stats.best, total(s)),
    lastDay: s.day,
  };
}
