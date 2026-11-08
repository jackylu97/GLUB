import type { Anchor, Range } from '../../src/lib/geo';
import type { GameFish, Hint } from '../../src/lib/types';

/** A trimmed string, or null for empty values and the pipeline's literal "None". */
const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'none' ? v.trim() : null;

/** Climate band and side of the equator, from the latitudes of the range. */
export function climateHint(range: Range): string | null {
  const lats = [...range.cells.map(([lat]) => lat), ...range.anchors.map((a) => a.lat)];
  if (lats.length === 0) return null;
  const mean = lats.reduce((a, b) => a + b, 0) / lats.length;
  const abs = Math.abs(mean);
  const band = abs < 23.5 ? 'Tropical' : abs < 35 ? 'Subtropical' : abs < 50 ? 'Temperate' : abs < 66.5 ? 'Cold' : 'Polar';
  const side =
    Math.min(...lats) < -2 && Math.max(...lats) > 2
      ? 'on both sides of the equator'
      : mean < 0
        ? 'south of the equator'
        : 'north of the equator';
  return `${band}, ${side}`;
}

const WATER: Record<string, string> = {
  freshwater: 'Fresh water',
  marine: 'Sea water',
  brackish: 'Brackish water, where fresh and salt water mix',
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryLine(codes: unknown): string | null {
  const names = (Array.isArray(codes) ? codes : [])
    .map((c) => text(c))
    .filter((c): c is string => c !== null)
    .map((c) => {
      try {
        return regionNames.of(c.toUpperCase()) ?? c;
      } catch {
        return c;
      }
    });
  if (names.length === 0) return null;
  if (names.length <= 2) return names.join(' & ');
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`;
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function cellsOf(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  return v.filter((c): c is [number, number] => Array.isArray(c) && num(c[0]) && num(c[1])).map(([lat, lng]) => [lat, lng]);
}

function anchorsOf(v: unknown): Anchor[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((a: any) => a && num(a.lat) && num(a.lng) && num(a.radiusKm))
    .map((a: any) => ({ lat: a.lat, lng: a.lng, radiusKm: a.radiusKm }));
}

/**
 * Turns one data-pipeline record into a game record, or null when it isn't safe to ship:
 * a photo without licence and author, a photo flagged as a location spoiler, or no range geometry.
 */
export function toGameFish(record: unknown, photoSrc: string, thumbSrc = photoSrc): GameFish | null {
  const r = record as any;
  if (!r || typeof r !== 'object') return null;

  const id = text(r.id);
  const commonName = text(r.commonName);
  const scientificName = text(r.scientificName);
  const license = text(r.photo?.license);
  const author = text(r.photo?.author);
  if (!id || !commonName || !scientificName || !license || !author) return null;
  if (r.photo?.spoilerRisk === true) return null;

  const range = { cells: cellsOf(r.range?.cells), anchors: anchorsOf(r.range?.anchors) };
  if (range.cells.length === 0 && range.anchors.length === 0) return null;

  const h = r.hints ?? {};
  const water = WATER[text(r.waterType) ?? ''] ?? null;
  const habitat = text(h.habitat);
  const hints: Hint[] = [
    { label: 'Clue', text: text(r.locationClue) },
    { label: 'Climate', text: climateHint(range) },
    { label: 'Water', text: water && habitat ? `${water}. ${habitat}` : (water ?? habitat) },
    { label: 'Depth', text: text(h.depth) },
    { label: 'Size', text: text(h.size) },
    { label: 'About', text: text(r.funFact) },
  ].filter((x): x is Hint => x.text !== null);

  const country = countryLine(r.range?.countries);
  const waterBody = Array.isArray(r.range?.waterBodies) ? text(r.range.waterBodies[0]) : null;

  const fish: GameFish = {
    id,
    commonName,
    scientificName,
    iucn: text(r.iucn?.code),
    waterType: text(r.waterType) ?? 'unknown',
    place: waterBody ?? country ?? text(r.region) ?? 'Somewhere wet',
    country: waterBody ? country : null,
    rangeSummary: text(r.range?.summary) ?? '',
    range,
    photo: {
      src: photoSrc,
      thumb: thumbSrc,
      author,
      license,
      licenseUrl: text(r.photo?.licenseUrl),
      sourceUrl: text(r.photo?.pageUrl) ?? text(r.photo?.sourceUrl),
    },
    hints,
    revealFact: text(r.revealFact),
  };
  if (r.fixture === true) fish.fixture = true;
  return fish;
}
