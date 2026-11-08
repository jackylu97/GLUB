import { geoCircle, geoNaturalEarth1, type GeoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { LatLng, Range } from './geo';

/** The chart is drawn in a fixed 1000 × 520 coordinate space and scaled by CSS. */
export const VIEW_W = 1000;
export const VIEW_H = 520;

const KM_PER_DEGREE = 111.32;
const HALF_CELL = 0.25;

export function makeProjection(): GeoProjection {
  return geoNaturalEarth1().fitExtent(
    [
      [14, 14],
      [VIEW_W - 14, VIEW_H - 14],
    ],
    { type: 'Sphere' },
  );
}

/** The point under a chart coordinate, or null when it falls outside the globe's outline. */
export function screenToLatLng(projection: GeoProjection, point: [number, number]): LatLng | null {
  const ll = projection.invert?.(point);
  if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
  if (Math.abs(ll[1]) > 90 || Math.abs(ll[0]) > 180) return null;
  const back = projection(ll);
  if (!back || Math.hypot(back[0] - point[0], back[1] - point[1]) > 0.5) return null;
  return { lat: ll[1], lng: ll[0] };
}

/** Anchors become circles; cells become 0.5° squares, wound clockwise as d3-geo expects. */
export function rangeFeatures(range: Range): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const a of range.anchors) {
    const geometry = geoCircle()
      .center([a.lng, a.lat])
      .radius(a.radiusKm / KM_PER_DEGREE)
      .precision(4)();
    features.push({ type: 'Feature', properties: {}, geometry });
  }
  for (const [lat, lng] of range.cells) {
    const [w, e, s, n] = [lng - HALF_CELL, lng + HALF_CELL, lat - HALF_CELL, lat + HALF_CELL];
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export type ViewTransform = { k: number; x: number; y: number };

type Bounds = [[number, number], [number, number]];

/**
 * Zoom and pan that frame `bounds` with padding, never below 1x, and never past the chart's
 * edges. Applied with zoom.transform(), which does not constrain on its own.
 */
export function fitTransform(bounds: Bounds, padding = 0.18, maxK = 8): ViewTransform {
  const [[x0, y0], [x1, y1]] = bounds;
  const w = Math.max(x1 - x0, 40);
  const h = Math.max(y1 - y0, 40);
  const k = Math.min(maxK, Math.max(1, (1 - 2 * padding) / Math.max(w / VIEW_W, h / VIEW_H)));
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    k,
    x: clamp(VIEW_W / 2 - (k * (x0 + x1)) / 2, VIEW_W - k * VIEW_W, 0),
    y: clamp(VIEW_H / 2 - (k * (y0 + y1)) / 2, VIEW_H - k * VIEW_H, 0),
  };
}

/**
 * The view for a reveal: the pin, the great-circle line and the range all in frame. A range or
 * line that wraps the 180° meridian spans the whole chart, so then only the pin and the nearest
 * point of the range are framed; if even those sit on opposite edges, show the whole world.
 */
export function revealTarget(path: GeoPath, range: Range, pin: LatLng, nearest: LatLng): ViewTransform {
  const wide = (b: Bounds) => b[1][0] - b[0][0] > 0.7 * VIEW_W;
  const point = (p: LatLng): Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } });
  const line: Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [[pin.lng, pin.lat], [nearest.lng, nearest.lat]] },
  };
  const all = path.bounds({ type: 'FeatureCollection', features: [...rangeFeatures(range).features, line, point(pin)] }) as Bounds;
  if (!wide(all)) return fitTransform(all);
  const ends = path.bounds({ type: 'FeatureCollection', features: [point(pin), point(nearest)] }) as Bounds;
  return wide(ends) ? { k: 1, x: 0, y: 0 } : fitTransform(ends);
}
