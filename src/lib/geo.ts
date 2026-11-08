export type LatLng = { lat: number; lng: number };

export type Anchor = { lat: number; lng: number; radiusKm: number };

/** A native range. Cells are [lat, lng] centres of 0.5° grid squares; anchors are circles. */
export type Range = { cells: [number, number][]; anchors: Anchor[] };

export type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const EARTH_RADIUS_KM = 6371;
const RAD = Math.PI / 180;

/** Cells are treated as circles roughly covering a 0.5° square. */
export const CELL_RADIUS_KM = 35;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from `from` to `to`, in degrees clockwise from north. */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const p1 = from.lat * RAD;
  const p2 = to.lat * RAD;
  const dl = (to.lng - from.lng) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

const POINTS: Compass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function compass8(deg: number): Compass {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Which way `to` lies from `from` on a flat world map, taking the short way round in longitude. */
export function mapDirection(from: LatLng, to: LatLng): Compass {
  const dLng = ((((to.lng - from.lng) % 360) + 540) % 360) - 180;
  const dLat = to.lat - from.lat;
  const dx = dLng * Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180);
  return compass8((Math.atan2(dx, dLat) * 180) / Math.PI);
}

/** Distance from a pin to the edge of the nearest anchor or cell, and that anchor or cell's centre. */
export function distanceToRange(p: LatLng, r: Range): { km: number; nearest: LatLng } {
  let best = { km: Infinity, nearest: p };
  const consider = (centre: LatLng, radiusKm: number) => {
    const km = Math.max(0, haversineKm(p, centre) - radiusKm);
    if (km < best.km) best = { km, nearest: centre };
  };
  for (const a of r.anchors) consider({ lat: a.lat, lng: a.lng }, a.radiusKm);
  for (const [lat, lng] of r.cells) consider({ lat, lng }, CELL_RADIUS_KM);
  return best;
}
