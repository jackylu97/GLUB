"""Stage 10: validate data/fish.json and print QA statistics.

Checks
  * schema: required fields and types; ids unique; photo file exists, long edge <= 1280, dims match
  * licences: allowlist only (CC0, Public domain, CC BY, CC BY-SA); author + licence URL present
  * scoring geometry: >= 1 cell or anchor; lat/lng in range; anchors have radius; bbox/antimeridian flag
  * leakage: funFact and hints must not name the native countries, water bodies, or capitalised place names
    from range.summary (pre-answer text); revealFact may.
  * balance: per region, per country (cap ~10), freshwater/marine mix, look-alike groups (sturgeons,
    pupfish/toothcarps, anemonefish, seahorses, handfish)
usage: python -I scripts/data/10_qa.py [spotcheck_ids_file]
"""
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, DATA, load_json  # noqa: E402

from PIL import Image  # noqa: E402
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location("fact_bundles", os.path.join(os.path.dirname(os.path.abspath(__file__)), "11_fact_bundles.py"))
_FB = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_FB)

ALLOWED = re.compile(r"^(CC0 1\.0|Public domain|CC BY(-SA)? \d\.\d( [A-Z]{2,3})?)$")
GROUPS = {
    "sturgeons": lambda f: f["family"] == "Acipenseridae",
    "pupfish/toothcarps": lambda f: f["family"] in ("Cyprinodontidae", "Aphaniidae", "Valenciidae"),
    "anemonefish": lambda f: f["scientificName"].startswith("Amphiprion"),
    "seahorses": lambda f: f["scientificName"].startswith("Hippocampus"),
    "handfish": lambda f: f["family"] == "Brachionichthyidae",
    "angelsharks": lambda f: f["scientificName"].startswith("Squatina"),
    "goodeids": lambda f: f["family"] == "Goodeidae",
    "rainbowfish": lambda f: f["family"] == "Melanotaeniidae",
    "galaxiids": lambda f: f["family"] == "Galaxiidae",
}
STOP = {"The", "A", "An", "And", "Of", "In", "On", "At", "To", "Its", "It", "From", "With", "Today", "Once",
        "Only", "Rivers", "River", "Lake", "Lakes", "Sea", "Island", "Islands", "Basin", "Mountains", "National",
        "Park", "Reserve", "Plateau", "Peninsula", "Gulf", "Bay", "Valley", "Springs", "Spring", "Coast",
        "North", "South", "East", "West", "Central", "Upper", "Lower", "Northern", "Southern", "Eastern",
        "Western", "Great", "Big", "Little", "New", "Old", "Mount", "Province", "County", "State", "Region"}


def country_names():
    """ISO2 -> list of names (from the FishBase countref table, plus common short forms)."""
    names = {}
    fb = load_json(os.path.join(CACHE, "fishbase_subset.json"), {})
    for rec in fb.values():
        for c in rec.get("countries", []):
            if c.get("iso2") and c.get("country"):
                base = re.sub(r"\s*\(.*\)", "", c["country"]).strip()
                names.setdefault(c["iso2"], set()).add(base)
    extra = {"US": ["America", "American", "United States", "USA", "Texas", "California", "Nevada", "Hawaii",
                    "Hawaiian", "Alabama", "Arizona"],
             "GB": ["Britain", "British", "Wales", "Welsh", "England", "Scotland"], "AU": ["Australia", "Australian",
             "Tasmania", "Tasmanian", "Queensland"], "NZ": ["New Zealand", "Kiwi"], "MX": ["Mexico", "Mexican"],
             "CN": ["China", "Chinese"], "JP": ["Japan", "Japanese"], "IN": ["India", "Indian"],
             "LK": ["Sri Lanka", "Sri Lankan"], "MG": ["Madagascar", "Malagasy"], "BR": ["Brazil", "Brazilian", "Amazon"],
             "ZA": ["South Africa", "Cape"], "ID": ["Indonesia", "Indonesian", "Sulawesi", "Papua"],
             "PG": ["Papua", "New Guinea"], "RU": ["Russia", "Russian", "Siberia", "Siberian"], "IR": ["Iran", "Persian"],
             "CU": ["Cuba", "Cuban"], "EC": ["Galápagos", "Galapagos", "Ecuador"], "SH": ["St Helena", "Ascension"],
             "TH": ["Thailand", "Thai"], "MM": ["Myanmar", "Burma", "Burmese"], "PH": ["Philippines", "Filipino"],
             "CA": ["Canada", "Canadian"], "FR": ["France", "French", "Clipperton"], "IT": ["Italy", "Italian"],
             "GR": ["Greece", "Greek"], "TR": ["Turkey", "Turkish", "Anatolia"], "CM": ["Cameroon"],
             "KE": ["Kenya"], "TZ": ["Tanzania"], "CL": ["Chile", "Chilean", "Andes", "Andean"]}
    for k, v in extra.items():
        names.setdefault(k, set()).update(v)
    return names


def leak_terms(f, cnames):
    """Same forbidden-term list the fact checker (11_fact_bundles.py) enforces, built from the record."""
    rec = {"countries": f["range"]["countries"], "waterBodies": f["range"]["waterBodies"],
           "summary": f["range"]["summary"]}
    return set(_FB.forbidden(rec, cnames))


def main():
    fish = load_json(os.path.join(DATA, "fish.json"), [])
    errors, warns = [], []
    cnames = _FB.country_names()
    ids = Counter(f["id"] for f in fish)
    for k, n in ids.items():
        if n > 1:
            errors.append(f"duplicate id {k}")
    for f in fish:
        cid = f["id"]
        for key in ("id", "scientificName", "commonName", "family", "iucn", "waterType", "habitatTags", "region",
                    "range", "photo", "funFact", "revealFact", "factSources", "hints", "gbifKey"):
            if f.get(key) in (None, "", []) and key not in ("habitatTags",):
                errors.append(f"{cid}: missing {key}")
        if f["iucn"]["code"] not in ("CR", "EN", "VU", "EW", "NT", "DD", "NE"):
            errors.append(f"{cid}: IUCN code {f['iucn']['code']} not allowed")
        if f["waterType"] not in ("marine", "freshwater", "brackish"):
            errors.append(f"{cid}: waterType")
        r = f["range"]
        if not r["cells"] and not r["anchors"]:
            errors.append(f"{cid}: no scoring geometry")
        for lat, lng in r["cells"]:
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                errors.append(f"{cid}: bad cell {lat},{lng}")
        for a in r["anchors"]:
            if not (-90 <= a["lat"] <= 90 and -180 <= a["lng"] <= 180 and a["radiusKm"] > 0):
                errors.append(f"{cid}: bad anchor {a}")
        if r["method"] not in ("gbif-cells", "anchors"):
            errors.append(f"{cid}: method {r['method']}")
        b = r["bbox"]
        if b and (b[0] > b[2]) != r["crossesAntimeridian"]:
            errors.append(f"{cid}: antimeridian flag inconsistent with bbox")
        v = r["verification"]
        if v["fishbase"] not in ("agree", "conflict", "missing") or v["wikipedia"] not in ("agree", "conflict", "missing"):
            errors.append(f"{cid}: verification verdicts not final ({v['fishbase']}/{v['wikipedia']})")
        p = f["photo"]
        if not ALLOWED.match(p["license"] or ""):
            errors.append(f"{cid}: licence not allowlisted: {p['license']}")
        if not p.get("author"):
            warns.append(f"{cid}: photo author missing")
        if not p.get("licenseUrl") and p["license"] != "Public domain":
            errors.append(f"{cid}: licence URL missing")
        path = os.path.join(DATA, p["file"])
        if not os.path.exists(path):
            errors.append(f"{cid}: photo file missing")
        else:
            with Image.open(path) as im:
                if max(im.size) > 1280:
                    errors.append(f"{cid}: photo too large {im.size}")
                if list(im.size) != [p["width"], p["height"]]:
                    errors.append(f"{cid}: photo dims mismatch")
                if max(im.size) < 500:
                    warns.append(f"{cid}: small photo {im.size}")
        pre = " ".join([f["funFact"]] + [str(x) for x in f["hints"].values() if x])
        for t in leak_terms(f, cnames):
            if re.search(r"(?<![\w])" + re.escape(t) + r"(?![\w])", pre):
                errors.append(f"{cid}: pre-answer text mentions '{t}'")
        if not f["factSources"]:
            errors.append(f"{cid}: no fact sources")

    print(f"records: {len(fish)}  errors: {len(errors)}  warnings: {len(warns)}")
    for e in errors:
        print("ERROR", e)
    for w in warns:
        print("WARN ", w)
    print("\nregion:", dict(Counter(f["region"] for f in fish)))
    cc = Counter(c for f in fish for c in f["range"]["countries"][:1])
    print("primary country (first listed):", dict(cc.most_common(12)))
    allc = Counter(c for f in fish for c in set(f["range"]["countries"]))
    print("any-country >10:", {k: v for k, v in allc.items() if v > 10})
    print("water:", dict(Counter(f["waterType"] for f in fish)))
    print("iucn:", dict(Counter(f["iucn"]["code"] for f in fish)))
    print("method:", dict(Counter(f["range"]["method"] for f in fish)))
    print("licence:", dict(Counter(re.sub(r" \d\.\d.*", "", f["photo"]["license"]) for f in fish)))
    print("kind:", dict(Counter(f["photo"]["kind"] for f in fish)))
    print("source:", dict(Counter(f["photo"]["source"] for f in fish)))
    print("spoilerRisk:", sum(f["photo"]["spoilerRisk"] for f in fish))
    print("verification fishbase:", dict(Counter(f["range"]["verification"]["fishbase"] for f in fish)))
    print("verification wikipedia:", dict(Counter(f["range"]["verification"]["wikipedia"] for f in fish)))
    print("antimeridian:", [f["id"] for f in fish if f["range"]["crossesAntimeridian"]])
    for g, fn in GROUPS.items():
        members = [f["id"] for f in fish if fn(f)]
        print(f"group {g}: {len(members)} {members if len(members) > 3 else ''}")
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as fh:
            ids_ = [ln.strip() for ln in fh if ln.strip()]
        by = {f["id"]: f for f in fish}
        print("\n=== spot-check dump ===")
        for i in ids_:
            if i not in by:
                continue
            f = by[i]
            r = f["range"]
            lats = [c[0] for c in r["cells"]] + [a["lat"] for a in r["anchors"]]
            lngs = [c[1] for c in r["cells"]] + [a["lng"] for a in r["anchors"]]
            print(f"{i}: {r['method']} cells={len(r['cells'])} anchors={len(r['anchors'])} "
                  f"lat {min(lats):.2f}..{max(lats):.2f} lng {min(lngs):.2f}..{max(lngs):.2f} bbox={r['bbox']} | {r['summary'][:110]}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
