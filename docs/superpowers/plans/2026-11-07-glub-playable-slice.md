# Glub Playable Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable daily Glub round. Five rare fish, one pin each, scored by distance to each fish's native range, with a reveal after every pin and a shareable summary at the end. Built in the round 3 "Front page, trimmed" design.

**Architecture:** A static Vite + Svelte 5 single-page app. Pure TypeScript modules hold the game rules (geo, scoring, daily pick, persistence, share text) and are unit-tested with Vitest. Svelte components render the newspaper layout. The map is our own d3-geo SVG (Natural Earth projection, halftone land), with d3-zoom for pan and zoom. A build script turns the data pipeline's `data/fish.json` into a slim, spoiler-safe `public/data/fish.json` plus re-encoded photos with hashed file names.

**Tech Stack:**
- svelte 5.57.3, vite 8.3.6, @sveltejs/vite-plugin-svelte 7.3.1, typescript 5.9.3, svelte-check 4.7.8, vitest 5.1.0, jsdom 31.0.0, tsx 4.23.15.
- d3-geo 3.1.2, d3-zoom 3.0.1, d3-selection 3.0.1, topojson-client 3.1.0, world-atlas 2.0.2.
- @fontsource/chango, @fontsource/grandstander, @fontsource/big-shoulders-display 5.3.0.
- sharp 0.35.5 for photos; puppeteer-core 25.16.0 (with the installed Chrome) for the smoke test.

**Spec:**
- `PRODUCT.md`: product truth and owner decisions.
- `.impeccable/surfaces/design-mockups-boards-main-dc-html.md`: the direction contract.
- `design/mockups/boards/R3Trim*.dc.html` and `design/mockups/previews/r3-1-front-page.png`: the approved layout.
- Data schema: the "fish.json record schema" in the brief given to the data agent, mirrored in `data/README.md` when it lands.

## Global Constraints

- **Name and copy:**
  - The name is **Glub**, with the masthead set as "GLUB".
  - The headline on every guess screen is exactly "Where does this fish live?".
  - The folio shows "No. 001", the date, and "Fish N of 5".
- **Removed copy:** no ticker, no side strapline, and no filler or joke copy ("no refunds", "no cash value", moon phase).
- **Game rules:**
  - Five fish a day and one guess per fish.
  - Each fish scores 0–1000 points, so the day's maximum is 5000.
  - Day No. 1 is local date 2026-11-07.
- **Spoilers:** none before the guess.
  - Photo alt text is generic until the reveal, and photo file names are hashed.
  - The photo credit is hidden behind a "Photo credit (spoiler)" disclosure.
  - Clues never name a place.
- **Colour tokens:**

  | Name | Hex |
  |---|---|
  | butter | #FFC93C |
  | ink | #14110F |
  | coral | #F2643D |
  | coral-text | #9A2B12 |
  | teal | #0E9C97 |
  | deep teal | #0A5F5C |
  | cel | #FFF6DF |
  | muted | #5C4A12 |

- **Fonts:** Chango for display, Big Shoulders Display for labels and numerals, Grandstander for text. All self-hosted, with no runtime font CDN.
- **Accessibility:**
  - Colour is never the only signal.
  - Functional text is at least 12px and passes 4.5:1 contrast.
  - Motion respects `prefers-reduced-motion`, using ease-out curves and never bounce.
  - All controls are real buttons, links or inputs.
- **Data:** only real fish data ships. Fixture fish are marked `"fixture": true`, and the production build refuses them.

## Review Focus

1. **Drag vs tap:** ending a pan or pinch on the map must not drop a pin. Only a deliberate tap or click places one.
2. **Off the globe:** clicking outside the projected globe (the corners of the frame) places nothing.
3. **Antimeridian:** a pin at 179.9°E and a range anchor at 179.9°W are about 22 km apart, not about 40,000 km.
4. **Resume:** reloading after fish 2 resumes at fish 3 with fish 1–2 scored. Reloading after fish 5 shows the summary. A new local day starts fresh.
5. **Storage blocked:** if `localStorage` throws (private mode, blocked storage), the game is still fully playable for the session.

---

### Task 1: Scaffold and geo

**Files:**
- Create: `package.json`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.svelte` (placeholder), `.gitignore`
- Create: `src/lib/geo.ts`
- Test: `tests/geo.test.ts`

**Interfaces:**
- Produces:
  - `type LatLng = { lat: number; lng: number }`
  - `type Range = { cells: [number, number][]; anchors: { lat: number; lng: number; radiusKm: number }[] }`. Cells are `[lat, lng]`, matching the data schema.
  - `haversineKm(a: LatLng, b: LatLng): number`, using earth radius 6371 km.
  - `bearingDeg(from: LatLng, to: LatLng): number`, the initial bearing in 0–360.
  - `compass8(deg: number): 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'`
  - `CELL_RADIUS_KM = 35`
  - `distanceToRange(p: LatLng, r: Range): { km: number; nearest: LatLng }`. The distance is `max(0, haversine − radius)` minimised over every anchor and cell. `nearest` is that anchor or cell's centre.

- [ ] **Step 1:** Scaffold with the pinned versions. Scripts: `dev`, `build`, `preview`, `test` (`vitest run`), `check` (`svelte-check`).
- [ ] **Step 2:** Write the failing tests in `tests/geo.test.ts`:
  - `haversineKm({lat:-43.53,lng:172.64},{lat:-42.95,lng:147.33})` rounds to 2043.
  - The same call from Melbourne `{lat:-37.81,lng:144.96}` rounds to 606.
  - `bearingDeg` from Christchurch to Hobart rounds to 263, and `compass8(263)` is `'W'`.
  - **Antimeridian:** `haversineKm({lat:0,lng:179.9},{lat:0,lng:-179.9})` is less than 25.
  - A pin inside an anchor's radius gives `km === 0`.
  - A pin 100 km from a 30 km anchor gives a `km` within 1 of 70.
  - With an empty range, `distanceToRange` returns `km: Infinity`.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (module missing).
- [ ] **Step 4:** Implement `src/lib/geo.ts`.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.

### Task 2: Scoring and share text

**Files:**
- Create: `src/lib/score.ts`, `src/lib/share.ts`
- Test: `tests/score.test.ts`, `tests/share.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pointsFor(km: number): number`. It returns 1000 when `km <= 0`, otherwise `Math.round(1000 * Math.exp(-km / 1500))`, and 0 for non-finite input.
  - `type Band = 'whopper'|'prize'|'keeper'|'minnow'|'boot'`
  - `bandFor(km: number): Band`. Whopper is 0, prize is under 500, keeper under 1500, minnow under 4000, and anything further is boot.
  - `BAND_LABEL: Record<Band,string>`: Whopper, Prize, Keeper, Minnow, Old boot.
  - `shareText(dayNumber: number, results: { km: number; points: number }[]): string`

- [ ] **Step 1:** Write the failing tests:
  - `pointsFor`: `pointsFor(0)` is 1000, `pointsFor(606)` is 668, `pointsFor(2043)` is 256, and `pointsFor(Infinity)` is 0.
  - `bandFor` at the boundaries: 0 is whopper, 499 is prize, 500 is keeper, 3999 is minnow, 4000 is boot.
  - `shareText(1, results)` equals the expected text, where `results` is km 0, 200, 1000, 3000 and 9000 with `pointsFor` of each (1000, 875, 513, 135, 2):

    ```
    Glub No. 1 · 2,525 / 5,000
    🐳🐟🐠🦐🥾
    ```

    The emoji follow band order: whopper 🐳, prize 🐟, keeper 🐠, minnow 🦐, boot 🥾.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement both modules. Format numbers with `toLocaleString('en-US')`.
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 3: Daily pick

**Files:**
- Create: `src/lib/daily.ts`
- Test: `tests/daily.test.ts`

**Interfaces:**
- Produces:
  - `LAUNCH = { y: 2026, m: 11, d: 7 }`
  - `dayNumber(date: Date): number`. Compute it from the local Y-M-D through `Date.UTC`, so DST can't shift it. Launch day is 1.
  - `pickDaily<T extends { id: string }>(fish: T[], day: number, count = 5): T[]`
  - `msUntilNextDay(now: Date): number`

- [ ] **Step 1:** Write the failing tests:
  - `dayNumber(new Date(2026,10,7,0,1))` is 1, `new Date(2026,10,7,23,59)` is 1, and `new Date(2026,10,8,0,0)` is 2.
  - With 12 fixture ids:
    - Results are deterministic (the same day gives the same ids).
    - The 5 ids for a day are distinct.
    - Days 1 and 2 share no fish.
    - Across days 1–2 plus the first 2 of day 3, all 12 ids appear (a whole cycle before any repeat).
  - `pickDaily` of 3 fish returns 3.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement a deck. Sort by id, then for global slot `k = (day-1)*count + i` use `cycle = floor(k/N)` and `pos = k % N` into a mulberry32 shuffle seeded from FNV-1a of `` `glub-${cycle}` ``. If a cycle boundary repeats an id within the same day, skip to the next slot.
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 4: Game state and persistence

**Files:**
- Create: `src/lib/game.ts`, `src/lib/storage.ts`
- Test: `tests/game.test.ts`, `tests/storage.test.ts`

**Interfaces:**
- Consumes: `distanceToRange` (Task 1), `pointsFor` (Task 2).
- Produces:
  - `type Guess = { pin: LatLng; km: number; points: number; nearest: LatLng }`
  - `type DayState = { day: number; fishIds: string[]; guesses: (Guess|null)[] }`
  - `newDay(day: number, fishIds: string[]): DayState`
  - `currentIndex(s: DayState): number`. Returns `fishIds.length` when the day is done.
  - `applyGuess(s: DayState, pin: LatLng, range: Range): DayState`. Pure; it fills the current slot.
  - `total(s: DayState): number`
  - `type Stats = { played: number; streak: number; best: number; lastDay: number }`
  - `recordFinish(stats: Stats, s: DayState): Stats`. The streak continues only if `lastDay === s.day - 1`, and recording the same day twice changes nothing.
  - `loadDay(day: number): DayState | null`, `saveDay(s: DayState): void`, `loadStats(): Stats`, `saveStats(st: Stats): void`. The storage keys are `glub:v1:day:<n>` and `glub:v1:stats`. Every access is wrapped in try/catch and falls back to an in-memory map.

- [ ] **Step 1:** Write the failing tests:
  - Applying 2 guesses makes `currentIndex` 2. Applying all 5 makes it 5, and a sixth `applyGuess` returns the state unchanged.
  - `recordFinish` on days 1, 2 and 4 gives streaks of 1, 2 and 1. Calling it twice for day 4 doesn't double-count `played`.
  - **Storage blocked (Review Focus 5):** replace `globalThis.localStorage` with an object whose methods throw. `saveDay` then `loadDay` returns the saved state without throwing.
  - **Resume (Review Focus 4):** `saveDay` with 2 guesses, then `loadDay`, gives `currentIndex === 2`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** Run the tests. Expected: PASS.

### Task 5: Game data build

**Files:**
- Create: `scripts/lib/toGameFish.ts`, `scripts/build-game-data.ts`, `fixtures/dev-fish.json`, `src/lib/types.ts`
- Test: `tests/toGameFish.test.ts`

**Interfaces:**
- Produces, in `src/lib/types.ts`:
  - `type GameFish = { id; commonName; scientificName; iucn: string|null; waterType; rangeSummary: string; range: Range; photo: { src; author; license; licenseUrl: string|null; sourceUrl: string|null }; clues: string[]; revealFact: string|null; fixture?: boolean }`
- Produces, in `scripts/lib/toGameFish.ts`:
  - `toGameFish(record: unknown, photoSrc: string): GameFish | null`. It returns null when the photo licence or author is missing, or when the range has no cells and no anchors.
  - Clues come from `funFact`, then `hints.habitat`, then `hints.depth ?? hints.size`. Non-empty values only, at most 3.
- Build script: `npm run data` runs `tsx scripts/build-game-data.ts`.
  - Input: `data/fish.json`, falling back to `fixtures/dev-fish.json` with a console warning. `--production` refuses fixture records.
  - Output: `public/data/fish.json`.
  - Photos: each one is re-encoded with sharp at 1280px max and JPEG quality 82, which also strips EXIF. It is written to `public/data/photos/<sha1(id).slice(0,12)>.jpg`.

- [ ] **Step 1:** Write the failing tests:
  - A schema-shaped record maps to the right `range`, `clues` and `photo` fields.
  - A record missing a licence returns null.
  - A record with empty cells and anchors returns null.
  - Clues are capped at 3.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the transform and the script. Write `fixtures/dev-fish.json` with the real spotted handfish record and four fixture records (`"fixture": true`, names "Fixture fish 2–5", spread-out anchors, all using the handfish photo).
- [ ] **Step 4:** Run the tests, then `npm run data`. Expected: tests PASS, and `public/data/fish.json` has 5 records.

### Task 6: Layout shell and panels

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Create: `src/components/Masthead.svelte`, `src/components/FishPhoto.svelte`, `src/components/Clues.svelte`, `src/components/TideTable.svelte`, `src/components/CastButton.svelte`

**Interfaces:**
- Consumes: `GameFish`, `DayState`, `Guess`, `bandFor`/`BAND_LABEL`.
- Produces, as Svelte 5 props:
  - `Masthead { day: number; date: Date; position: string }`. `position` is a string such as "Fish 2 of 5" or "Today's catch".
  - `FishPhoto { fish: GameFish; revealed: boolean }`. Pre-reveal alt text is "Photo of today's mystery fish". The credit sits in a `<details>` with summary "Photo credit (spoiler)".
  - `Clues { clues: string[] }`
  - `TideTable { fish: GameFish[]; state: DayState }`. Five rows, each with the number, km, compass direction and points. The current row is highlighted coral, and future rows show "—".
  - `CastButton { disabled: boolean; label: string; onclick: () => void }`. A real `<button>` with the dashed coupon edge.
- Layout follows `r3-1-front-page.png`:
  - Desktop (≥ 960px): two columns. The headline, photo and clues sit left. The chart, tide table and cast button sit right.
  - Phone: one column in this order: masthead, headline, photo, clues, chart, cast, tide table.
  - Theme `::selection`, the focus rings and the scrollbar from the tokens.

- [ ] **Step 1:** Build the components and render them from the dev data in `App.svelte`, with the map slot left empty.
- [ ] **Step 2:** Run `npm run check`. Expected: 0 errors.
- [ ] **Step 3:** Screenshot `npm run preview` at 1440×900 and 390×844 with headless Chrome. Compare against `r3-1-front-page.png`: masthead, headline copy, column order.

### Task 7: Chart map

**Files:**
- Create: `src/components/ChartMap.svelte`, `src/lib/mapGeometry.ts`
- Test: `tests/mapGeometry.test.ts`

**Interfaces:**
- Consumes: `LatLng`, `Range`, `distanceToRange`.
- Produces:
  - `ChartMap { pin: LatLng|null; onpin: (p: LatLng) => void; reveal: { range: Range; nearest: LatLng } | null; locked: boolean }`
  - `screenToLatLng(projection, point: [number,number]): LatLng | null`. It returns null when the round trip `projection(invert(p))` misses `p` by more than 0.5 units, i.e. off the globe.
  - `rangeFeatures(range: Range): GeoJSON.FeatureCollection`. Anchors become `geoCircle` polygons with radius `radiusKm/111.32`°. Cells become 0.5° squares.

- [ ] **Step 1:** Write the failing tests:
  - **Off the globe (Review Focus 2):** with `geoNaturalEarth1().fitExtent([[14,14],[986,506]],{type:'Sphere'})`, `screenToLatLng` at `[2, 2]` is null.
  - At the projected Hobart point it is within 0.1° of Hobart.
  - `rangeFeatures` with 1 anchor and 2 cells has 3 features.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the module and the component:
  - **Drawing:** a 1000×520 viewBox with Natural Earth 1, a dashed graticule, and 50m land with a coral halftone `<pattern>` fill and ink stroke (`vector-effect: non-scaling-stroke`).
  - **Pan and zoom:** d3-zoom with scale 1–12 and translate extent equal to the viewBox.
  - **Placing pins:** pins go down on d3's `click`, which d3-zoom already suppresses after a drag (Review Focus 1). The pin stays constant size under zoom.
  - **Controls:** zoom +/− buttons. Keyboard: arrows pan, +/− zoom, Enter drops a pin at the view centre.
  - **Reveal:** when `reveal` is set, draw the range shapes in coral with ink, plus a dashed great-circle line from the pin to `nearest`, and zoom to fit both.
- [ ] **Step 4:** Run the tests and `npm run check`. Expected: PASS, 0 errors.

### Task 8: Game flow, summary, smoke test

**Files:**
- Modify: `src/App.svelte`
- Create: `src/components/Reveal.svelte`, `src/components/Summary.svelte`, `scripts/smoke.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `App` flow: aim → cast → reveal → next fish → … → summary.
  - `Reveal { fish: GameFish; guess: Guess; isLast: boolean; onnext: () => void }`. It shows "Found in {rangeSummary}", km, compass direction, points and band, the common and scientific names, the IUCN code, `revealFact`, and the full credit.
  - `Summary { fish: GameFish[]; state: DayState; stats: Stats }`. It shows the total out of 5,000, five result rows, Played / Streak / Best, a Share button (`navigator.share`, falling back to the clipboard, with a visible "Copied" state), and a countdown to the next local day.

- [ ] **Step 1:** Wire the flow with `$state` and persist after each cast. On load: `dayNumber(now)` → `pickDaily` → `loadDay ?? newDay` → `currentIndex`.
- [ ] **Step 2:** Write `scripts/smoke.mjs` using puppeteer-core with `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. It should:
  - Open the preview and tap the chart near the centre, then Cast and Next, five times.
  - Assert the summary shows "/ 5,000".
  - **Resume (Review Focus 4):** reload and assert the summary is still shown.
  - **Drag vs tap (Review Focus 1):** on a fresh day, a mouse drag across the chart leaves Cast disabled.
  - Screenshot desktop (1440) and mobile (390) for the aim, reveal and summary states into `.impeccable/review/`.
- [ ] **Step 3:** Run `npm run build && npm run preview & node scripts/smoke.mjs`. Expected: "smoke ok", plus the screenshots.
- [ ] **Step 4:** Run `npm test && npm run check`. Expected: all PASS, 0 errors.
