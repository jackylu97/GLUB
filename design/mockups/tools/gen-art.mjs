// Authored SVG art for the three mockup directions.
// Usage: node gen-art.mjs <out-dir>
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const write = (name, s) => {
  fs.writeFileSync(path.join(outDir, name), s);
  console.log(name, (s.length / 1024).toFixed(1) + 'KB');
};

const INK = '#14110F', CEL = '#FFF6DF', CORAL = '#F2643D', SUN = '#FFC93C', TEAL = '#0E9C97';

// A white cartoon mitt, centred on 0,0.
const mitt = (t) => `<g transform="${t}">
<path d="M-24 6C-33 -15 -16 -33 2 -28C18 -33 33 -20 28 0C33 16 16 28 0 24C-13 30 -27 22 -24 6Z" fill="${CEL}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M-7 -27L-5 -9M9 -27L7 -9" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
</g>`;

// ---------- A: the emcee fish ----------
const gilEyes = `
<ellipse cx="108" cy="112" rx="31" ry="40" fill="${CEL}" stroke="${INK}" stroke-width="7"/>
<ellipse cx="164" cy="108" rx="33" ry="43" fill="${CEL}" stroke="${INK}" stroke-width="7"/>
<path d="M101 104A13 21 0 1 0 113 104L107 118Z" fill="${INK}"/>
<path d="M157 100A14 22 0 1 0 171 100L164 115Z" fill="${INK}"/>`;
const gilBody = `
<path d="M136 58C150 18 202 8 240 28C230 44 228 62 230 82Z" fill="${SUN}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M170 34L182 66M202 26L206 66" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
<path d="M286 150C312 118 334 92 356 78C348 122 348 178 356 222C334 208 312 182 286 150Z" fill="${SUN}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M60 150C60 68 152 38 218 68C264 88 288 124 294 150C288 182 264 216 218 234C152 262 60 232 60 150Z" fill="${CORAL}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
<path d="M70 176C92 244 196 252 240 214C196 228 112 218 70 176Z" fill="${CEL}"/>
<path d="M226 118q-18 18 0 36M250 128q-14 14 0 28M226 168q-14 14 0 26" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
const gilMouth = `
<path d="M72 164C92 216 170 226 212 182C172 192 112 190 72 164Z" fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M84 172C112 186 164 190 198 186L192 196C160 202 112 198 92 184Z" fill="${CEL}"/>
<path d="M118 207C134 216 158 214 172 204C160 196 130 196 118 207Z" fill="${CORAL}"/>`;
const legs = `
<path d="M140 248C138 278 132 298 120 312M196 244C204 274 212 296 226 310" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
<path d="M78 332C78 306 122 298 138 330Z" fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M210 330C218 298 262 306 268 332Z" fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M92 318q10 -8 22 -6M226 316q10 -8 24 -2" fill="none" stroke="${CEL}" stroke-width="4" stroke-linecap="round"/>`;

// Gil holding a rod up and to the right. The rod tip sits at 356,6 in the file.
write('gil.svg', svg(380, 345, `
${legs}
<path d="M84 228C60 262 36 262 22 236" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
${mitt('translate(22 216) rotate(-18) scale(0.86)')}
<path d="M250 200C282 232 306 214 310 176" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
<path d="M268 216L370 8" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
<path d="M268 216L370 8" fill="none" stroke="${CORAL}" stroke-width="3.5" stroke-linecap="round"/>
<circle cx="288" cy="176" r="11" fill="${SUN}" stroke="${INK}" stroke-width="5"/>
${gilBody}${gilEyes}${gilMouth}
${mitt('translate(308 158) rotate(26) scale(0.86)')}
`));

// A startled Gil, cropped at the body, peeking into the iris.
write('gil-peek.svg', svg(310, 270, `
<path d="M84 228C60 262 36 262 22 236" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
${mitt('translate(24 216) rotate(-30) scale(0.86)')}
${gilBody}${gilEyes}
<ellipse cx="136" cy="186" rx="24" ry="27" fill="${INK}" stroke="${INK}" stroke-width="5"/>
<ellipse cx="136" cy="196" rx="13" ry="13" fill="${CORAL}"/>
`));

write('bobber.svg', svg(64, 96, `
<path d="M32 2V30" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
<circle cx="32" cy="8" r="5" fill="${CEL}" stroke="${INK}" stroke-width="4"/>
<path d="M6 46A26 24 0 0 1 58 46Z" fill="${CORAL}"/>
<path d="M6 46A26 24 0 0 0 58 46Z" fill="${CEL}"/>
<ellipse cx="32" cy="46" rx="26" ry="24" fill="none" stroke="${INK}" stroke-width="5"/>
<path d="M6 46H58" stroke="${INK}" stroke-width="5"/>
<path d="M32 70V92" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<path d="M17 32q5 -8 13 -9" fill="none" stroke="${CEL}" stroke-width="4" stroke-linecap="round"/>
`));

// Pointing mitt: the fingertip sits at the file's left edge, vertically at y=38.
write('glove-point.svg', svg(122, 80, `
<path d="M108 22C122 22 122 58 108 60C101 50 101 32 108 22Z" fill="${CEL}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M12 30C2 30 2 47 12 47L50 47C52 58 66 66 80 64C96 62 106 52 106 40C106 26 96 16 80 15C70 14 62 18 58 24C54 17 44 14 39 19C34 25 39 31 46 30Z" fill="${CEL}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M60 47H78M61 38H82" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
`));

// Repeating fish-scale valance.
write('scales.svg', svg(48, 30, `
<path d="M0 0A24 28 0 0 0 48 0Z" fill="${CORAL}" stroke="${INK}" stroke-width="4"/>
<path d="M24 0V10M12 0q2 8 8 13M36 0q-2 8 -8 13" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
`));

// ---------- B: fish post ----------
const RED = '#E8352E', BLUE = '#1A3FBF', NAVY = '#14246B', AIR = '#E4F0FF';
const slantFish = (x, fill) => `<g transform="translate(${x} 12) rotate(-14) scale(1.05)"><path d="M-17 0C-10 -8 6 -8 11 0L19 -6C18 -2 18 2 19 6L11 0C6 8 -10 8 -17 0Z" fill="${fill}"/><circle cx="-9" cy="-1.4" r="1.7" fill="${AIR}"/></g>`;
write('fish-border-h.svg', svg(96, 24, slantFish(24, RED) + slantFish(72, BLUE)));
write('fish-border-v.svg', svg(24, 96, `<g transform="translate(24 0) rotate(90)">${slantFish(24, BLUE) + slantFish(72, RED)}</g>`));

// A live fish in a knotted pet-shop bag, addressed for delivery.
write('bag-fish.svg', svg(160, 200, `
<path d="M62 44C40 72 18 104 18 136C18 172 44 192 80 192C116 192 142 172 142 136C142 104 120 72 98 44Z" fill="#BFE0FF" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/>
<path d="M21 118C50 108 66 128 84 120C104 112 120 112 139 120C142 150 124 188 80 188C38 188 18 152 21 118Z" fill="#6EA8F5"/>
<g transform="translate(78 150) scale(1.9)"><path d="M-17 0C-10 -9 7 -9 12 0L20 -7C19 -2 19 2 20 7L12 0C7 9 -10 9 -17 0Z" fill="${RED}" stroke="${NAVY}" stroke-width="2" stroke-linejoin="round"/><circle cx="-9" cy="-1.8" r="1.9" fill="${NAVY}"/></g>
<path d="M62 44C68 36 92 36 98 44" fill="none" stroke="${NAVY}" stroke-width="5"/>
<path d="M62 42L52 10M80 40V6M98 42L110 12" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
<path d="M60 36H100" stroke="${RED}" stroke-width="7" stroke-linecap="round"/>
<path d="M40 92C34 104 30 118 30 130" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
`));

// ---------- C: pet-shop tank ----------
const PINK = '#FF3D9A', CYAN = '#2FE3E0', LIME = '#D8FF4F', GRAPE = '#8A3FFC', YOLK = '#FFD400', WHITE = '#FFFFFF', DEEP = '#07365F';
write('gravel.svg', (() => {
  const r = rng(77);
  const W = 1280, H = 170;
  const cols = [PINK, PINK, PINK, CYAN, YOLK, GRAPE, WHITE, '#FF7CBF'];
  let body = `<path d="M0 34C160 8 330 44 520 28C720 12 900 40 1090 22C1170 16 1240 26 1280 30V${H}H0Z" fill="#B3176A"/>`;
  for (let i = 0; i < 1500; i++) {
    const x = r() * W, y = 24 + Math.pow(r(), 0.9) * (H - 24);
    const edge = 34 - 16 * Math.sin(x / 150);
    if (y < edge) continue;
    const rx = 5.5 + r() * 6, ry = 4 + r() * 3.6, a = (r() * 60 - 30).toFixed(0);
    const c = cols[Math.floor(r() * cols.length)];
    body += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${a} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${c}" stroke="#5B0B3C" stroke-width="1.1"/>`;
  }
  return svg(W, H, body);
})());

write('castle.svg', svg(190, 210, `
<g stroke="${DEEP}" stroke-width="5" stroke-linejoin="round">
<path d="M18 204V70H12V40H30V54H42V40H60V54H72V40H90V70H84V100H110V70H104V52H120V62H132V52H146V62H158V52H176V70H170V204Z" fill="#E7C7FF"/>
<path d="M18 204V132C60 120 130 122 170 132V204Z" fill="#C79BFF"/>
<path d="M72 204V162C72 126 118 126 118 162V204Z" fill="#14110F"/>
<path d="M42 84C42 72 60 72 60 84V100H42Z" fill="#14110F"/>
<path d="M130 80C130 70 146 70 146 80V94H130Z" fill="#14110F"/>
</g>
<path d="M51 40V10L78 20L51 30" fill="${PINK}" stroke="${DEEP}" stroke-width="4" stroke-linejoin="round"/>
`));

write('plant.svg', svg(140, 260, `
<g fill="#29E07A" stroke="${DEEP}" stroke-width="4.5" stroke-linejoin="round">
<path d="M68 258C44 208 18 174 26 128C42 164 66 204 76 258Z"/>
<path d="M72 258C64 186 72 118 56 52C92 106 96 186 84 258Z"/>
<path d="M78 258C92 214 118 186 120 132C100 160 80 200 68 258Z" fill="#12BE64"/>
</g>
<path d="M66 96q10 -3 20 4M66 134q12 -3 22 5M72 172q10 -3 16 3" fill="none" stroke="${DEEP}" stroke-width="3" stroke-linecap="round"/>
`));

write('chest.svg', svg(130, 100, `
<g stroke="${DEEP}" stroke-width="5" stroke-linejoin="round">
<path d="M10 52C10 12 120 12 120 52Z" fill="#C2571B"/>
<rect x="10" y="50" width="110" height="44" fill="#E2731F"/>
<path d="M32 26V94M98 26V94" fill="none" stroke="${YOLK}" stroke-width="9"/>
<rect x="54" y="42" width="22" height="24" rx="4" fill="${YOLK}"/>
</g>
<circle cx="65" cy="54" r="3.4" fill="${DEEP}"/>
`));

// Fish-shaped pin: the nose touches the guess at the bottom-centre of the file.
const fishShape = (fill, belly) => `
<path d="M-26 0C-16 -15 10 -16 18 0L34 -13C31 -5 31 5 34 13L18 0C10 16 -16 15 -26 0Z" fill="${fill}" stroke="${DEEP}" stroke-width="3.6" stroke-linejoin="round"/>
<path d="M-22 3C-10 12 8 12 15 3C6 7 -12 7 -22 3Z" fill="${belly}"/>
<circle cx="-13" cy="-3" r="4.5" fill="${WHITE}" stroke="${DEEP}" stroke-width="2.2"/><circle cx="-14" cy="-3" r="1.9" fill="${DEEP}"/>`;
write('fish-pin.svg', svg(64, 96, `
<g transform="translate(32 54) rotate(-90)">${fishShape('#FF7A1A', YOLK)}</g>
<circle cx="50" cy="16" r="4" fill="none" stroke="${WHITE}" stroke-width="2.6"/>
<circle cx="14" cy="9" r="3" fill="none" stroke="${WHITE}" stroke-width="2.4"/>
`));

// Three tank mates for the collection view.
const tankFish = (name, fill, belly) => write(name, svg(76, 44, `<g transform="translate(36 22)">${fishShape(fill, belly)}</g>`));
tankFish('tankfish-a.svg', '#FF7A1A', YOLK);
tankFish('tankfish-b.svg', PINK, '#FFC2E0');
tankFish('tankfish-c.svg', LIME, WHITE);
tankFish('tankfish-d.svg', GRAPE, '#D6BCFF');
