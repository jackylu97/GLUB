import { geoArea, geoPath } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { fitTransform, makeProjection, rangeFeatures, revealTarget, screenToLatLng, VIEW_H, VIEW_W } from '../src/lib/mapGeometry';

const projection = makeProjection();
const path = geoPath(projection);

describe('screenToLatLng', () => {
  it('returns null anywhere in the frame margin outside the globe', () => {
    for (let x = 0; x <= VIEW_W; x += 25) {
      for (const y of [0.5, 1.5, 6, 13.4, 13.9, VIEW_H - 1.5]) {
        const ll = screenToLatLng(projection, [x, y]);
        if (ll) {
          expect(Math.abs(ll.lat)).toBeLessThanOrEqual(90);
          expect(Math.abs(ll.lng)).toBeLessThanOrEqual(180);
        }
      }
    }
    expect(screenToLatLng(projection, [2, 2])).toBeNull();
  });

  it('round-trips a point on the globe', () => {
    const hobart = projection([147.33, -42.95])!;
    const back = screenToLatLng(projection, hobart)!;
    expect(back.lat).toBeCloseTo(-42.95, 1);
    expect(back.lng).toBeCloseTo(147.33, 1);
  });
});

describe('rangeFeatures', () => {
  const range = { cells: [[-3, -60], [-3, -59.5]] as [number, number][], anchors: [{ lat: -42.92, lng: 147.33, radiusKm: 15 }] };

  it('makes one shape per anchor and cell', () => {
    expect(rangeFeatures(range).features).toHaveLength(3);
  });

  it('winds every shape so it covers a small area, not the rest of the globe', () => {
    for (const f of rangeFeatures(range).features) expect(geoArea(f)).toBeLessThan(0.001);
  });
});

describe('fitTransform', () => {
  it('never zooms out below 1x and keeps the frame filled', () => {
    const t = fitTransform([[-50, 100], [1050, 300]]);
    expect(t.k).toBe(1);
    expect(t.x).toBeLessThanOrEqual(0);
    expect(t.x).toBeGreaterThanOrEqual(VIEW_W - t.k * VIEW_W);
    expect(t.y).toBeLessThanOrEqual(0);
    expect(t.y).toBeGreaterThanOrEqual(VIEW_H - t.k * VIEW_H);
  });

  it('zooms in on a small area and centres it', () => {
    const t = fitTransform([[600, 300], [640, 320]]);
    expect(t.k).toBeGreaterThan(4);
    expect(t.x + t.k * 620).toBeCloseTo(VIEW_W / 2, 0);
  });
});

describe('revealTarget', () => {
  const inView = (t: { k: number; x: number; y: number }, lng: number, lat: number) => {
    const [px, py] = projection([lng, lat])!;
    const x = t.x + t.k * px;
    const y = t.y + t.k * py;
    return x >= 0 && x <= VIEW_W && y >= 0 && y <= VIEW_H;
  };

  it('keeps the pin and home in view for a range that crosses 180 degrees', () => {
    const range = { cells: [], anchors: [{ lat: -17.5, lng: 179.8, radiusKm: 200 }, { lat: -16.6, lng: -179.9, radiusKm: 120 }] };
    const pin = { lat: -18, lng: 178 };
    const nearest = { lat: -17.5, lng: 179.8 };
    const t = revealTarget(path, range, pin, nearest);
    expect(inView(t, pin.lng, pin.lat)).toBe(true);
    expect(inView(t, nearest.lng, nearest.lat)).toBe(true);
  });

  it('keeps a far-away pin and New Zealand in view', () => {
    const range = { cells: [], anchors: [{ lat: -43.5, lng: 172.3, radiusKm: 40 }] };
    const pin = { lat: 20.8, lng: -156.3 };
    const nearest = { lat: -43.5, lng: 172.3 };
    const t = revealTarget(path, range, pin, nearest);
    expect(inView(t, pin.lng, pin.lat)).toBe(true);
    expect(inView(t, nearest.lng, nearest.lat)).toBe(true);
  });
});
