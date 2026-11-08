import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clueProblems, type ClueEntry } from '../scripts/lib/clues';

const cluesPath = 'data/clues.json';
const fishPath = 'data/fish.json';
const ready = existsSync(cluesPath) && existsSync(fishPath);

describe.skipIf(!ready)('data/clues.json', () => {
  const clues: Record<string, ClueEntry> = ready ? JSON.parse(readFileSync(cluesPath, 'utf8')) : {};
  const fish: any[] = ready ? JSON.parse(readFileSync(fishPath, 'utf8')) : [];
  const byId = new Map(fish.map((f) => [f.id, f]));

  it('only has clues for fish in the dataset', () => {
    expect(Object.keys(clues).filter((id) => !byId.has(id))).toEqual([]);
  });

  it('never gives the place away', () => {
    const bad = Object.entries(clues)
      .map(([id, c]) => [id, clueProblems(c.clue, byId.get(id)?.range ?? {})] as const)
      .filter(([, problems]) => problems.length > 0);
    expect(bad).toEqual([]);
  });

  it('cites a source for every clue', () => {
    expect(Object.entries(clues).filter(([, c]) => !(c.sources?.length > 0)).map(([id]) => id)).toEqual([]);
  });
});
