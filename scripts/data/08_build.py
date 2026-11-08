"""Stage 8: merge everything into data/fish.json, data/candidates.csv and data/backlog.csv.

Inputs
  curated.txt                       hand-curated candidates (ranges, anchors, bbox)
  data/.cache/resolved.json         GBIF/IUCN/iNat/Wikipedia resolution (03)
  data/.cache/fishbase_subset.json  FishBase verification subset (02)
  data/.cache/ranges.json           GBIF-derived cells (05)
  data/.cache/photos_final.json     processed photos (07)
  data/.cache/prescreen.json        wide-pool screen (01) -> backlog rows for names never shortlisted
  scripts/data/decisions.txt        id | allow|reject|method-anchors|method-cells | note
  scripts/data/verification.txt     id | fishbase verdict | wikipedia verdict | notes   (manual review)
  scripts/data/facts.json           hand-written facts, hints and sources per id

Rules applied here (each failure becomes a backlog row with its reason):
  IUCN EX -> reject; LC -> reject; NT/DD/NE -> needs an `allow` decision documenting rarity / tiny range;
  no processed photo -> reject; no facts -> reject; explicit `reject` decisions.

usage: python -I scripts/data/08_build.py
"""
import csv
import math
import re
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, DATA, HERE, load_json, read_pipe_table, save_json  # noqa: E402
from curated import REGIONS, load_curated  # noqa: E402

NATIVE_STATUS = {"native", "endemic"}


def fb_record(name, res, fb):
    for n in (name, res.get("gbifAcceptedName")):
        if n and n in fb:
            return fb[n]
    return None


def fb_auto(rec, fbr):
    """Automatic comparison of curated countries with FishBase native/endemic countries."""
    if not fbr:
        return "missing", "species not found in FishBase tables", []
    native = sorted({c["iso2"] for c in fbr["countries"] if (c.get("status") or "").lower() in NATIVE_STATUS and c.get("iso2")})
    intro = sorted({c["iso2"] for c in fbr["countries"] if (c.get("status") or "").lower() == "introduced" and c.get("iso2")})
    if not native:
        return "missing", "FishBase has no native/endemic country rows", native
    cur = set(rec["countries"])
    extra_fb, extra_cur = sorted(set(native) - cur), sorted(cur - set(native))
    if not extra_fb and not extra_cur:
        return "agree", f"FishBase native/endemic: {','.join(native)}", native
    if not (cur & set(native)):
        verdict = "conflict"
    else:
        verdict = "conflict" if (extra_fb or extra_cur) else "agree"
    note = (f"FishBase native/endemic: {','.join(native)}; FB-only: {','.join(extra_fb) or '-'}; "
            f"curated-only: {','.join(extra_cur) or '-'}" + (f"; FB introduced: {','.join(intro)}" if intro else ""))
    return verdict, note, native


def clean_author(a):
    """'(c) Name, some rights reserved (CC BY)' -> 'Name' (iNat-style credit strings, also seen on Commons)."""
    if not a:
        return a
    a = re.sub(r"^\s*(\(c\)|©)\s*", "", a.strip())
    a = re.sub(r",\s*(some|no) rights reserved.*$", "", a, flags=re.I)
    return a.strip() or None


def geom_bbox(cells, anchors):
    """Tight bbox of the scoring geometry; returns (bbox, crossesAntimeridian)."""
    pts = []
    for lat, lng in cells:
        pts += [(lat - 0.25, lng - 0.25), (lat + 0.25, lng + 0.25)]
    for a in anchors:
        dlat = a["radiusKm"] / 111.0
        dlng = a["radiusKm"] / (111.0 * max(0.1, math.cos(math.radians(a["lat"]))))
        pts += [(a["lat"] - dlat, a["lng"] - dlng), (a["lat"] + dlat, a["lng"] + dlng)]
    if not pts:
        return None, False
    lats = [p[0] for p in pts]
    lngs = sorted(p[1] for p in pts)
    s, n = max(-90, min(lats)), min(90, max(lats))
    # Smallest longitudinal interval covering all points (handles the antimeridian).
    gaps = [(lngs[(i + 1) % len(lngs)] - lngs[i]) % 360 for i in range(len(lngs))]
    i = max(range(len(gaps)), key=lambda k: gaps[k])
    if len(lngs) == 1 or gaps[i] <= 0:
        w, e = lngs[0], lngs[-1]
    else:
        w, e = lngs[(i + 1) % len(lngs)], lngs[i]
    w = ((w + 180) % 360) - 180
    e = ((e + 180) % 360) - 180
    r = lambda v: round(v, 3)  # noqa: E731
    return [r(w), r(s), r(e), r(n)], w > e


def main():
    cur = load_curated()
    resolved = load_json(os.path.join(CACHE, "resolved.json"), {})
    fb = load_json(os.path.join(CACHE, "fishbase_subset.json"), {})
    ranges = load_json(os.path.join(CACHE, "ranges.json"), {})
    photos = load_json(os.path.join(CACHE, "photos_final.json"), {})
    popts = load_json(os.path.join(CACHE, "photo_options.json"), {})
    pre = load_json(os.path.join(CACHE, "prescreen.json"), {})
    facts = load_json(os.path.join(HERE, "facts.json"), {})
    decisions = {}
    for row in read_pipe_table(os.path.join(HERE, "decisions.txt")):
        decisions.setdefault(row[0], []).append((row[1], row[2] if len(row) > 2 else ""))
    verif = {r[0]: r for r in read_pipe_table(os.path.join(HERE, "verification.txt"))} \
        if os.path.exists(os.path.join(HERE, "verification.txt")) else {}
    review = {r[0]: r for r in read_pipe_table(os.path.join(HERE, "photo_review.txt"))} \
        if os.path.exists(os.path.join(HERE, "photo_review.txt")) else {}

    fish, backlog, cand_rows = [], [], []
    for rec in cur:
        cid = rec["id"]
        res = resolved.get(cid, {})
        rng = ranges.get(cid, {})
        fbr = fb_record(rec["scientificName"], res, fb)
        dec = decisions.get(cid, [])
        iucn = res.get("iucn") or {}
        code = iucn.get("code") or "NE"
        iucn_source = "GBIF:IUCN" if iucn.get("code") else "GBIF:IUCN (no assessment returned; treated as NE)"
        st = res.get("inatStatus") or {}
        if code == "NE" and "IUCN" in (st.get("authority") or "").upper() and st.get("status"):
            words = {"least concern": "LC", "near threatened": "NT", "vulnerable": "VU", "endangered": "EN",
                     "critically endangered": "CR", "extinct in the wild": "EW", "data deficient": "DD", "extinct": "EX"}
            alt = words.get(st["status"].lower(), st["status"].upper())
            if alt in ("LC", "NT", "VU", "EN", "CR", "EW", "DD", "EX"):
                code = alt
                iucn_source = "iNaturalist conservation status (IUCN Red List authority); GBIF returned NE"
        reasons = []
        if res.get("gbifMatchType") != "EXACT":
            reasons.append("no exact GBIF match")
        if code == "EX":
            reasons.append("IUCN EX (extinct) per GBIF:IUCN")
        elif code == "LC":
            reasons.append("IUCN LC: fails rarity rule")
        elif code in ("NT", "DD", "NE") and not any(d in ("allow", "reject") for d, _ in dec):
            reasons.append(f"IUCN {code} without documented extreme rarity/tiny range")
        for d, note in dec:
            if d == "reject":
                reasons.append(note)
        if cid in review and review[cid][1] == "reject":
            reasons.append("photo rejected on visual review: " + (review[cid][4] if len(review[cid]) > 4 else ""))
        elif cid not in photos:
            n = (popts.get(cid) or {}).get("nOptions", 0)
            rej = (popts.get(cid) or {}).get("rejected", {})
            nc = sum(v for k, v in rej.items() if k.startswith("licence:") and k not in ("licence:None",))
            reasons.append("no usable openly licensed photo" + (f" ({nc} candidate photos had NC/ND/ARR or other non-allowlisted licences)" if nc else "")
                           if n == 0 else "no photo selected")
        method = rng.get("method", "MISSING")
        for d, note in dec:
            if d == "method-anchors":
                method = "anchors"
            elif d == "method-cells":
                method = "gbif-cells"
        if method == "anchors" and not rec["anchors"]:
            reasons.append("too few trustworthy GBIF points and no literature anchors")
        if method not in ("anchors", "gbif-cells"):
            reasons.append("range geometry missing")
        if cid not in facts and not reasons:
            reasons.append("facts not yet written")

        fb_verdict, fb_note, fb_native = fb_auto(rec, fbr)
        wiki_verdict = "missing" if not res.get("wikiTitle") else "unreviewed"
        notes = [fb_note]
        if cid in verif:
            v = verif[cid]
            fb_verdict = v[1] or fb_verdict
            wiki_verdict = v[2] or wiki_verdict
            if len(v) > 3 and v[3]:
                notes.append(v[3])
        for d, note in dec:
            if d in ("allow", "method-anchors", "method-cells") and note:
                notes.append(note)
        if "conflict-unresolved" in (fb_verdict, wiki_verdict):
            reasons.append("unresolved range conflict")

        status = "backlog" if reasons else "included"
        cand_rows.append({
            "id": cid, "scientificName": rec["scientificName"], "commonName": rec["commonName"],
            "region": rec["region"], "waterType": rec["waterType"], "countries": " ".join(rec["countries"]),
            "waterBodies": "; ".join(rec["waterBodies"]), "summary": rec["summary"],
            "bbox": ",".join(str(x) for x in rec["bbox"]), "anchors": len(rec["anchors"]),
            "iucn": code, "gbifKey": res.get("gbifKey"), "inatTaxonId": res.get("inatTaxonId"),
            "fishbaseSpecCode": (fbr or {}).get("specCode"), "status": status, "reason": "; ".join(reasons),
        })
        if reasons:
            backlog.append({"id": cid, "scientificName": rec["scientificName"], "commonName": rec["commonName"],
                            "region": rec["region"], "stage": "shortlist", "iucn": code, "reason": "; ".join(reasons)})
            continue

        cells = [[c[0], c[1]] for c in rng.get("cells", [])] if method == "gbif-cells" else []
        anchors = rec["anchors"]
        bbox, wraps = geom_bbox(cells, anchors)
        ph = photos[cid]
        f = facts[cid]
        fish.append({
            "id": cid, "scientificName": rec["scientificName"], "commonName": rec["commonName"],
            "family": res.get("gbifFamily") or (fbr or {}).get("family"),
            "iucn": {"code": code, "source": iucn_source, "taxonId": iucn.get("taxonId")},
            "waterType": rec["waterType"], "habitatTags": rec["habitatTags"], "region": rec["region"],
            "range": {
                "summary": rec["summary"], "countries": rec["countries"], "waterBodies": rec["waterBodies"],
                "method": method, "cells": cells, "anchors": anchors, "bbox": bbox,
                "crossesAntimeridian": wraps, "filterBbox": rec["bbox"],
                "gbifOccurrencesUsed": rng.get("gbifUsed", 0) if method == "gbif-cells" else 0,
                "gbifOccurrencesKept": rng.get("gbifUsed", 0),
                "verification": {"fishbase": fb_verdict, "wikipedia": wiki_verdict, "notes": " | ".join(n for n in notes if n)},
            },
            "photo": {**{k: ph[k] for k in ("file", "sourceUrl", "pageUrl", "source", "license", "licenseUrl",
                                            "kind", "width", "height", "spoilerRisk")},
                      "sourceUrl": (ph.get("sourceUrl") or "").split("?")[0] or None,  # drop utm_* tracking params
                      "author": clean_author(ph.get("author"))},
            "funFact": f["funFact"], "revealFact": f["revealFact"], "factSources": f["factSources"],
            "hints": f["hints"],
            "gbifKey": res.get("gbifKey"), "inatTaxonId": res.get("inatTaxonId"),
            "fishbaseSpecCode": (fbr or {}).get("specCode"),
        })

    # Pool names that never made the shortlist.
    shortlisted = {r["scientificName"] for r in cur} | {(resolved.get(r["id"]) or {}).get("gbifAcceptedName") for r in cur}
    for name, p in sorted(pre.items()):
        if name in shortlisted:
            continue
        code = p.get("iucn") or "NE"
        if p.get("matchType") != "EXACT":
            why = "no exact GBIF match for this name"
        elif code == "EX":
            why = "IUCN EX (extinct) per GBIF:IUCN"
        elif code == "LC":
            why = "IUCN LC: fails rarity rule"
        elif p.get("gbifAccepted"):
            why = f"GBIF treats name as synonym of {p['gbifAccepted']}; not shortlisted"
        elif not ((p.get("inatOpenObs") or 0) > 0 or (p.get("inatDefaultLicense") in ("cc0", "cc-by", "cc-by-sa"))
                  or p.get("wikiImageLicense")):
            why = "prescreen: no openly licensed photo found (iNat open-licence obs = 0, no usable Wikipedia lead image)"
        else:
            why = "prescreen: passed screen but not shortlisted (regional/visual caps or weaker range data)"
        backlog.append({"id": "", "scientificName": name, "commonName": p.get("common"),
                        "region": REGIONS.get(p.get("region"), p.get("region")), "stage": "prescreen",
                        "iucn": code, "reason": why})

    # Photos are processed for every reviewed candidate; keep only those referenced by a final record.
    keep_files = {os.path.basename(r["photo"]["file"]) for r in fish}
    for fn in os.listdir(os.path.join(DATA, "photos")):
        if fn.endswith(".jpg") and fn not in keep_files:
            os.remove(os.path.join(DATA, "photos", fn))

    order = list(REGIONS.values())
    fish.sort(key=lambda r: (order.index(r["region"]), r["id"]))
    save_json(os.path.join(DATA, "fish.json"), fish, indent=2)
    with open(os.path.join(DATA, "candidates.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(cand_rows[0].keys()))
        w.writeheader()
        w.writerows(cand_rows)
    with open(os.path.join(DATA, "backlog.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["id", "scientificName", "commonName", "region", "stage", "iucn", "reason"])
        w.writeheader()
        w.writerows(backlog)
    print("fish:", len(fish), "backlog:", len(backlog))
    print("by region:", dict(Counter(r["region"] for r in fish)))
    print("by water:", dict(Counter(r["waterType"] for r in fish)))
    print("by iucn:", dict(Counter(r["iucn"]["code"] for r in fish)))
    print("by method:", dict(Counter(r["range"]["method"] for r in fish)))
    print("by licence:", dict(Counter(r["photo"]["license"] for r in fish)))


if __name__ == "__main__":
    main()
