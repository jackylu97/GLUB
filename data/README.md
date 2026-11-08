# Fishlocator data

Content dataset for a daily "where is this rare fish native?" pin-drop game. Data only: no app code.
Assembled 2026-11-07 by an automated pipeline plus hand curation and visual review.

| File | What it is |
|---|---|
| `fish.json` | Final records (schema below), sorted by region then id. |
| `photos/<id>.jpg` | One photo per record, re-encoded by Pillow: long edge ≤ 1280 px, JPEG q85, **all metadata stripped** (no EXIF GPS can leak a location). |
| `candidates.csv` | The curated long list (every shortlisted candidate, its range, IUCN code, keys and final status/reason). |
| `backlog.csv` | Every rejected candidate with the reason. `stage=shortlist` rows were curated candidates; `stage=prescreen` rows are names from the wider screening pool (`scripts/data/pool.txt`) that never made the shortlist. |
| `.cache/` | Cached API responses and downloads. **Add `data/.cache/` to `.gitignore`**; it is large and fully re-creatable. |

## At a glance (release of 2026-11-07)

**150 fish** from 245 shortlisted candidates (and a ~650-name screening pool).

| Region | n | | Region | n |
|---|---|---|---|---|
| North America | 11 | | South Asia | 10 |
| Mexico/Central America/Caribbean | 14 | | SE Asia | 13 |
| South America | 13 | | East Asia | 11 |
| Europe | 11 | | Australia/NZ/New Guinea | 14 |
| Africa | 16 | | Pacific islands | 11 |
| Madagascar | 10 | | Remote Atlantic & Indian Ocean islands / open seas | 8 |
| Middle East/Central Asia | 8 | | | |

* Water: 100 freshwater, 43 marine, 7 brackish (67/33; target was ~60/40, see caveats).
* IUCN: CR 50, EN 51, VU 35, EW 1, NT 6, DD 3, NE 4 (every NT/DD/NE has a documented tiny range or extreme
  rarity in `scripts/data/decisions.txt`). One code (butterfly splitfin, CR) comes from iNaturalist's
  IUCN-authority status because GBIF returned no assessment.
* Range geometry: 121 `gbif-cells` (56 of them also carry literature anchors), 29 `anchors` only.
* Photos: CC BY 58, CC BY-SA 68, CC0 7, Public domain 17 · Wikimedia Commons 108, iNaturalist 42 ·
  live-wild 68, aquarium 68, specimen 9, illustration 5 · `spoilerRisk` true: 0.
* Largest single-country counts (first-listed country): USA 11, Brazil 10, Madagascar 10, Australia 10, Mexico 9.


## `fish.json` schema

```jsonc
{
  "id": "spotted-handfish",                  // slug of the common name, stable key
  "scientificName": "Brachionichthys hirsutus",
  "commonName": "Spotted handfish",
  "family": "Brachionichthyidae",            // GBIF backbone (FishBase as fallback)
  "iucn": { "code": "CR", "source": "GBIF:IUCN", "taxonId": "2958" },
  "waterType": "marine | freshwater | brackish",
  "habitatTags": ["estuary", "soft-bottom"],
  "region": "Australia/NZ/New Guinea",       // one of the 13 game regions
  "range": {
    "summary": "...",                         // human text; may name places (reveal side)
    "countries": ["AU"],                      // ISO 3166-1 alpha-2, native range only
    "waterBodies": ["Derwent Estuary"],
    "method": "gbif-cells | anchors",         // which geometry is primary (see below)
    "cells": [[-42.75, 147.25]],              // 0.5° cell centres [lat, lng]; empty when method=anchors
    "anchors": [{ "lat": -42.9, "lng": 147.35, "radiusKm": 25 }],
    "bbox": [146.8, -43.4, 148.0, -42.5],     // W,S,E,N of the scoring geometry (cells ±0.25°, anchors ± radius)
    "crossesAntimeridian": false,             // true when bbox W > E (box wraps across 180°)
    "filterBbox": [...],                      // EXTRA: hand-curated box used to filter GBIF points
    "gbifOccurrencesUsed": 412,               // records behind `cells` (0 when method=anchors)
    "gbifOccurrencesKept": 412,               // EXTRA: trustworthy GBIF records found, even if unused
    "verification": { "fishbase": "agree | conflict | missing", "wikipedia": "agree | conflict | missing", "notes": "" }
  },
  "photo": {
    "file": "photos/spotted-handfish.jpg", "sourceUrl": "...", "pageUrl": "...",
    "source": "wikimedia | inaturalist", "license": "CC BY 4.0", "licenseUrl": "...", "author": "...",
    "kind": "live-wild | aquarium | specimen | illustration", "width": 1280, "height": 853, "spoilerRisk": false
  },
  "funFact": "...",       // shown BEFORE the answer: never names or hints at a place
  "revealFact": "...",    // shown AFTER the answer: may name the place
  "factSources": ["https://..."],
  "hints": { "habitat": "...", "size": "...", "depth": "..." , "diet": "..." },  // pre-answer; size/depth/diet may be null
  "gbifKey": 0, "inatTaxonId": 0, "fishbaseSpecCode": 0
}
```

### Scoring geometry (how to use `range`)
* Score a pin by its great-circle distance to the **nearest** cell or anchor. Treat a cell as a 0.5° square
  centred on the point (≈ 55 km across at the equator) and an anchor as a disc of `radiusKm`; distance 0 inside.
* `method: "gbif-cells"`: ≥ 5 trustworthy GBIF records survived filtering. `cells` is primary. Hand-authored
  `anchors` may also be present (literature localities that GBIF under-samples) and should be included.
* `method: "anchors"`: too few trustworthy points (< 5) or a documented reason to distrust GBIF (e.g. stocked
  reservoirs). Only the anchors score.
* `crossesAntimeridian` is computed from the geometry; the build handles wrap-around (smallest longitudinal
  interval). No record in this release crosses 180°, but consumers should still honour the flag.

## Pipeline (`scripts/data/`, re-runnable)

Run `scripts/data/run_all.sh` (set `PY` to a Python 3.10+ with Pillow and pyarrow). Every script runs with
`python -I` and adds only its own folder to `sys.path`; downloads live in dedicated folders under `data/.cache/`
and are only ever *read* (JSON parse / Pillow decode), never executed or imported.

| Stage | Script | Notes |
|---|---|---|
| 1 | `01_prescreen.py` | ~650-name pool → GBIF match + IUCN (via GBIF), iNat open-licence photo count, Wikipedia lead-image licence. |
| 2 | `02_fishbase.py` | FishBase v25.04 parquet tables (Hugging Face `cboettig/fishbase`) → per-species native/endemic countries, ecosystems, size/depth. Sub-territories (Hawaii, Galápagos, Clipperton …) mapped to ISO2. |
| 3 | `03_resolve.py` | Curated candidates → GBIF key/IUCN, iNat taxon (incl. synonyms via `matched_term`), Wikipedia wikitext (batched 50/request) → plain text. |
| 4 | `04_photos_find.py` | Photo options: Wikipedia lead image, iNat taxon photos, iNat research-grade observations filtered to open licences, Commons search when options are thin. Licence allowlist enforced here. |
| 5 | `05_ranges.py` | GBIF occurrences → filtered → 0.5° cells (rules below). |
| 6 | `06_sheets.py` | 6×4 captioned contact sheets for visual review (`data/.cache/sheets/`). |
| 7 | `07_photos_final.py` | Downloads the reviewed choice, strips metadata, resizes. |
| 8 | `08_build.py` | Merges everything; applies rarity rules and decisions; writes `fish.json`, `candidates.csv`, `backlog.csv`. |
| 9 | `09_review_dump.py` | Compact per-fish text (curated vs FishBase vs GBIF vs Wikipedia) used for verification. |
| 10 | `10_qa.py` | Schema/licence/leak/balance validation and stats. |
| 11 | `11_fact_bundles.py` | Source bundles for fact writing + the leak/schema checker for `facts.json`. |
| 12 | `12_landsea_qa.py` | Land/sea sanity check of cells and anchors against Natural Earth land polygons. |

Hand-maintained inputs: `pool.txt`, `curated.txt` (ranges, anchors, filter boxes), `verification.txt`
(FishBase/Wikipedia verdicts), `decisions.txt` (rarity allowances, rejections, caps, geometry overrides),
`photo_review.txt` (visual review outcome), `facts.json` (fun/reveal facts and hints).

**Network etiquette.** User-Agent `Fishlocator-data/0.1 (daily fish geography game; data assembly)` (no
personal contact details), per-host throttles (iNat 1.1 s, GBIF 0.2 s), 429/5xx back-off honouring
`Retry-After`, and every response cached. Because the UA carries no contact e-mail/URL, Wikimedia classes it as
anonymous (10 requests/minute across all Wikimedia sites); the pipeline therefore shares one 6.5 s throttle
across `en.wikipedia.org`, `commons.wikimedia.org` and `upload.wikimedia.org`, batches Action API calls (50
titles/request), and fetches images from the thumbnail host (`thumb.wikimedia.org`, 2 s) at a standard width,
resizing back down to native resolution. Adding a contact URL to the UA would make re-runs much faster.

### GBIF occurrence filtering (`05_ranges.py`)
Query: `hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT`, restricted to the curated filter
box (two boxes if it wraps) and, for freshwater/brackish species, to the native countries. Up to 3,000 records
per species. Records are then dropped if: outside the box; country not native (freshwater); basis
`LIVING_SPECIMEN`/`FOSSIL_SPECIMEN`; `establishmentMeans`/`degreeOfEstablishment` introduced, managed,
captive, etc.; coordinate uncertainty > 50 km; `PRESERVED_SPECIMEN` with whole-degree coordinates or within
10 km of one of ~70 major natural-history collections (unless the curated box is small and contains that
collection, e.g. Hobart for the handfishes); a single-record cell more than 400 km from all other cells.

## Sources and licensing

* **GBIF** (occurrences, backbone taxonomy, IUCN categories from the IUCN Red List checklist dataset on GBIF).
  Occurrence data are aggregated from many datasets under CC0/CC BY/CC BY-NC; this release ships only derived
  0.5° cells, not records. Cite GBIF.org if the cells are published.
* **IUCN codes** come from GBIF's `/species/{key}/iucnRedListCategory`. Where GBIF returned no assessment the
  code is `NE` and `iucn.source` says so.
* **FishBase** (Froese & Pauly, v25.04 via `cboettig/fishbase`) is **CC BY-NC**. It was used only to *verify*
  ranges and as a source for a few numeric facts (size/depth) and short paraphrased facts; no FishBase tables or
  text are redistributed. Records that used FishBase list its summary URL in `factSources`.
* **Wikipedia** text (CC BY-SA) was read to verify ranges and to write facts; facts are paraphrased, not copied.
  Each record lists the article in `factSources`.
* **Photos** come from Wikimedia Commons and iNaturalist with per-image licences. Allowlist: CC0, Public
  Domain (Commons PD tags and iNaturalist `pd`), CC BY, CC BY-SA. NC/ND/all-rights-reserved images were
  never downloaded for use. **Attribution is required** for every CC BY / CC BY-SA photo: show `author`,
  `license` (+ link) and `pageUrl`. Our resized JPEGs are adaptations; CC BY-SA images must stay under CC BY-SA
  if redistributed. Public-domain items: Commons "Public domain" means a PD template on the file page
  (often US-government work); iNat `pd` is recorded with the Public Domain Mark URL.
* **Natural Earth** land polygons (public domain, via world-atlas@2.0.2) are used only for QA.
* Fun facts, reveal facts and hints were written for this dataset from the sources listed per record.

## Selection rules applied
* Rarity: CR/EN/VU/EW pass. NT/DD/NE pass only with a documented tiny range or extreme rarity
  (`decisions.txt`, `allow` lines). LC and EX are rejected. "Possibly extinct" species were rejected in favour
  of living fish.
* Guessability: multi-ocean or pan-continental ranges rejected; conflicts resolved or backlogged
  (`verification.txt`).
* Balance caps: ≈10 per country, ≤4 sturgeons, ≤4 seahorses, small groups of look-alikes (pupfish/toothcarps,
  goodeids, Salmo trouts, Sri Lankan barbs, rainbowfish). Every cap rejection is in `backlog.csv` and could be
  swapped back in.

## QA

* `10_qa.py`: 150 records, **0 errors**; 1 warning (robertsons-wrasse photo is 454 px). Checks: schema, IUCN
  allow-list, geometry sanity, antimeridian flag consistency, licence allowlist + licence URL, photo file
  exists/≤1280 px/dims match, and **no pre-answer leak**: `funFact` and all `hints` contain none of the
  record's countries (incl. demonyms/states), water bodies, place tokens from `range.summary`, or continent/
  ocean words.
* **Range verification** (`verification.txt`): every candidate's curated range was compared with FishBase's
  native/endemic country rows and the Wikipedia text. In the final 150: FishBase agree 136 / conflict 13 /
  missing 1 (Pnar cavefish, described 2019); Wikipedia agree 145 / conflict 4 / missing 1. All 17 remaining
  conflicts are resolved with a stated reason in `range.verification.notes`, e.g. giant sea bass (both sources
  mention Japan, but FishBase itself treats the NW Pacific fish as *Stereolepis doederleini*; scored on the
  eastern Pacific), McCulloch's anemonefish (Wikipedia adds Norfolk Island; FishBase and GBIF do not support
  it), White's seahorse (Wikipedia's Solomon Islands range reflects an older broad concept; GBIF cells are all
  in NSW). Two candidates went to the backlog over unresolvable conflicts (Ganges shark, beloribitsa).
  The review also **corrected 30+ curated drafts** before scoring: e.g. trondo mainty (Onilahy basin, not the
  highlands), blotched filament barb (Kalu River, not Mahaweli), splendid toadfish (Honduras–Cancún, not
  Cozumel only), Taiwan angelshark (Taiwan shelf only), Madeiran ray (Madeira only), red steenbras (South
  Africa only), Danube salmon country list (FishBase set), halavi guitarfish (Red Sea–Gulf of Oman, not the
  Persian Gulf), Mekong giant catfish (China/Myanmar added), Siamese tiger perch (extirpated from Thailand).
* **Spot checks** (`09_review_dump.py`, `05_ranges.py` summaries): 91 ranges compared cell/anchor extents to the
  text — every marine/brackish species with a filter box wider than 5° (44) plus 47 freshwater ones. Findings
  that changed data: Mekong giant catfish GBIF points were all stocked Thai reservoirs → anchors only;
  Taiwan angelshark's only points sat on Taiwan's inland centroid (artefact); splendid toadfish and Sakhalin
  taimen got extra anchors where GBIF under-samples the documented range; Rocas gregory's GBIF cell at St Peter
  and St Paul Archipelago confirmed Wikipedia's extra locality.
* **Land/sea check** (`12_landsea_qa.py`): 9 records flagged; all are coastline/island artefacts of 0.5° cell
  centres (Hawaiian and Seychelles stream fish, Red Sea / Tasmanian / NSW coastal records, a Madeira anchor
  centred on the island). No misplaced range found.
* **Photos**: every first-choice image (223) and up to 5 alternatives for 92 doubtful ones were viewed on
  captioned contact sheets; 31 candidates were rejected for unusable images (maps, stamps, captioned plates,
  date stamps, watermarks, food/market shots, wrong species, placeholders) and the 150 final JPEGs were viewed
  again after processing.
* **Facts**: written from per-fish source bundles (Wikipedia text + FishBase fields; `11_fact_bundles.py`),
  validated by the automated leak/schema checker, then sample-read for accuracy and tone. Contested points were
  left out (e.g. new vs full moon spawning for the Nassau grouper). No jokes about eating the fish.


## Known caveats

* **Names leak the answer.** Many common and scientific names contain the place (Knysna seahorse, Danube
  salmon, Clarion angelfish, Tequila splitfin, *Latimeria menadoensis*, *Garra ghorensis* …). Only `funFact`
  and `hints` are written to be location-free; show `commonName`/`scientificName` on the reveal screen only.

* **Freshwater-heavy (67/33).** Most narrow-range marine endemics are IUCN LC (e.g. resplendent angelfish,
  Chagos anemonefish, Easter Island butterflyfish) or lack openly licensed photos. They are in `backlog.csv`
  with reason `IUCN LC`; relaxing the rarity rule would add 10+ marine island fish quickly.
* **Thin regions sit exactly at 8** (Middle East/Central Asia; remote Atlantic/Indian Ocean). Iraqi/Iranian
  cavefish, Aral shovelnose sturgeons and most St Helena/St Paul's Rocks endemics have no usable open photo.
* **Anchor precision.** Anchors are hand-placed from the literature locality descriptions with generous radii.
  Least certain: pinstripe damba (lower Sofia floodplain, no GBIF points), Persian sturgeon, kaluga, Tokyo
  bitterling, licorice gourami, Indonesian coelacanth, Siamese tiger perch. All anchors are listed per record.
* **GBIF sampling bias.** Cells show where records exist, not the full range (e.g. giant sea bass cells are on
  the Pacific coast of California/Baja although the range includes the Gulf of California). Anchors were added
  only where a gap was noticed in review.
* **Wide ranges kept on purpose:** Greenland shark (Arctic–North Atlantic), Nassau grouper (Caribbean), West
  African seahorse (Senegal–Angola), angelshark (NE Atlantic–Mediterranean). They are single-basin and still
  give a meaningful pin-drop, but they are the "easy" end of the set.
* **Kunimasu** is scored on Lake Tazawa (its native lake). It now survives only in Lake Saiko, a 1930s
  translocation, which the reveal text explains.
* **Photos:** 21 have a long edge under 800 px (smallest 454 px); 9 are specimens (beach-cast or museum)
  and 5 are illustrations; a few show hands or sampling tubs; white-cloud minnow is a pale captive-bred colour
  form; the Malpelo blenny image has a small ♂ symbol and the Gollum snakehead a tiny scale bar.
  11 public-domain Commons images have no licence URL in Commons metadata (the PD tag is on `pageUrl`).
  `author` is the credit string exactly as published by Commons/iNaturalist, which is occasionally a
  description ("Photo by …"), an organisation or, once, a DOI.
* **Hints:** `size` is null for 2 records, `depth` for 93 and `diet` for 50 where the sources were silent.
  FishBase depth ranges for Hawaiian stream gobies looked like elevations and were dropped.
* **IUCN codes** are GBIF's copy of the Red List and may lag the live list; no IUCN API key was used.
* **FishBase is CC BY-NC**: if the game is monetised, re-check that only facts (not FishBase text) are shown;
  the hints use FishBase numbers (size/depth), which are facts.
* **Wikimedia rate limits:** without a contact URL in the User-Agent, image downloads from Wikimedia are slow;
  a full re-run from an empty cache takes a few hours.

