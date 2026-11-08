import { describe, expect, it } from 'vitest';
import { applyGuess, currentIndex, newDay, recordFinish, total } from '../src/lib/game';

const range = { cells: [], anchors: [{ lat: -42.95, lng: 147.33, radiusKm: 30 }] };
const home = { lat: -42.95, lng: 147.33 };
const ids = ['a', 'b', 'c', 'd', 'e'];

function play(n: number, day = 1) {
  let s = newDay(day, ids);
  for (let i = 0; i < n; i++) s = applyGuess(s, home, range);
  return s;
}

describe('day progress', () => {
  it('starts at the first fish', () => {
    expect(currentIndex(newDay(1, ids))).toBe(0);
  });

  it('moves on one fish per guess', () => {
    expect(currentIndex(play(2))).toBe(2);
  });

  it('is done after five guesses and ignores a sixth', () => {
    const done = play(5);
    expect(currentIndex(done)).toBe(5);
    expect(applyGuess(done, home, range)).toBe(done);
  });

  it('scores a guess inside the range at 1000', () => {
    const s = play(1);
    expect(s.guesses[0]).toMatchObject({ km: 0, points: 1000, pin: home });
    expect(total(play(5))).toBe(5000);
  });

  it('does not mutate the previous state', () => {
    const before = newDay(1, ids);
    applyGuess(before, home, range);
    expect(before.guesses[0]).toBeNull();
  });
});

describe('recordFinish', () => {
  const empty = { played: 0, streak: 0, best: 0, lastDay: 0 };

  it('extends the streak only on consecutive days', () => {
    const d1 = recordFinish(empty, play(5, 1));
    const d2 = recordFinish(d1, play(5, 2));
    const d4 = recordFinish(d2, play(5, 4));
    expect([d1.streak, d2.streak, d4.streak]).toEqual([1, 2, 1]);
    expect(d4.played).toBe(3);
    expect(d4.best).toBe(5000);
  });

  it('counts a day only once', () => {
    const once = recordFinish(empty, play(5, 4));
    expect(recordFinish(once, play(5, 4))).toEqual(once);
  });
});
