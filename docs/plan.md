# Fishlocator plan

Working title. Draft, 2026-11-07.

## The game in one paragraph

**Decided in round 4:** every day, everyone gets the same five rare fish. For each one you see the photo and a few spoiler-free clues, and get one pin on the world map. Each fish scores up to 1,000 points depending on how close the pin lands to its native range, so a day is worth up to 5,000. After each pin, the map shows the real range and a short reveal. After the fifth, you get the day's total, a catch-size breakdown, and something to share. The build plan is `docs/superpowers/plans/2026-11-07-glub-playable-slice.md`.

*The original draft of this section described one fish a day with three tries and clues. It is kept below for reference, but round 4 replaced it.*

## What's in the repo now

| Path | What it is |
|---|---|
| `PRODUCT.md` | Product record: who it's for and the principles. Facts marked *(inferred)* need your confirmation. |
| `docs/plan.md` | This plan. |
| `docs/research/map-providers.md` | Map provider research with sourced prices and terms, read 2026-11-07. |
| `design/mockups/` | Three design directions: board sources, art, map generators, and preview PNGs. |
| `data/`, `scripts/data/` | The fish dataset and the pipeline that builds it (first pass in progress). |

Mockups canvas: https://claude.ai/artifact/2DwfeF1u3Uj9UEUNp6pTVL

## Core loop

1. **See the fish.** The photo is the hero. One visual clue appears with it (for the handfish: "those are hands, it walks").
2. **Place a pin.** Pan and zoom the map, tap to place, then confirm. Tapping places the pin and a separate button confirms it, so fat-finger mistakes cost nothing.
3. **Feedback after a miss:** distance, a compass arrow, and the next clue. Clue order goes from looks, to habitat (fresh or salt water, depth), to a broad region nudge on the last try.
4. **Reveal.** The map zooms or irises to the native range and draws a line from your pin to it. Then the catch size, the fish's name, two sourced facts, its IUCN status, and the photo credit.
5. **Share.** A text block for group chats, plus an image card for social media.

### Scoring

- Distance is great-circle km from the pin to the **nearest point of the native range**, and 0 if you're inside it. Range geometry comes from the data pipeline (occurrence cells or hand-placed anchors).
- The best of your tries counts, and hitting the range ends the round early.
- Score bands (first draft, tune after playtesting): Home (inside the range) / under 500 km / under 1,500 km / under 4,000 km / further. Each direction names the bands its own way: Whopper → Old boot, Signed for → Lost in the post, Home! → Wrong ocean.
- Bands rather than points keep it friendly. A rank ladder shows where you landed, marked by shape and position as well as colour.

### Share text (draft)

```
Fishlocator No. 1  🎣
2,043 km ↖
  410 km ←
  Home! 🐟
```

The direction arrows point from each guess toward the answer, which a reader who never saw your guesses can't use to find the fish.

### Daily schedule

- One fish per local calendar day, like Wordle. A seeded schedule file maps each date to a fish id.
- Schedule rules: no two days in a row from the same region, alternate freshwater and marine, and spread hard fish (cave fish, single-lake endemics) through the week.
- 150 fish is about five months. Adding fish needs to be a routine content task, not a code change.

## Design direction

Three directions are on the canvas, each shown as a desktop guess screen, a phone guess screen, and a phone answer screen, all using real data for the spotted handfish:

- **A. The Daily Reel.** A 1930s-style rubber-hose cartoon. Gil, the emcee fish, casts a line to your pin, and the answer arrives as an iris closing on the fish's home. Each day is a "Reel", which works for film and for fishing. Most character, and most animation work.
- **B. Fish Post.** A sorting office for lost fish. The photo is the stamp, the map is the address, and the clues are a customs form. The answer is a postcard from the fish ("Greetings from TASMANIA", with the photo filling the letters), which is also the best share image of the three. My pick for shareability.
- **C. The Tank.** A pet-shop tank seen front on: neon hood, pink gravel, plastic castle. You *release* the fish into its home waters. Every round adds a fish to your own tank, which gives the streak a reason to exist. Loudest and most toy-like.

Things that carry over whichever you pick:

- **One verb per direction** (Cast / Send / Release), used everywhere.
- **No location spoilers before the guess.** Photo credits sit behind a "spoiler" link on the guess screen, because an author or agency name like "CSIRO" can give away the answer. Full credit shows on the answer screen.
- **Results aren't shown by colour alone.** Ladders use fill, outline weight, and position.
- **Every fish is real.** Sample numbers on the canvas (streak, guess, day) are marked as samples.

## Map

**Recommendation: render the map ourselves from Natural Earth data (public domain), with no tile provider and no per-load bill.** The research is in `docs/research/map-providers.md`. Its headline numbers:

| Option | ~100k players/day | ~1M players/day |
|---|---|---|
| Own Natural Earth, static files | $0–5/mo | ~$5/mo |
| Protomaps tiles on Cloudflare R2 | ~$49/mo | ~$486/mo |
| Stadia Maps (best commercial) | ~$2,125/mo | ~$22,375/mo |
| Mapbox | ~$8,050/mo | ~$75,550/mo |

Commercial providers also fail the brief on style. The wobbly, hand-cut coastlines are geometry, not a colour change, and every vendor "spend cap" works by switching your map off on your best day.

**Where I differ from the research doc:** it recommends MapLibre GL JS for rendering. MapLibre only does Web Mercator or a globe, so it can't draw the rounded Natural Earth projection the mockups use, which is a big part of their charm. My call is to **spike both for a day before committing**:

- **d3-geo + canvas.** Project the geometry once, then pan and zoom by transforming the cached shapes, with pinch and drag from `d3-zoom`. It supports any projection, total art control, and 180° cutting for free. The risk is phone performance at high zoom with 1:10m detail, handled by switching detail levels (110m, 50m, 10m) as you zoom.
- **MapLibre GL JS.** Gestures and GPU rendering are proven. The cost is Mercator (huge Greenland, clipped poles), plus baking our own wobbly tiles.

Spike pass criteria: smooth pinch-zoom on a mid-range Android phone, pin placement accurate to 5 km at max zoom, and a range shape crossing 180° drawn correctly (e.g. Fiji).

Known data limit: Natural Earth rivers are only good to about 1:30M. That's fine for big rivers and lakes, but not for a fish that lives in one stream. Scoring is distance-based, so you don't need the stream on the map to score well. Test the 150-fish list against it before reaching for HydroRIVERS.

## Data

Status and numbers are in `data/README.md` once the first pass finishes. The approach:

- **Selection:** about 150 fish, IUCN CR/EN/VU (or documented extreme rarity), each with a range narrow enough to make a pin drop meaningful. Hard quotas spread them across 13 world regions, roughly 60/40 freshwater to marine.
- **Range geometry:** a curated text range and country list, cross-checked against FishBase native and endemic records and Wikipedia. Scoring geometry comes from filtered GBIF occurrences binned to 0.5° cells, or hand-placed anchors for one-cave and one-lake species. Raw GBIF can't be trusted as-is: a Tasmania-only fish showed records in Greece and Sweden.
- **Photos:** CC0, public domain, CC BY, and CC BY-SA only. No NC or ND, so ads stay possible later. Each record keeps author and licence. Photos were reviewed by eye for quality and for anything that gives away the location.
- **Facts and hints** come only from cited sources, written in our own words. Hints shown before the guess must not name the place.

**Photo rules for the app:**

- Re-host photos under hashed file names and strip EXIF data. File names and GPS tags are spoilers.
- A BY-SA photo we crop or composite becomes an adaptation, which we must share under BY-SA with credit. The postcard letter-fill in direction B counts.

## Proposed stack (your call)

- **Front end:** Vite + Svelte 5 + TypeScript, as a static build. It's small, fast, and good at the state-driven animation all three directions need. Preact would also be fine.
- **Hosting:** Cloudflare Pages for the site, map data, and photos, with a tiny Worker only if we later want server-side checking of answers.
- **State:** `localStorage` for streaks and history to start, with accounts and sync later if people ask.
- **Analytics:** Cloudflare Web Analytics or Plausible. No cookie banner needed.
- **Share images:** pre-rendered per-fish cards at build time. No server rendering needed for v1.

## Milestones

1. **Decide** (you): direction, name, stack, and whether ads or commercial use are ever in scope.
2. **Map spike** (1–2 days): d3 canvas vs MapLibre against the pass criteria above. Choose one.
3. **Playable slice** (about a week): one fish, pin, three tries, scoring, reveal, and share text, in the chosen direction, on phone and desktop.
4. **Content hardening:** finish the 150, spot-check every range on a map, run the photo pipeline (resize, strip EXIF, hashed names), and generate the schedule.
5. **Launch polish:** signature animation, accessibility pass (keyboard and screen-reader pin entry via a place-name search built from Natural Earth names), installable app, share cards, domain.
6. **After launch:** archive of past fish, the collection mechanic, more fish, translations.

## Open decisions for you

1. **Which round 3 iteration.** The name is **Glub** and the structure is the newspaper almanac (round 2, variant 2), made less loud. Round 3 on the canvas has three takes: Front page, trimmed (closest to round 2), Puzzle page (calmest; the game in one boxed puzzle), and Tabloid (loud type, fewest words).
2. **Name: Glub (decided).** A search found no daily game called Glub. "Glub Inc." is an unrelated group-social app, and a few small itch.io games use "Glub" in their titles. Not trademark-checked yet.
3. **Commercial or not.** This decides which photo licences and map options are allowed. The current rules assume ads might happen.
4. **Stack**, or leave it to me (Svelte above).
5. **Difficulty.** Three tries with clues is my draft. Four tries, or a no-clue hard mode, are easy to add.

## Risks

- **Wrong ranges** make the game feel broken. That's why there's cross-checking and the anchor method, but every fish still needs a human glance before it ships.
- **Photo supply.** Many rare fish only have NC-licensed photos. Expect some favourites to miss the cut, or to need us to ask photographers for permission.
- **Phone map performance**, if d3 wins the spike. Detail switching is the mitigation, and MapLibre is the fallback.
- **Tiny ranges can feel unfair.** A cave in Iraq is a pinprick. Distance bands soften this, and the region nudge on the last try helps.
