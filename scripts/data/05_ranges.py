"""Stage 5: scoring geometry from GBIF occurrences, with hand-authored anchors as fallback.

Query (cached, paged, <= MAX_RECORDS per species):
  occurrence/search?taxonKey=K&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT
    freshwater/brackish: &country=XX (each native country) + curated bbox
    marine:              curated bbox only (marine records often have no country); two boxes if it wraps

Per-record filters (counted in `dropped`):
  outside curated bbox | country not in native list (freshwater only) | basis LIVING/FOSSIL specimen |
  establishmentMeans/degreeOfEstablishment introduced/managed/captive | coordinate uncertainty > 50 km |
  PRESERVED_SPECIMEN with whole-degree coordinates or within 10 km of a major collection (unless the
  curated bbox is small and contains that collection, e.g. Hobart for the handfishes) |
  isolated single-record cell > 400 km from every other kept cell.

Bins kept records to 0.5 degree cells (cell centres at .25/.75).
method = "gbif-cells" if >= 5 trustworthy records AND >= 1 cell, else "anchors" (from curated.txt).

Writes data/.cache/ranges.json.
usage: python -I scripts/data/05_ranges.py
"""
import math
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, get_json, load_json, save_json  # noqa: E402
from curated import load_curated  # noqa: E402

GBIF = "https://api.gbif.org/v1/occurrence/search"
MAX_RECORDS = 3000
PAGE = 300
MIN_POINTS = 5

# Major natural-history collections (approximate coordinates). Specimens geocoded to these are artefacts.
INSTITUTIONS = [
    (38.891, -77.026), (40.781, -73.974), (41.866, -87.617), (42.378, -71.115), (39.957, -75.171),
    (37.770, -122.466), (34.017, -118.289), (29.636, -82.370), (29.85, -89.99), (42.278, -83.735),
    (38.958, -95.243), (40.10, -88.22), (32.867, -117.253), (33.21, -87.54), (35.78, -78.64), (42.45, -76.48),
    (43.668, -79.395), (45.41, -75.69), (51.496, -0.176), (48.844, 2.356), (52.530, 13.380), (48.205, 16.360),
    (50.118, 8.651), (53.566, 9.975), (48.164, 11.497), (52.165, 4.474), (55.69, 12.58), (59.369, 18.054),
    (50.83, 4.51), (50.837, 4.376), (59.94, 30.30), (43.77, 11.26), (44.40, 8.94), (40.44, -3.69),
    (50.72, 7.11), (50.08, 14.43), (46.199, 6.159), (-33.874, 151.213), (-37.803, 144.971), (-31.95, 115.86),
    (-27.473, 153.018), (-42.886, 147.338), (-41.29, 174.78), (-36.86, 174.78), (-43.53, 172.63),
    (-33.31, 26.52), (-33.93, 18.42), (-23.58, -46.61), (-22.906, -43.226), (-30.06, -51.17), (-3.09, -60.02),
    (-12.07, -77.04), (35.71, 139.77), (36.10, 140.10), (41.80, 140.70), (35.25, 139.15), (1.30, 103.78),
    (30.54, 114.36), (25.13, 102.74), (40.00, 116.39), (25.04, 121.61), (-6.49, 106.85), (9.96, 76.27),
    (22.55, 88.35), (18.93, 72.83), (31.77, 35.20), (32.11, 34.80), (21.30, -157.87), (36.62, -121.90),
]
BAD_ESTABLISHMENT = {"introduced", "managed", "invasive", "naturalised", "captive", "cultivated",
                     "released", "introducedassistedcolonisation", "vagrant"}


def km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2 +
         math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(min(1, a)))


def boxes(b):
    w, s, e, n = b
    return [(w, s, 180.0, n), (-180.0, s, e, n)] if w > e else [(w, s, e, n)]


def in_bbox(lat, lng, b):
    return any(bw <= lng <= be and bs <= lat <= bn for bw, bs, be, bn in boxes(b))


def fetch(key, rec):
    results = []
    for bw, bs, be, bn in boxes(rec["bbox"]):
        base = (f"{GBIF}?taxonKey={key}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT"
                f"&decimalLatitude={bs},{bn}&decimalLongitude={bw},{be}&limit={PAGE}")
        if rec["waterType"] != "marine":
            base += "".join(f"&country={c}" for c in rec["countries"])
        off, total = 0, None
        while off < MAX_RECORDS:
            r = get_json(f"{base}&offset={off}", "gbif_occ")
            if not r:
                break
            total = r.get("count", 0)
            results.extend(r.get("results", []))
            off += PAGE
            if r.get("endOfRecords") or off >= total:
                break
    return results


def cell_of(lat, lng):
    return (math.floor(lat * 2) / 2 + 0.25, math.floor(lng * 2) / 2 + 0.25)


def build(rec, key):
    raw = fetch(key, rec) if key else []
    b = rec["bbox"]
    span = max(b[3] - b[1], (b[2] - b[0]) % 360)
    small_box = span <= 5
    dropped = Counter()
    kept = []
    for o in raw:
        lat, lng = o.get("decimalLatitude"), o.get("decimalLongitude")
        if lat is None or lng is None:
            dropped["noCoord"] += 1
            continue
        if not in_bbox(lat, lng, b):
            dropped["outsideBbox"] += 1
            continue
        if rec["waterType"] != "marine" and o.get("countryCode") not in rec["countries"]:
            dropped["countryNotNative"] += 1
            continue
        basis = o.get("basisOfRecord", "")
        if basis in ("LIVING_SPECIMEN", "FOSSIL_SPECIMEN"):
            dropped["living/fossil"] += 1
            continue
        est = (o.get("establishmentMeans") or "").lower().replace(" ", "")
        deg = (o.get("degreeOfEstablishment") or "").lower()
        if est in BAD_ESTABLISHMENT or deg in BAD_ESTABLISHMENT:
            dropped["notNative"] += 1
            continue
        unc = o.get("coordinateUncertaintyInMeters")
        if unc and unc > 50000:
            dropped["uncertainty>50km"] += 1
            continue
        if basis == "PRESERVED_SPECIMEN":
            if float(lat).is_integer() and float(lng).is_integer():
                dropped["specimenWholeDegree"] += 1
                continue
            near = [(ilat, ilng) for ilat, ilng in INSTITUTIONS if km(lat, lng, ilat, ilng) < 10]
            if near and not (small_box and in_bbox(near[0][0], near[0][1], b)):
                dropped["specimenAtInstitution"] += 1
                continue
        kept.append((lat, lng, basis, o.get("countryCode"), o.get("year")))
    cells = Counter(cell_of(lat, lng) for lat, lng, *_ in kept)
    # isolated singleton cells
    if len(cells) > 3:
        for c, n in list(cells.items()):
            if n == 1:
                others = [d for d in cells if d != c]
                if min(km(c[0], c[1], d[0], d[1]) for d in others) > 400:
                    del cells[c]
                    dropped["isolatedCell"] += 1
                    kept = [k for k in kept if cell_of(k[0], k[1]) != c]
    return raw, kept, cells, dropped


def main():
    cur = load_curated()
    resolved = load_json(os.path.join(CACHE, "resolved.json"), {})
    out = {}
    for i, rec in enumerate(cur):
        key = (resolved.get(rec["id"]) or {}).get("gbifKey")
        raw, kept, cells, dropped = build(rec, key)
        n = len(kept)
        method = "gbif-cells" if n >= MIN_POINTS and cells else "anchors"
        if method == "anchors" and not rec["anchors"]:
            method = "MISSING-ANCHORS"
        lats = [c[0] for c in cells]
        lngs = [c[1] for c in cells]
        out[rec["id"]] = {
            "method": method, "gbifRaw": len(raw), "gbifUsed": n, "dropped": dict(dropped),
            "cells": sorted([[c[0], c[1], k] for c, k in cells.items()]),
            "cellExtent": [min(lngs), min(lats), max(lngs), max(lats)] if cells else None,
            "countries": dict(Counter(k[3] for k in kept)),
            "basis": dict(Counter(k[2] for k in kept)),
            "years": [min((k[4] for k in kept if k[4]), default=None), max((k[4] for k in kept if k[4]), default=None)],
        }
        if i % 20 == 0:
            print(i, rec["id"], method, len(raw), n, len(cells), flush=True)
            save_json(os.path.join(CACHE, "ranges.json"), out)
    save_json(os.path.join(CACHE, "ranges.json"), out)
    c = Counter(v["method"] for v in out.values())
    print("done", dict(c))
    print("missing anchors:", [k for k, v in out.items() if v["method"] == "MISSING-ANCHORS"])


if __name__ == "__main__":
    main()
