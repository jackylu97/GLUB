import { describe, expect, it } from 'vitest';
import { climateHint, toGameFish } from '../scripts/lib/toGameFish';

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spotted-handfish',
    scientificName: 'Brachionichthys hirsutus',
    commonName: 'Spotted handfish',
    iucn: { code: 'CR', source: 'GBIF:IUCN', taxonId: '2958' },
    waterType: 'marine',
    region: 'Australia/NZ/New Guinea',
    range: {
      summary: 'Derwent estuary and nearby bays, southeast Tasmania, Australia',
      countries: ['AU'],
      waterBodies: ['Derwent Estuary', 'Frederick Henry Bay'],
      method: 'anchors',
      cells: [[-42.75, 147.25]],
      anchors: [{ lat: -42.92, lng: 147.33, radiusKm: 15 }],
    },
    photo: {
      file: 'photos/spotted-handfish.jpg',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:Handfish.jpg',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
      author: 'Barry Bruce, CSIRO',
      spoilerRisk: false,
    },
    funFact: 'It walks along the sea floor on fins shaped like hands.',
    revealFact: 'The first marine fish listed as critically endangered, in 1996.',
    hints: { habitat: 'Shallow sandy sea floor', size: 'Up to 12 cm', depth: 'Usually 5 to 10 m down', diet: 'Small shrimp and worms' },
    ...overrides,
  };
}

describe('toGameFish', () => {
  it('maps a pipeline record to a game record', () => {
    const fish = toGameFish(record(), '/data/photos/abc.jpg', '/data/photos/abc-t.jpg');
    expect(fish).toMatchObject({
      id: 'spotted-handfish',
      commonName: 'Spotted handfish',
      iucn: 'CR',
      waterType: 'marine',
      rangeSummary: 'Derwent estuary and nearby bays, southeast Tasmania, Australia',
      range: { cells: [[-42.75, 147.25]], anchors: [{ lat: -42.92, lng: 147.33, radiusKm: 15 }] },
      photo: {
        src: '/data/photos/abc.jpg',
        thumb: '/data/photos/abc-t.jpg',
        author: 'Barry Bruce, CSIRO',
        license: 'CC BY 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/3.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Handfish.jpg',
      },
      revealFact: 'The first marine fish listed as critically endangered, in 1996.',
    });
    expect(fish?.fixture).toBeUndefined();
  });

  it('builds labelled hints: climate, water, depth, size and a fun fact, but never the region', () => {
    expect(toGameFish(record(), 'x')?.hints).toEqual([
      { label: 'Climate', text: 'Temperate, south of the equator' },
      { label: 'Water', text: 'Sea water. Shallow sandy sea floor' },
      { label: 'Depth', text: 'Usually 5 to 10 m down' },
      { label: 'Size', text: 'Up to 12 cm' },
      { label: 'About', text: 'It walks along the sea floor on fins shaped like hands.' },
    ]);
  });

  it('puts the location clue first when the fish has one', () => {
    const fish = toGameFish(record({ locationClue: 'Its caves sit under a dry limestone plateau.' }), 'x');
    expect(fish?.hints[0]).toEqual({ label: 'Clue', text: 'Its caves sit under a dry limestone plateau.' });
  });

  it('skips empty hints and the literal text "None"', () => {
    const fish = toGameFish(record({ funFact: '', hints: { habitat: null, depth: 'None', size: 'Up to 12 cm' } }), 'x');
    expect(fish?.hints.map((h) => h.label)).toEqual(['Climate', 'Water', 'Size']);
  });

  it('rejects a photo without a licence or author', () => {
    expect(toGameFish(record({ photo: { ...record().photo, license: '' } }), 'x')).toBeNull();
    expect(toGameFish(record({ photo: { ...record().photo, author: null } }), 'x')).toBeNull();
  });

  it('rejects a photo flagged as a location spoiler', () => {
    expect(toGameFish(record({ photo: { ...record().photo, spoilerRisk: true } }), 'x')).toBeNull();
  });

  it('rejects a record with no range geometry', () => {
    expect(toGameFish(record({ range: { summary: 'x', cells: [], anchors: [] } }), 'x')).toBeNull();
  });

  it('names the place after the first water body and the country in English', () => {
    expect(toGameFish(record(), 'x')).toMatchObject({ place: 'Derwent Estuary', country: 'Australia' });
  });

  it('joins two countries and summarises more', () => {
    const two = record({ range: { ...record().range, countries: ['US', 'MX'] } });
    const four = record({ range: { ...record().range, countries: ['PE', 'BO', 'CL', 'AR'] } });
    expect(toGameFish(two, 'x')?.country).toBe('United States & Mexico');
    expect(toGameFish(four, 'x')?.country).toBe('Peru, Bolivia & 2 more');
  });

  it('falls back to the country when there is no water body', () => {
    const fish = toGameFish(record({ range: { ...record().range, waterBodies: [] } }), 'x');
    expect(fish).toMatchObject({ place: 'Australia', country: null });
  });

  it('keeps the fixture flag', () => {
    expect(toGameFish(record({ fixture: true }), 'x')?.fixture).toBe(true);
  });
});

describe('climateHint', () => {
  const at = (...lats: number[]) => ({ cells: lats.map((lat) => [lat, 0] as [number, number]), anchors: [] });

  it('names the band and the side of the equator', () => {
    expect(climateHint(at(-5, -10))).toBe('Tropical, south of the equator');
    expect(climateHint(at(30, 31))).toBe('Subtropical, north of the equator');
    expect(climateHint(at(45))).toBe('Temperate, north of the equator');
    expect(climateHint(at(60))).toBe('Cold, north of the equator');
  });

  it('says when a range crosses the equator', () => {
    expect(climateHint(at(-8, 8))).toBe('Tropical, on both sides of the equator');
  });

  it('returns null without geometry', () => {
    expect(climateHint({ cells: [], anchors: [] })).toBeNull();
  });
});

describe('fixtures', () => {
  it('still accept the fixture flag', () => {
    expect(toGameFish(record({ fixture: true }), 'x')?.fixture).toBe(true);
  });
});
