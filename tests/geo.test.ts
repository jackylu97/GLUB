import { describe, expect, it } from 'vitest';
import { bearingDeg, compass8, distanceToRange, haversineKm, mapDirection } from '../src/lib/geo';

const christchurch = { lat: -43.53, lng: 172.64 };
const melbourne = { lat: -37.81, lng: 144.96 };
const hobart = { lat: -42.95, lng: 147.33 };

describe('haversineKm', () => {
  it('measures Christchurch to Hobart as 2043 km', () => {
    expect(Math.round(haversineKm(christchurch, hobart))).toBe(2043);
  });

  it('measures Melbourne to Hobart as 606 km', () => {
    expect(Math.round(haversineKm(melbourne, hobart))).toBe(606);
  });

  it('measures across the antimeridian the short way', () => {
    expect(haversineKm({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 })).toBeLessThan(25);
  });
});

describe('bearingDeg and compass8', () => {
  it('points west from Christchurch to Hobart', () => {
    const deg = bearingDeg(christchurch, hobart);
    expect(Math.round(deg)).toBe(263);
    expect(compass8(deg)).toBe('W');
  });

  it('wraps north on both sides of 0 degrees', () => {
    expect(compass8(359)).toBe('N');
    expect(compass8(1)).toBe('N');
    expect(compass8(161)).toBe('S');
  });
});

describe('distanceToRange', () => {
  it('is zero inside an anchor radius', () => {
    const r = { cells: [], anchors: [{ lat: -42.95, lng: 147.33, radiusKm: 30 }] };
    expect(distanceToRange({ lat: -42.9, lng: 147.36 }, r).km).toBe(0);
  });

  it('subtracts the anchor radius from the centre distance', () => {
    const anchor = { lat: 0, lng: 0, radiusKm: 30 };
    const pin = { lat: 0, lng: 100 / 111.195 };
    const result = distanceToRange(pin, { cells: [], anchors: [anchor] });
    expect(result.km).toBeCloseTo(70, 0);
    expect(result.nearest).toEqual({ lat: 0, lng: 0 });
  });

  it('uses the closest of several cells and anchors', () => {
    const r = {
      cells: [[10, 10], [-42.75, 147.25]] as [number, number][],
      anchors: [{ lat: 60, lng: 10, radiusKm: 50 }],
    };
    expect(distanceToRange(hobart, r).nearest).toEqual({ lat: -42.75, lng: 147.25 });
  });

  it('is infinite for an empty range', () => {
    expect(distanceToRange(hobart, { cells: [], anchors: [] }).km).toBe(Infinity);
  });
});

describe('mapDirection', () => {
  it('reads the way a flat map does, not the great-circle bearing', () => {
    // Central America to southern India: over the pole by great circle, but east on the map.
    expect(mapDirection({ lat: 8.6, lng: -96 }, { lat: 12, lng: 77 })).toBe('E');
  });

  it('takes the short way round across the antimeridian', () => {
    expect(mapDirection({ lat: 0, lng: 170 }, { lat: 0, lng: -170 })).toBe('E');
  });

  it('gives the eight compass points', () => {
    expect(mapDirection({ lat: 0, lng: 0 }, { lat: 10, lng: 0 })).toBe('N');
    expect(mapDirection({ lat: 0, lng: 0 }, { lat: -10, lng: -10 })).toBe('SW');
  });
});
