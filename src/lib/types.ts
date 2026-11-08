import type { Range } from './geo';

/** One labelled hint shown before the guess. Never names the place. */
export type Hint = { label: string; text: string };

/** One fish as the game ships it. Built from the data pipeline by scripts/build-game-data.ts. */
export type GameFish = {
  id: string;
  commonName: string;
  scientificName: string;
  iucn: string | null;
  waterType: string;
  /** Shown only after the guess: a short display name ("Derwent Estuary"), the country line, and the full range sentence. */
  place: string;
  country: string | null;
  rangeSummary: string;
  range: Range;
  photo: {
    src: string;
    /** A small copy for lists and strips. */
    thumb: string;
    author: string;
    license: string;
    licenseUrl: string | null;
    sourceUrl: string | null;
  };
  /** Shown before the guess, so they never name a place. */
  hints: Hint[];
  revealFact: string | null;
  fixture?: boolean;
};
