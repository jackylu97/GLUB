import { describe, expect, it } from 'vitest';
import { extendSchedule } from '../scripts/lib/schedule';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `fish-${String(i).padStart(3, '0')}`);

describe('extendSchedule', () => {
  it('deals five different fish a day up to the horizon', () => {
    const s = extendSchedule({}, ids(12), 0, 10);
    expect(Object.keys(s)).toHaveLength(10);
    for (const day of Object.values(s)) expect(new Set(day).size).toBe(5);
  });

  it('uses every fish before repeating any', () => {
    const s = extendSchedule({}, ids(12), 0, 3);
    expect(new Set([...s[1], ...s[2], ...s[3].slice(0, 2)]).size).toBe(12);
  });

  it('is deterministic', () => {
    expect(extendSchedule({}, ids(30), 0, 20)).toEqual(extendSchedule({}, ids(30), 0, 20));
  });

  it('never rewrites a frozen day, even when fish are added', () => {
    const first = extendSchedule({}, ids(150), 0, 60);
    const grown = extendSchedule(first, [...ids(150), 'new-fish'], 10, 60);
    for (let d = 1; d <= 10; d++) expect(grown[d]).toEqual(first[d]);
  });

  it('shows a newly added fish before any fish repeats', () => {
    const first = extendSchedule({}, ids(150), 0, 60);
    const grown = extendSchedule(first, [...ids(150), 'new-fish'], 10, 60);
    const seen = new Set<string>();
    let firstRepeat = Infinity;
    for (let d = 1; d <= 60 && firstRepeat === Infinity; d++) {
      for (const id of grown[d]) if (seen.has(id)) firstRepeat = d;
      grown[d].forEach((id) => seen.add(id));
    }
    const newDay = Number(Object.entries(grown).find(([, day]) => day.includes('new-fish'))?.[0]);
    expect(newDay).toBeGreaterThan(10);
    expect(newDay).toBeLessThanOrEqual(firstRepeat);
  });

  it('keeps a fish out for at least a full cycle after it is shown', () => {
    const s = extendSchedule({}, ids(25), 0, 40);
    const lastSeen = new Map<string, number>();
    for (let d = 1; d <= 40; d++) {
      for (const id of s[d]) {
        if (lastSeen.has(id)) expect(d - lastSeen.get(id)!).toBeGreaterThanOrEqual(5);
        lastSeen.set(id, d);
      }
    }
  });
});
