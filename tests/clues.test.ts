import { describe, expect, it } from 'vitest';
import { clueProblems } from '../scripts/lib/clues';

describe('clueProblems', () => {
  const place = {
    countries: ['JP'],
    waterBodies: ['Lake Tazawa', 'Lake Sai'],
    summary: 'Endemic to the deep caldera Lake Tazawa, Akita Prefecture, Japan',
  };

  it('accepts a clue with no proper nouns', () => {
    const clue = 'Its first home was the deepest lake in its country. Today it survives near a famous volcano.';
    expect(clueProblems(clue, place)).toEqual([]);
  });

  it('flags capitalised words after the start of a sentence', () => {
    expect(clueProblems('It lives near Mount Fuji.', place)).toEqual(['proper noun: Mount', 'proper noun: Fuji']);
  });

  it('flags the country, its demonym and named places even at the start of a sentence', () => {
    expect(clueProblems('Japanese anglers know it well.', place)).toEqual(['names the country: Japanese']);
    expect(clueProblems('Tazawa was its first lake.', place)).toEqual(['names a place: Tazawa']);
    expect(clueProblems('Akita winters are long.', place)).toEqual(['names a place: Akita']);
  });

  it('does not mistake ordinary words in the range summary for place names', () => {
    expect(clueProblems('Endemic fish are rare here.', place)).toEqual([]);
  });

  it('flags clues longer than 170 characters', () => {
    expect(clueProblems(`It ${'x'.repeat(168)}`, place)).toEqual(['too long: 171 characters']);
  });
});
