/**
 * Builds the game's data: data/fish.json (from the data pipeline) → public/data/fish.json,
 * plus photos re-encoded to public/data/photos/<hash>.jpg. Re-encoding strips EXIF, and hashed
 * names keep species and places out of URLs, so neither can spoil a guess.
 *
 * Without data/fish.json it falls back to fixtures/dev-fish.json for development.
 * Usage: npm run data [-- --production]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { dayNumber } from '../src/lib/daily';
import type { GameFish } from '../src/lib/types';
import { extendSchedule, type Schedule } from './lib/schedule';
import { clueProblems, type ClueEntry } from './lib/clues';
import { toGameFish } from './lib/toGameFish';

const root = resolve(import.meta.dirname, '..');
const production = process.argv.includes('--production');
const realData = join(root, 'data/fish.json');
const input = existsSync(realData) ? realData : join(root, 'fixtures/dev-fish.json');
const outDir = join(root, 'public/data');
const photoDir = join(outDir, 'photos');

if (input !== realData) {
  if (production) {
    console.error('data/fish.json is missing; refusing to build production data from fixtures.');
    process.exit(1);
  }
  console.warn('data/fish.json not found: using fixtures/dev-fish.json (development only).');
}

const raw = JSON.parse(readFileSync(input, 'utf8'));
const records: unknown[] = Array.isArray(raw) ? raw : raw.fish;
if (!Array.isArray(records)) throw new Error(`${input}: expected an array of fish records`);

const seen = new Set<string>();
for (const r of records as any[]) {
  if (seen.has(r?.id)) {
    console.error(`Duplicate fish id: ${r?.id}`);
    process.exit(1);
  }
  seen.add(r?.id);
}

if (production && records.some((r: any) => r?.fixture === true)) {
  console.error('Fixture records found; refusing to build production data.');
  process.exit(1);
}

// Location clues are researched separately (data/clues.json, keyed by fish id). A clue that fails the
// giveaway check is left out rather than shipped.
const cluesPath = join(root, 'data/clues.json');
const clues: Record<string, ClueEntry> = existsSync(cluesPath) ? JSON.parse(readFileSync(cluesPath, 'utf8')) : {};
const clueFor = (r: any): string | undefined => {
  const entry = clues[r?.id];
  if (!entry) return undefined;
  const problems = clueProblems(entry.clue, r?.range ?? {});
  if (problems.length === 0) return entry.clue;
  console.warn(`Clue for ${r.id} left out: ${problems.join('; ')}`);
  return undefined;
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(photoDir, { recursive: true });

const fish: GameFish[] = [];
const skipped: string[] = [];
for (const record of records) {
  const r = record as any;
  const hash = createHash('sha1').update(String(r?.id)).digest('hex').slice(0, 12);
  const name = `${hash}.jpg`;
  const thumb = `${hash}-t.jpg`;
  const game = toGameFish({ ...r, locationClue: clueFor(r) }, `/data/photos/${name}`, `/data/photos/${thumb}`);
  const source = r?.photo?.file ? resolve(dirname(input), r.photo.file) : null;
  if (!game || !source || !existsSync(source)) {
    skipped.push(`${r?.id ?? '(no id)'}: ${!game ? 'missing licence, author, range or flagged as a spoiler' : 'photo file not found'}`);
    continue;
  }
  await sharp(source)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(photoDir, name));
  await sharp(source)
    .rotate()
    .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toFile(join(photoDir, thumb));
  fish.push(game);
}

writeFileSync(join(outDir, 'fish.json'), JSON.stringify(fish));

// The schedule is append-only: days up to today keep their fish, so a deploy never changes a
// day people have already played. Only the real dataset's schedule is saved back to data/.
const today = Math.max(1, dayNumber(new Date()));
const schedulePath = join(root, 'data/schedule.json');
const real = input === realData;
const existing: Schedule = real && existsSync(schedulePath) ? JSON.parse(readFileSync(schedulePath, 'utf8')) : {};
const schedule = extendSchedule(existing, fish.map((f) => f.id), real ? today : 0, today + 400);
writeFileSync(join(outDir, 'schedule.json'), JSON.stringify(schedule));
if (real) writeFileSync(schedulePath, JSON.stringify(schedule, null, 1));
console.log(`Wrote ${fish.length} fish to public/data/fish.json from ${input.replace(root + '/', '')}.`);
if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ${skipped.join('\n  ')}`);
