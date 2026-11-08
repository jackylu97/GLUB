/** Glub No. 1 is local date 2026-10-24, two weeks before the first public day, so back issues exist. */
export const LAUNCH = { y: 2026, m: 10, d: 24 };

/** How many earlier issues the archive offers. */
export const ARCHIVE_DAYS = 14;

const DAY_MS = 86_400_000;

/** Day number for a local date. Counted on calendar dates, so DST shifts can't move it. */
export function dayNumber(date: Date): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const launch = Date.UTC(LAUNCH.y, LAUNCH.m - 1, LAUNCH.d);
  return Math.round((local - launch) / DAY_MS) + 1;
}

/** The local calendar date an issue belongs to. */
export function dateForDay(day: number): Date {
  return new Date(LAUNCH.y, LAUNCH.m - 1, LAUNCH.d + day - 1);
}

/** The issues before `today` that the archive offers, newest first. */
export function archiveDays(today: number, span = ARCHIVE_DAYS): number[] {
  const days: number[] = [];
  for (let d = today - 1; d >= Math.max(1, today - span); d--) days.push(d);
  return days;
}

export function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const out = [...items];
  const rand = mulberry32(fnv1a(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deals fish like a shuffled deck: every fish appears once before any repeats, and each pass
 * through the list gets a fresh shuffle. Days are consecutive runs of `count` cards.
 */
export function pickDaily<T extends { id: string }>(fish: T[], day: number, count = 5): T[] {
  const deck = [...fish].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = deck.length;
  const want = Math.min(count, n);
  const passes = new Map<number, T[]>();
  const pass = (cycle: number) => {
    if (!passes.has(cycle)) passes.set(cycle, shuffled(deck, `glub-${cycle}`));
    return passes.get(cycle)!;
  };

  const picked: T[] = [];
  for (let slot = (day - 1) * count; picked.length < want; slot++) {
    const card = pass(Math.floor(slot / n))[((slot % n) + n) % n];
    if (!picked.includes(card)) picked.push(card);
  }
  return picked;
}
