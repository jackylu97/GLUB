# Product

<!-- impeccable:product-schema 1 -->

Facts marked (inferred) were not stated by the owner. They were inferred from the original brief without an interview and need confirming.

## Platform

web

## Stack

Undecided. Proposed in `docs/plan.md`; the owner has not chosen yet.

## Users

(inferred) Daily-puzzle players on a phone during a coffee or commute, the people who already keep a morning streak in a word or geography game. Secondary: aquarium and nature nerds, families playing together.

## Product Purpose

A daily browser game. Everyone sees the same photo of a rare fish each day and guesses where in the world it is native by placing a pin on a map. (inferred) Success means people come back tomorrow and share their result, and they leave knowing a fish they had never heard of.

## Positioning

(inferred) The only daily geography game whose answer is a living, usually endangered animal. The answer is a place plus a creature worth meeting, so every round ends with a small discovery instead of just a score.

## Operating Context

(inferred) One round a day, about two minutes, one-handed on a phone is the most common case; desktop also matters. The result gets pasted into a group chat.

## Capabilities and Constraints

- Five fish a day, the same five for everyone, from a curated list of about 150 rare fish (owner, round 4).
- One guess per fish: place a pin on a world map. Each fish is scored by how close the pin lands to its native range, and the day's score is the total (owner, round 4).
- 150 fish at five a day is 30 days before repeats. The list has to keep growing (inferred).
- An archive of the last two weeks of issues is playable from the front page. Back issues don't count towards streaks or stats (owner asked for the archive in round 6; the streak rule is inferred).
- Issue No. 1 is 24 Oct 2026, moved back two weeks so the archive has issues at launch. Daily fish come from an append-only schedule, `data/schedule.json`, which never changes a day already published.
- Photos must be openly licensed with attribution shown (inferred; data pipeline allows CC0, PDM, CC BY, CC BY-SA only).
- The photo must remain clearly legible, because it is the only evidence the player has (inferred).
- Rounds and hints must never leak the location before the answer (inferred).
- Before the guess, each fish shows labelled hints: climate and hemisphere, fresh or salt water with habitat, depth, size, and a fact (owner asked for more informative hints in round 8; the hint set is inferred). Never the region (owner, round 9). Location clues written as fun facts are under consideration (round 9).
- Undecided: monetisation.

## Brand Commitments

- Fun and whimsical design language (owner).
- Really emphasise the fish (owner). Fish should be all over the identity, not a logo on a generic quiz.
- Direction A (the cartoon "Daily Reel" palette and energy) is chosen (owner, round 2).
- No mascot characters or pointing-hand illustrations. Get the energy from type, layout, and decorative pattern rather than vectors or illustration (owner, round 2).
- Existing daily games are the reference point for structure and rituals (owner, round 2).
- Name: **Glub** (owner, round 3). Earlier candidates were Fishlocator (working title) and Plaice. Not trademark-checked; "Glub Inc." is an unrelated group-social app.
- Voice: light on flavour text. Jokes stay in the facts and the headline-style clues, not in filler copy (owner, round 3).
- Buttons, instructions, statuses, labels and errors are plain and informative: they say what happens next or what the number means. Silliness lives only in the headline and decoration (owner, round 8).

## Evidence on Hand

- `data/` holds the fish dataset as it is assembled: photos, licences, native ranges.
- No users, testimonials, press, or metrics exist. Don't fabricate any.

## Product Principles

(inferred)

1. The fish is the star. Every screen is an excuse to look at a strange animal.
2. Being wrong is funny, never punishing. A terrible guess should still make someone smile.
3. Facts are real. Ranges, statuses, and fun facts are sourced, and uncertain data is left out rather than guessed.
4. These animals are rare. Be playful with the game and respectful about the fish: no jokes about eating them, a way to learn more on every reveal.

## Accessibility & Inclusion

(inferred) Colour must never be the only signal for distance or result. Reduced-motion support for any swimming or bobbing animation. Map guesses must be possible without precise pointer control.
