// Local design-time preview of draft artboards: strips the board wrapper, points blob urls
// at the local asset files, and screenshots the boards side by side.
// Usage: node preview.mjs <canvas-dir> <out.png> <board> [board...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [canvasDir, out, ...boards] = process.argv.slice(2);
const map = JSON.parse(fs.readFileSync(path.join(canvasDir, 'assets-map.json'), 'utf8'));
const tmp = path.join(path.dirname(out), 'preview-tmp');
fs.mkdirSync(tmp, { recursive: true });

const frames = boards.map((b, i) => {
  let src = fs.readFileSync(path.join(canvasDir, 'project', b), 'utf8');
  const size = JSON.parse(src.match(/data-props='([^']*)'/)[1]).$preview;
  const helmet = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  const body = src.match(/<\/helmet>([\s\S]*?)<\/x-dc>/)[1];
  let html = `<!doctype html><html lang="en"><head><meta charset="utf-8">${helmet}</head><body>${body}</body></html>`;
  html = html.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => {
    if (!map[id]) throw new Error('unmapped asset ' + id);
    return 'file://' + path.join(canvasDir, 'assets', map[id]);
  });
  const f = path.join(tmp, `b${i}.html`);
  fs.writeFileSync(f, html);
  return { f, ...size };
});

const gap = 20;
const W = frames.reduce((a, f) => a + f.width + gap, gap);
const H = Math.max(...frames.map((f) => f.height)) + gap * 2;
const sheet = path.join(tmp, 'sheet.html');
fs.writeFileSync(sheet, `<!doctype html><body style="margin:0;background:#222;display:flex;gap:${gap}px;padding:${gap}px;align-items:flex-start">${frames
  .map((f) => `<iframe src="file://${f.f}" width="${f.width}" height="${f.height}" style="border:0;flex:none"></iframe>`)
  .join('')}</body>`);
execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
  '--virtual-time-budget=9000', `--window-size=${W},${H}`, `--screenshot=${out}`, 'file://' + sheet,
], { stdio: 'ignore' });
console.log('wrote', out, W, H);
