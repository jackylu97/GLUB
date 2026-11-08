// Generates the styled world maps and Tasman Sea close-ups for the mockups.
// Usage: node gen-maps.mjs <geo-dir> <out-dir>
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

// Seeded RNG so regenerated assets stay stable.
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const W = 1000, H = 520;
const worldProj = geoNaturalEarth1().fitExtent([[14, 14], [W - 14, H - 14]], { type: 'Sphere' });

// Chaikin smoothing turns a coastline into a soft, hand-cut blob.
function chaikin(ring, iters) {
  let pts = ring;
  for (let n = 0; n < iters; n++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}
const ringPath = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';

function ringArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}

// Project through d3 first so rings are clipped to the sphere, then smooth screen-space rings.
// Tiny islands get a minimum size: the map has to be fair to fish that live on specks.
function blobLand(fc, proj, { smooth = 1, minIsland = 3.2, jitter = 0.5, seed = 7 } = {}) {
  const r = rng(seed);
  const d = geoPath(proj)(fc);
  const rings = d.split('M').filter(Boolean).map((s) =>
    s.replace(/Z/g, '').split('L').map((c) => c.split(',').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite))
  );
  const out = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const area = ringArea(ring);
    if (area < 0.4) continue;
    const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    const scale = area < minIsland * minIsland * 3 ? (minIsland * Math.sqrt(3)) / Math.sqrt(area) : 1;
    const moved = ring.map((p) => [
      c[0] + (p[0] - c[0]) * scale + (r() - 0.5) * jitter,
      c[1] + (p[1] - c[1]) * scale + (r() - 0.5) * jitter,
    ]);
    out.push(ringPath(chaikin(moved, smooth)));
  }
  return out.join('');
}

const spherePath = geoPath(worldProj)({ type: 'Sphere' });
const worldLand = blobLand(land110, worldProj);

function wavePath(x, y, w, amp = 3) {
  const step = w / 3;
  let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
  for (let i = 0; i < 3; i++) {
    d += `q${(step / 2).toFixed(1)} ${(i % 2 ? amp : -amp)} ${step.toFixed(1)} 0`;
  }
  return d;
}

// A small fish glyph used as sea decoration on the maps.
function fishGlyph(x, y, s, flip, fill, stroke) {
  const t = `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(flip ? -s : s).toFixed(2)} ${s.toFixed(2)})`;
  return `<g transform="${t}"><path d="M-12 0C-7 -7 5 -7 10 0L17 -6C16 -2 16 2 17 6L10 0C5 7 -7 7 -12 0Z" fill="${fill}" stroke="${stroke}" stroke-width="${(1.4 / s).toFixed(2)}" stroke-linejoin="round"/><circle cx="-6" cy="-1.2" r="1.3" fill="${stroke}"/></g>`;
}

function seaFish(seed, spots, fill, stroke) {
  const r = rng(seed);
  return spots.map(([lon, lat, s]) => {
    const [x, y] = worldProj([lon, lat]);
    return fishGlyph(x, y, s, r() > 0.5, fill, stroke);
  }).join('');
}

function waves(seed, n, stroke, sw, landTest) {
  const r = rng(seed);
  let d = '';
  let placed = 0, guard = 0;
  while (placed < n && guard++ < n * 40) {
    const lon = -175 + r() * 350, lat = -70 + r() * 135;
    if (landTest(lon, lat)) continue;
    const [x, y] = worldProj([lon, lat]);
    d += wavePath(x, y, 16 + r() * 12);
    placed++;
  }
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

// Point-in-land test against the projected 110m polygons, good enough to keep waves off land.
const landRings = (() => {
  const rings = [];
  for (const f of land110.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) rings.push(p[0]);
  }
  return rings;
})();
function isLand(lon, lat) {
  for (const ring of landRings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const write = (name, s) => {
  fs.writeFileSync(path.join(outDir, name), s);
  console.log(name, (s.length / 1024).toFixed(1) + 'KB');
};

const SEA_SPOTS = [[-150, 18, 1.1], [-125, -28, 1.4], [-38, 28, 1.2], [-18, -32, 1.1], [75, -32, 1.4], [162, 22, 1.2], [-95, -52, 0.9], [20, -55, 0.9]];

// ---------- A: cartoon reel ----------
write('map-reel.svg', svg(W, H, `
<path d="${spherePath}" fill="#0E9C97" stroke="#14110F" stroke-width="5"/>
${waves(11, 90, '#0A7773', 2.6, isLand)}
${seaFish(3, SEA_SPOTS, '#FFC93C', '#14110F')}
<path d="${worldLand}" transform="translate(3 4)" fill="#14110F"/>
<path d="${worldLand}" fill="#FFC93C" stroke="#14110F" stroke-width="2.6" stroke-linejoin="round"/>
`));

// ---------- B: fish post ----------
const engrave = (() => {
  let d = '';
  for (let y = 18; y < H - 10; y += 7) {
    let line = `M6 ${y}`;
    for (let x = 6; x < W; x += 24) line += `q6 ${(x / 24) % 2 ? 1.5 : -1.5} 12 0t12 0`;
    d += line;
  }
  return d;
})();
const postGraticule = geoPath(worldProj)(geoGraticule10());
write('map-post.svg', svg(W, H, `
<clipPath id="s"><path d="${spherePath}"/></clipPath>
<path d="${spherePath}" fill="#CFE4FF"/>
<g clip-path="url(#s)"><path d="${engrave}" fill="none" stroke="#7FA9EE" stroke-width="1.1"/>
<path d="${postGraticule}" fill="none" stroke="#1A3FBF" stroke-width="0.7" stroke-dasharray="2 5" opacity="0.65"/></g>
${seaFish(5, SEA_SPOTS, '#E8352E', '#14246B')}
<path d="${worldLand}" fill="#1A3FBF" stroke="#14246B" stroke-width="1.4" stroke-linejoin="round"/>
<path d="${spherePath}" fill="none" stroke="#14246B" stroke-width="3"/>
`));

// ---------- C: pet-shop tank (poster behind the water) ----------
const caustics = (() => {
  const r = rng(21);
  let d = '';
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H * 0.9;
    d += `M${x.toFixed(0)} ${y.toFixed(0)}c${(10 + r() * 30).toFixed(0)} ${(-10 - r() * 14).toFixed(0)} ${(30 + r() * 30).toFixed(0)} ${(14 + r() * 14).toFixed(0)} ${(60 + r() * 50).toFixed(0)} ${(r() * 10 - 5).toFixed(0)}`;
  }
  return d;
})();
const tankLand = blobLand(land110, worldProj, { smooth: 2, jitter: 1.1, seed: 13 });
write('map-tank.svg', svg(W, H, `
<path d="${caustics}" fill="none" stroke="#B9FFF8" stroke-width="2" opacity="0.28" stroke-linecap="round"/>
<path d="${tankLand}" transform="translate(4 5)" fill="#074A80" opacity="0.55"/>
<path d="${tankLand}" fill="#D8FF4F" stroke="#07365F" stroke-width="2.2" stroke-linejoin="round"/>
`));

// ---------- Close-up over the Tasman Sea for the reveal screens ----------
const HOBART = [147.33, -42.95];
const GUESS = [172.64, -43.53]; // sample guess: Christchurch, New Zealand
const closeProj = geoMercator().fitExtent([[0, 0], [800, 800]], {
  type: 'MultiPoint', coordinates: [[140.5, -32], [179.5, -51.5]],
}).clipExtent([[-30, -30], [830, 830]]);
const closeLand = blobLand(land50, closeProj, { smooth: 1, minIsland: 2, jitter: 0.3, seed: 2 });
const px = closeProj(HOBART), gx = closeProj(GUESS);
const kmPerDeg = 111.32;
const rangeR = Math.abs(closeProj([HOBART[0], HOBART[1] - 45 / kmPerDeg])[1] - px[1]);
const closeBody = ({ sea, seaStroke, land, ink, range, rangeInk, line, marks }) => `
<rect width="800" height="800" fill="${sea}"/>
${marks || ''}
${waves(31, 0, seaStroke, 2, () => true)}
<path d="${closeLand}" fill="${land}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
<path d="M${gx[0].toFixed(1)} ${gx[1].toFixed(1)}Q${((gx[0] + px[0]) / 2).toFixed(1)} ${(Math.min(gx[1], px[1]) - 90).toFixed(1)} ${px[0].toFixed(1)} ${px[1].toFixed(1)}" fill="none" stroke="${line}" stroke-width="5" stroke-dasharray="4 13" stroke-linecap="round"/>
<circle cx="${px[0].toFixed(1)}" cy="${px[1].toFixed(1)}" r="${Math.max(rangeR, 16).toFixed(1)}" fill="${range}" stroke="${rangeInk}" stroke-width="5"/>
`;
const waveField = (seed, n, stroke) => {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) d += wavePath(r() * 780, r() * 790, 26 + r() * 22, 5);
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="3.4" stroke-linecap="round"/>`;
};
write('close-reel.svg', svg(800, 800, closeBody({ sea: '#0E9C97', seaStroke: '#0A7773', land: '#FFC93C', ink: '#14110F', range: '#F2643D', rangeInk: '#14110F', line: '#FFF6DF', marks: waveField(41, 44, '#0A7773') })));
write('close-post.svg', svg(800, 800, closeBody({ sea: '#CFE4FF', seaStroke: '#7FA9EE', land: '#1A3FBF', ink: '#14246B', range: '#E8352E', rangeInk: '#14246B', line: '#E8352E', marks: waveField(42, 40, '#7FA9EE') })));
write('close-tank.svg', svg(800, 800, closeBody({ sea: '#109BCB', seaStroke: '#2FE3E0', land: '#D8FF4F', ink: '#07365F', range: '#FF3D9A', rangeInk: '#07365F', line: '#FFFFFF', marks: waveField(43, 40, '#2FE3E0') })));

// Pin and range positions, as percentages of each map frame, for the HTML overlays.
const pct = (p, w, h) => [(100 * p[0] / w).toFixed(2), (100 * p[1] / h).toFixed(2)];
const hav = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
console.log(JSON.stringify({
  world: { guess: pct(worldProj(GUESS), W, H), range: pct(worldProj(HOBART), W, H) },
  close: { guess: pct(gx, 800, 800), range: pct(px, 800, 800), rangeR: (100 * rangeR / 800).toFixed(2) },
  distanceKm: Math.round(hav(HOBART, GUESS)),
}, null, 1));
