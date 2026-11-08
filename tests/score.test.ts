import { describe, expect, it } from 'vitest';
import { BAND_LABEL, bandFor, pointsFor } from '../src/lib/score';

describe('pointsFor', () => {
  it('gives full marks inside the range', () => {
    expect(pointsFor(0)).toBe(1000);
  });

  it('decays with distance', () => {
    expect(pointsFor(606)).toBe(668);
    expect(pointsFor(2043)).toBe(256);
  });

  it('gives nothing for a non-finite distance', () => {
    expect(pointsFor(Infinity)).toBe(0);
    expect(pointsFor(Number.NaN)).toBe(0);
  });
});

describe('bandFor', () => {
  it('splits at 0, 500, 1500 and 4000 km', () => {
    expect(bandFor(0)).toBe('whopper');
    expect(bandFor(499)).toBe('prize');
    expect(bandFor(500)).toBe('keeper');
    expect(bandFor(1499)).toBe('keeper');
    expect(bandFor(1500)).toBe('minnow');
    expect(bandFor(3999)).toBe('minnow');
    expect(bandFor(4000)).toBe('boot');
  });

  it('labels every band', () => {
    expect(BAND_LABEL.whopper).toBe('In range');
    expect(BAND_LABEL.prize).toBe('Under 500 km');
    expect(BAND_LABEL.keeper).toBe('Under 1,500 km');
    expect(BAND_LABEL.minnow).toBe('Under 4,000 km');
    expect(BAND_LABEL.boot).toBe('4,000 km or more');
  });
});
