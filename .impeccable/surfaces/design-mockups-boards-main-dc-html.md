---
version: 1
slug: "design-mockups-boards-main-dc-html"
primary_target: "design/mockups/boards/Main.dc.html"
related_targets: []
---

# Surface brief: the daily round

Scope: one daily round, guess state and answer state. Phone first, desktop second. Mode: experience.
Audience and job: daily-puzzle players on a phone. See today's fish, place a pin, learn where it lives, share the result.
Constraints: the photo stays legible and uncovered. No location spoilers before the guess, including photo credits. Colour is never the only signal for a result.
Owner feedback, round 2: keep direction A. Remove the mascot and the pointing-glove illustrations. Avoid vectors and illustration; get the energy from type, layout, and decorative pattern. Draw on existing daily games. Lean hard into fish.
Owner feedback, round 3: the name is Glub. Go forward with the almanac / newspaper structure (round 2, variant 2), but make it slightly less obnoxious. Less flavour text, and no scrolling ticker.
Owner decisions, round 4: five fish a day, one guess per fish, scored by distance to the native range. Build round 3 iteration 1 (Front page, trimmed), with the headline "Where does this fish live?" from iteration 2 instead of a clue headline.
Owner feedback, round 5:
- Fix margins and overflowing text, and make the page fit the screen.
- Make the animations "absolutely deranged".
- Bring back a scrolling banner that only says "glub glub glub", with glubs covering the entire screen.
- Show the results right after the fifth fish.
- Add a front page, with a button back to it from the results.
Built in round 5:
- A front page.
- A full-width GLUB ticker and drifting glub wallpaper rows.
- Wobbling masthead letters, pin shockwaves, cast bursts of flying GLUBs, slam-in answers, and a full-screen glub flood before the results.
- Every effect is disabled under reduced motion.
Unresolved: the map renderer is d3-geo SVG for the slice; MapLibre stays the fallback if phone performance fails.

## Direction contract

THESIS: A daily cartoon short about one rare fish, told in type. Not the quiet white puzzle grid every daily game ships; a loud, inked, two-strip-colour newspaper page where the fish photo is the lead image and the map is the chart of the day.
OWN-WORLD: Butter newsprint #FFC93C ground, ink #14110F, coral #F2643D, teal water #0E9C97, cel white #FFF6DF. Thick ink rules, two-colour misregistration on the masthead only, fish-scale scallop rules, halftone land on the chart. Fat rounded display face for headlines, a condensed poster face for numerals and section labels, a friendly rounded text face. No mascots or pointing hands.
STORY: The visitor sees five strange fish in turn under the headline "Where does this fish live?", places one pin on the chart for each, sees the real range and a short reveal after every pin, and finishes with a day's catch out of 5,000 worth sharing.
FIRST VIEWPORT: The GLUB masthead with an ink folio box (No., date, Fish N of 5), the headline "Where does this fish live?", the photo at lead-image scale with spoiler-free clues below it, and the chart of the day on the right. The tide table of five fish and a dashed-coupon Cast button sit under the chart. On phones these stack in one column.
FORM: Newspaper almanac front page, trimmed (round 3 iteration 1), structure 7 of 7 on the surface list; seed:c89c19346750147b
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
