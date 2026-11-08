/** Checks a location clue for anything that would give the answer away. */

export type CluePlace = { countries?: string[] | null; waterBodies?: string[] | null; summary?: string | null };

export type ClueEntry = {
  clue: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sources: string[];
  evidence: string[];
  status?: string;
  notes?: string;
};

export const MAX_CLUE_LENGTH = 170;

/** Words that are part of place names but give nothing away on their own. */
const GENERIC = new Set(
  'Lake Lakes River Rivers Island Islands Isle Sea Ocean Gulf Bay Basin Creek Spring Springs Mount Mountains North South East West Upper Lower Great Little Prefecture Province State Region National Park Reef Reefs Cave Caves Plateau Delta Estuary Strait Coast Bank Banks The And'.split(
    ' ',
  ),
);

/** Demonyms that don't share a prefix with the country's English name. */
const DEMONYMS: Record<string, string[]> = {
  FR: ['French'],
  ES: ['Spanish'],
  GB: ['British', 'English', 'Scottish', 'Welsh'],
  US: ['American'],
  NL: ['Dutch'],
  PH: ['Filipino', 'Philippine'],
  CH: ['Swiss'],
  MG: ['Malagasy'],
  IE: ['Irish'],
  NZ: ['Kiwi'],
};

const WORD = /\p{L}[\p{L}'’-]*/gu;
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code: string): string | null {
  try {
    const name = regionNames.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

function placeWords(place: CluePlace): Set<string> {
  const words = new Set<string>();
  for (const body of place.waterBodies ?? []) {
    for (const w of body.match(WORD) ?? []) if (/^\p{Lu}/u.test(w) && !GENERIC.has(w)) words.add(w);
  }
  // Capitalised words in the range summary, except its first word, which is capitalised anyway.
  for (const w of (place.summary ?? '').match(WORD)?.slice(1) ?? []) {
    if (/^\p{Lu}/u.test(w) && !GENERIC.has(w)) words.add(w);
  }
  return words;
}

export function clueProblems(clue: string, place: CluePlace): string[] {
  const problems: string[] = [];
  if (clue.length > MAX_CLUE_LENGTH) problems.push(`too long: ${clue.length} characters`);
  const codes = place.countries ?? [];
  const stems = codes
    .map(countryName)
    .filter((n): n is string => n !== null)
    .map((n) => n.slice(0, 4));
  const demonyms = codes.flatMap((c) => DEMONYMS[c] ?? []);
  const places = placeWords(place);
  for (const sentence of clue.split(/(?<=[.!?])\s+/)) {
    (sentence.match(WORD) ?? []).forEach((w, i) => {
      if (i > 0) {
        if (/^\p{Lu}/u.test(w)) problems.push(`proper noun: ${w}`);
      } else if (stems.some((s) => w.startsWith(s)) || demonyms.includes(w)) {
        problems.push(`names the country: ${w}`);
      } else if (places.has(w)) {
        problems.push(`names a place: ${w}`);
      }
    });
  }
  return problems;
}
