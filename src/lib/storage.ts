import { type DayState, EMPTY_STATS, type Stats } from './game';

/** v2: issue numbers moved when the launch date moved back two weeks for the archive. */
const PREFIX = 'glub:v2:';

/** Fallback for private windows and blocked storage: progress survives for the session only. */
const memory = new Map<string, string>();

/** Memory first: it always holds this session's latest write, even after storage starts failing. */
function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  memory.set(key, value);
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // Storage is unavailable or full; memory keeps the session going.
  }
}

function parse(text: string | null): unknown {
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v: any) => v && isNum(v.lat) && isNum(v.lng);

function isDayState(v: any, day: number): v is DayState {
  return (
    v &&
    v.day === day &&
    Array.isArray(v.fishIds) &&
    v.fishIds.every((id: unknown) => typeof id === 'string') &&
    Array.isArray(v.guesses) &&
    v.guesses.length === v.fishIds.length &&
    v.guesses.every((g: any) => g === null || (isPoint(g.pin) && isPoint(g.nearest) && isNum(g.km) && isNum(g.points)))
  );
}

export function loadDay(day: number): DayState | null {
  const v = parse(read(`day:${day}`));
  return isDayState(v, day) ? v : null;
}

export function saveDay(s: DayState): void {
  write(`day:${s.day}`, JSON.stringify(s));
}

export function loadStats(): Stats {
  const v: any = parse(read('stats'));
  if (v && isNum(v.played) && isNum(v.streak) && isNum(v.best) && isNum(v.lastDay)) {
    return { played: v.played, streak: v.streak, best: v.best, lastDay: v.lastDay };
  }
  return { ...EMPTY_STATS };
}

export function saveStats(st: Stats): void {
  write('stats', JSON.stringify(st));
}
