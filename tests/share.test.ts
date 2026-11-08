import { describe, expect, it } from 'vitest';
import { pointsFor } from '../src/lib/score';
import { shareText } from '../src/lib/share';

describe('shareText', () => {
  it('reports the total and one catch emoji per fish', () => {
    const results = [0, 200, 1000, 3000, 9000].map((km) => ({ km, points: pointsFor(km) }));
    expect(shareText(1, results)).toBe(
      'Glub No. 1 · 2,525 / 5,000\n🐳🐟🐠🦐🥾\nglub glub\nhttps://glub-jx7p.onrender.com/',
    );
  });

  it('ends with a link to the game, so friends can play', () => {
    expect(shareText(15, []).split('\n').at(-1)).toBe('https://glub-jx7p.onrender.com/');
  });
});
