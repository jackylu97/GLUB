// Round 2 map assets: no doodles, pattern-filled land, plus sample-game geometry.
// Usage: node gen-maps2.mjs <geo-dir> <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import { geoNaturalEarth1, geoMercator, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';

const [geoDir, outDir] = process.argv.slice(2);
const load = (f, key) => {
  const t = JSON.parse(fs.readFileSync(path.join(geoDir, f), 'utf8'));
  return feature(t, t.objects[key]);
};
const land110 = load('land-110m.json', 'land');
const land50 = load('land-50m.json', 'land');
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function chaikin(ring, iters) {
  let pts = ring;
  for (let n = 0; n < iters; n++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}
const ringArea = (pts) => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
function blobLand(fc, proj, { smooth = 1, minIsland = 3.2, jitter = 0.5, seed = 7 } = {}) {
  const r = rng(seed);
  const rings = geoPath(proj)(fc).split('M').filter(Boolean).map((s) =>
    s.replace(/Z/g, '').split('L').map((c) => c.split(',').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)));
  let d = '';
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const area = ringArea(ring);
    if (area < 0.4) continue;
    const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    const k = area < minIsland * minIsland * 3 ? (minIsland * Math.sqrt(3)) / Math.sqrt(area) : 1;
    const pts = chaikin(ring.map((p) => [c[0] + (p[0] - c[0]) * k + (r() - 0.5) * jitter, c[1] + (p[1] - c[1]) * k + (r() - 0.5) * jitter]), smooth);
    d += 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
  }
  return d;
}
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const write = (name, s) => { fs.writeFileSync(path.join(outDir, name), s); console.error(name, (s.length / 1024).toFixed(0) + 'KB'); };

const INK = '#14110F', TEAL = '#0E9C97', DEEP = '#0A5F5C', CORAL = '#F2643D', SUN = '#FFC93C', CEL = '#FFF6DF';
const W = 1000, H = 520;
const world = geoNaturalEarth1().fitExtent([[14, 14], [W - 14, H - 14]], { type: 'Sphere' });
const sphere = geoPath(world)({ type: 'Sphere' });
const land = blobLand(land110, world);
const grat = geoPath(world)(geoGraticule10());

// Fish-scale tile: overlapping scallops, the decorative fill for land in variant 3.
const scalePattern = (id, fill, line, s = 9) => `<pattern id="${id}" width="${s * 2}" height="${s}" patternUnits="userSpaceOnUse">
<rect width="${s * 2}" height="${s}" fill="${fill}"/>
<path d="M0 ${s}A${s} ${s} 0 0 1 ${s * 2} ${s}M${-s} 0A${s} ${s} 0 0 1 ${s} 0M${s} 0A${s} ${s} 0 0 1 ${s * 3} 0" fill="none" stroke="${line}" stroke-width="1.3"/></pattern>`;
const dotPattern = (id, dot, s = 6, r = 1.7) => `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="${dot}"/></pattern>`;

// V1: clean oval, flat colour, ink keyline.
write('map2-oval.svg', svg(W, H, `
<path d="${sphere}" fill="${TEAL}" stroke="${INK}" stroke-width="5"/>
<path d="${grat}" fill="none" stroke="${DEEP}" stroke-width="0.8" opacity="0.6"/>
<path d="${land}" transform="translate(2.5 3.5)" fill="${INK}"/>
<path d="${land}" fill="${SUN}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`));

// V2: newsprint chart. Halftone land, ruled graticule, no ocean fill.
write('map2-news.svg', svg(W, H, `
<defs>${dotPattern('ht', CORAL)}</defs>
<path d="${grat}" fill="none" stroke="${INK}" stroke-width="0.7" stroke-dasharray="1.5 3"/>
<path d="${land}" fill="url(#ht)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
<path d="${sphere}" fill="none" stroke="${INK}" stroke-width="3"/>`));

// V3: land tiled in fish scales.
write('map2-scales.svg', svg(W, H, `
<defs>${scalePattern('sc', SUN, '#C98E12', 8)}</defs>
<path d="${sphere}" fill="${TEAL}"/>
<path d="${land}" fill="url(#sc)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="${sphere}" fill="none" stroke="${INK}" stroke-width="4"/>`));

// Close-ups of the Tasman Sea for the answer screens.
const close = geoMercator().fitExtent([[0, 0], [800, 800]], { type: 'MultiPoint', coordinates: [[140.5, -32], [179.5, -51.5]] }).clipExtent([[-30, -30], [830, 830]]);
const closeLand = blobLand(land50, close, { minIsland: 2, jitter: 0.3, seed: 2 });
const closeGrat = geoPath(close)(geoGraticule10());
write('close2-oval.svg', svg(800, 800, `<rect width="800" height="800" fill="${TEAL}"/><path d="${closeGrat}" fill="none" stroke="${DEEP}" stroke-width="2"/><path d="${closeLand}" fill="${SUN}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`));
write('close2-news.svg', svg(800, 800, `<defs>${dotPattern('ht2', CORAL, 12, 3.4)}</defs><rect width="800" height="800" fill="${SUN}"/><path d="${closeGrat}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 6"/><path d="${closeLand}" fill="url(#ht2)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`));
write('close2-scales.svg', svg(800, 800, `<defs>${scalePattern('sc2', SUN, '#C98E12', 16)}</defs><rect width="800" height="800" fill="${TEAL}"/><path d="${closeLand}" fill="url(#sc2)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`));

// Sample game: three casts, the third lands in the range.
const HOME = [147.33, -42.95];
const casts = { c1: [172.64, -43.53], c2: [144.96, -37.81], c3: [147.36, -42.98] };
const R = 6371, rad = Math.PI / 180;
const hav = (a, b) => { const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const bearing = (a, b) => { const p1 = a[1] * rad, p2 = b[1] * rad, dl = (b[0] - a[0]) * rad; return ((Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / rad) + 360) % 360; };
const pct = (p, w, h) => [+(100 * p[0] / w).toFixed(2), +(100 * p[1] / h).toFixed(2)];
const out = { world: {}, close: {}, casts: {} };
for (const [k, c] of Object.entries({ home: HOME, ...casts })) {
  out.world[k] = pct(world(c), W, H);
  out.close[k] = pct(close(c), 800, 800);
  if (k !== 'home') out.casts[k] = { km: Math.round(hav(c, HOME)), bearing: Math.round(bearing(c, HOME)) };
}
out.close.rangeRadiusPct = +((100 * Math.abs(close([HOME[0], HOME[1] - 30 / 111.32])[1] - close(HOME)[1])) / 800).toFixed(2);
// Moon phase for the sample date, from a known new moon (2000-01-06 18:14 UTC).
const days = (Date.UTC(2026, 10, 7, 12) - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
out.moonAgeDays = +(((days % 29.530588853) + 29.530588853) % 29.530588853).toFixed(1);
console.log(JSON.stringify(out, null, 1));
