"""Loader for the hand-curated candidate list (curated.txt).

Line format (pipe separated):
  id | scientificName | commonName | region code | water | countries | waterBodies | bbox | anchors | tags | summary

  water      F freshwater, M marine, B brackish
  countries  comma separated ISO 3166-1 alpha-2 (native range only)
  waterBodies semicolon separated
  bbox       W,S,E,N in degrees; W > E means the box crosses the antimeridian
  anchors    lat,lng,radiusKm;lat,lng,radiusKm  (or -) -- hand-authored from the literature
  tags       comma separated habitat tags
"""
import os

from common import HERE, read_pipe_table

REGIONS = {
    "NA": "North America",
    "MCC": "Mexico/Central America/Caribbean",
    "SAM": "South America",
    "EUR": "Europe",
    "AFR": "Africa",
    "MAD": "Madagascar",
    "MEC": "Middle East/Central Asia",
    "SAS": "South Asia",
    "SEA": "SE Asia",
    "EAS": "East Asia",
    "ANZ": "Australia/NZ/New Guinea",
    "PAC": "Pacific islands",
    "RAI": "Remote Atlantic & Indian Ocean islands / open seas",
}
WATER = {"F": "freshwater", "M": "marine", "B": "brackish"}


def _floats(s):
    return [float(x) for x in s.split(",")]


def load_curated(path=None):
    path = path or os.path.join(HERE, "curated.txt")
    out = []
    seen = set()
    for n, row in enumerate(read_pipe_table(path)):
        if len(row) != 11:
            raise ValueError(f"curated.txt row {n}: expected 11 fields, got {len(row)}: {row[:2]}")
        cid, sci, common, reg, water, ctry, wb, bbox, anchors, tags, summary = row
        if cid in seen:
            raise ValueError(f"duplicate id {cid}")
        seen.add(cid)
        if reg not in REGIONS or water not in WATER:
            raise ValueError(f"{cid}: bad region/water {reg}/{water}")
        b = _floats(bbox)
        if len(b) != 4 or not (-90 <= b[1] < b[3] <= 90):
            raise ValueError(f"{cid}: bad bbox {bbox}")
        anc = []
        if anchors and anchors != "-":
            for a in anchors.split(";"):
                lat, lng, r = _floats(a)
                anc.append({"lat": lat, "lng": lng, "radiusKm": r})
        out.append({
            "id": cid, "scientificName": sci, "commonName": common, "regionCode": reg,
            "region": REGIONS[reg], "waterType": WATER[water],
            "countries": [c.strip() for c in ctry.split(",") if c.strip()],
            "waterBodies": [w.strip() for w in wb.split(";") if w.strip()],
            "bbox": b, "crossesAntimeridian": b[0] > b[2], "anchors": anc,
            "habitatTags": [t.strip() for t in tags.split(",") if t.strip()],
            "summary": summary,
        })
    return out
