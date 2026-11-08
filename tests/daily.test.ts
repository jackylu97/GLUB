import { describe, expect, it } from 'vitest';
import { archiveDays, dateForDay, dayNumber, msUntilNextDay, pickDaily } from '../src/lib/daily';

const fish = Array.from({ length: 12 }, (_, i) => ({ id: `fish-${String(i).padStart(2, '0')}` }));
const ids = (day: number) => pickDaily(fish, day).map((f) => f.id);

describe('dayNumber', () => {
  it('counts 24 October 2026 as day 1 all day long', () => {
    expect(dayNumber(new Date(2026, 9, 24, 0, 1))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 24, 23, 59))).toBe(1);
  });

  it('makes 7 November 2026 issue 15, so two weeks of back issues exist', () => {
    expect(dayNumber(new Date(2026, 10, 7, 12, 0))).toBe(15);
  });

  it('rolls over at local midnight', () => {
    expect(dayNumber(new Date(2026, 9, 25, 0, 0))).toBe(2);
    expect(dayNumber(new Date(2027, 9, 24, 12, 0))).toBe(366);
  });
});

describe('dateForDay', () => {
  it('is the local calendar date of an issue', () => {
    const d = dateForDay(15);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 7]);
  });

  it('round-trips with dayNumber across a DST change', () => {
    for (let day = 1; day <= 400; day += 7) expect(dayNumber(dateForDay(day))).toBe(day);
  });
});

describe('archiveDays', () => {
  it('lists the fourteen issues before today, newest first', () => {
    expect(archiveDays(15)).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('only goes back two weeks', () => {
    expect(archiveDays(40)).toHaveLength(14);
    expect(archiveDays(40)[13]).toBe(26);
  });

  it('is empty on launch day', () => {
    expect(archiveDays(1)).toEqual([]);
  });
});

describe('pickDaily', () => {
  it('is deterministic', () => {
    expect(ids(3)).toEqual(ids(3));
  });

  it('picks five different fish', () => {
    expect(new Set(ids(1)).size).toBe(5);
  });

  it('does not repeat a fish on consecutive days', () => {
    const day2 = new Set(ids(2));
    expect(ids(1).some((id) => day2.has(id))).toBe(false);
  });

  it('uses every fish before repeating any', () => {
    const seen = new Set([...ids(1), ...ids(2), ...ids(3).slice(0, 2)]);
    expect(seen.size).toBe(12);
  });

  it('still deals real fish for a day before launch', () => {
    const early = pickDaily(fish, 0);
    expect(early).toHaveLength(5);
    expect(early.every((f) => f && f.id)).toBe(true);
  });

  it('returns every fish when there are fewer than five', () => {
    expect(pickDaily(fish.slice(0, 3), 1)).toHaveLength(3);
  });

  it('ignores the order the data arrives in', () => {
    expect(pickDaily([...fish].reverse(), 4).map((f) => f.id)).toEqual(ids(4));
  });
});

describe('msUntilNextDay', () => {
  it('counts down to local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 10, 7, 23, 0, 0))).toBe(60 * 60 * 1000);
  });
});
