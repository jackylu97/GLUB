#!/usr/bin/env bash
# Re-runnable Fishlocator data pipeline. Every API response is cached under data/.cache/, so a re-run only
# hits the network for new candidates or deleted cache entries.
#
# Python: any 3.10+ with Pillow + pyarrow (e.g. `python -m venv venv && venv/bin/pip install pillow pyarrow`).
# Set PY to that interpreter. Always run with -I so nothing is imported from the working directory or from
# download folders; scripts add their own folder to sys.path explicitly.
#
# Hand-curated / hand-reviewed inputs (all in scripts/data/):
#   pool.txt            wide screening pool              -> 01
#   curated.txt         candidate long list with ranges  -> 03..08
#   verification.txt    FishBase/Wikipedia verdicts      -> 08
#   decisions.txt       allow/reject/caps/method         -> 08
#   photo_review.txt    visual review of contact sheets  -> 07, 08
#   facts.json          fun facts, reveal facts, hints   -> 08 (checked by 11_fact_bundles.py check)
set -euo pipefail
cd "$(dirname "$0")/../.."
PY="${PY:-python3}"
S=scripts/data

$PY -I $S/01_prescreen.py all          # GBIF+IUCN, iNat and Wikipedia screen of pool.txt
$PY -I $S/02_fishbase.py               # FishBase parquet subset (verification only)
$PY -I $S/03_resolve.py                # resolve curated candidates; Wikipedia text
$PY -I $S/04_photos_find.py            # openly licensed photo options
$PY -I $S/05_ranges.py                 # GBIF occurrences -> 0.5 degree cells
$PY -I $S/06_sheets.py top             # contact sheets for (re)review -> data/.cache/sheets/
$PY -I $S/07_photos_final.py           # download + resize reviewed choices -> data/photos/
$PY -I $S/11_fact_bundles.py check $S/facts.json   # facts schema + no-leak check
$PY -I $S/08_build.py                  # data/fish.json, candidates.csv, backlog.csv (prunes unused photos)
$PY -I $S/06_sheets.py final           # contact sheets of the final photos
$PY -I $S/10_qa.py                     # validation + QA stats
$PY -I $S/12_landsea_qa.py             # land/sea sanity check of the geometry
