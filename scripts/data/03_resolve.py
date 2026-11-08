"""Stage 3: resolve every curated candidate (curated.txt) against GBIF, IUCN-via-GBIF, iNaturalist and
Wikipedia. Wikipedia wikitext is fetched in batches of 50 (wm.py). Writes data/.cache/resolved.json and the plain-text article for each candidate to
data/.cache/wiki_text/<id>.txt (used for range verification and fact writing).

usage: python -I scripts/data/03_resolve.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, get_json, q, save_json  # noqa: E402
from curated import load_curated  # noqa: E402
from wm import wiki_pages  # noqa: E402

GBIF = "https://api.gbif.org/v1"
INAT = "https://api.inaturalist.org/v1"
FISH_CLASSES = {"Actinopterygii", "Elasmobranchii", "Sarcopterygii", "Coelacanthi", "Dipneusti",
                "Petromyzonti", "Holocephali", "Chondrichthyes", "Cephalaspidomorphi"}


def gbif(name):
    m = get_json(f"{GBIF}/species/match?name={q(name)}&kingdom=Animalia&strict=true", "gbif_match") or {}
    key = m.get("usageKey")
    acc = m.get("acceptedUsageKey")
    out = {"gbifKey": acc or key, "gbifMatchKey": key, "gbifMatchType": m.get("matchType"),
           "gbifStatus": m.get("status"), "gbifName": m.get("scientificName"), "gbifClass": m.get("class"),
           "gbifFamily": m.get("family"), "gbifOrder": m.get("order")}
    if acc:
        a = get_json(f"{GBIF}/species/{acc}", "gbif_species") or {}
        out["gbifAcceptedName"] = a.get("canonicalName")
        out["gbifFamily"] = a.get("family") or out["gbifFamily"]
    out["iucn"] = None
    if out["gbifKey"] and m.get("matchType") == "EXACT":
        r = get_json(f"{GBIF}/species/{out['gbifKey']}/iucnRedListCategory", "gbif_iucn")
        if r:
            out["iucn"] = {"code": r.get("code"), "category": r.get("category"),
                           "taxonId": r.get("iucnTaxonID"), "iucnName": r.get("scientificName")}
    return out


def inat(name, alt=None):
    """Exact iNat taxon for `name` (or GBIF accepted name). Accepts a result whose name or matched_term equals
    the query (iNat files some species under synonyms); falls back to the autocomplete endpoint."""
    for n in [name] + ([alt] if alt else []):
        hit = None
        for url in (f"{INAT}/taxa?q={q(n)}&rank=species&per_page=5",
                    f"{INAT}/taxa/autocomplete?q={q(n)}&rank=species&per_page=10"):
            ns = "inat_taxa" if "autocomplete" not in url else "inat_auto"
            r = get_json(url, ns) or {}
            for t in r.get("results", []):
                if t.get("rank") != "species":
                    continue
                if (t.get("name") or "").lower() == n.lower() or (t.get("matched_term") or "").lower() == n.lower():
                    hit = t
                    break
            if hit:
                break
        if hit:
            t = hit
            full = get_json(f"{INAT}/taxa/{t['id']}", "inat_taxon") or {}
            res = (full.get("results") or [{}])[0]
            cs = res.get("conservation_status") or {}
            return {"inatTaxonId": t["id"], "inatName": t.get("name"),
                    "inatCommon": t.get("preferred_common_name"), "inatWiki": t.get("wikipedia_url"),
                    "inatObs": t.get("observations_count"),
                    "inatStatus": {"status": cs.get("status"), "authority": cs.get("authority"),
                                   "iucn": cs.get("iucn")} if cs else None}
    return {"inatTaxonId": None}


def strip_wikitext(t):
    """Crude wikitext -> plain text (refs, templates, tables, files and markup removed)."""
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"<ref[^>]*/>", "", t)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    for _ in range(6):  # nested templates, innermost first
        t2 = re.sub(r"\{\{[^{}]*\}\}", "", t)
        if t2 == t:
            break
        t = t2
    t = re.sub(r"\{\|.*?\|\}", "", t, flags=re.S)
    t = re.sub(r"\[\[(?:File|Image|Category):[^\[\]]*(?:\[\[[^\]]*\]\][^\[\]]*)*\]\]", "", t, flags=re.I)
    t = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[\[([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", t)
    t = re.sub(r"'{2,}", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def wiki_for(rec, res, pages):
    by_sci = {rec["scientificName"], res.get("gbifAcceptedName"), res.get("inatName")}
    for t in (rec["scientificName"], res.get("gbifAcceptedName"), res.get("inatName"),
              (res.get("inatWiki") or "").rsplit("/", 1)[-1].replace("_", " ") or None):
        p = pages.get(t) if t else None
        if not p or p.get("missing"):
            continue
        text = strip_wikitext(p.get("wikitext") or "")
        low = text.lower()
        epithet = rec["scientificName"].split()[-1].lower()
        # A page reached from a scientific name (directly or via redirect) is trusted; a page reached from a
        # common-name URL must at least mention the species epithet.
        if t not in by_sci and epithet not in low:
            continue
        return {"wikiTitle": p["title"],
                "wikiUrl": "https://en.wikipedia.org/wiki/" + p["title"].replace(" ", "_"),
                "wikiPageImage": p.get("pageimage"), "wikiText": text}
    return {"wikiTitle": None}


def main():
    cur = load_curated()
    out = {}
    os.makedirs(os.path.join(CACHE, "wiki_text"), exist_ok=True)
    for i, rec in enumerate(cur):
        r = {"id": rec["id"]}
        r.update(gbif(rec["scientificName"]))
        r.update(inat(rec["scientificName"], r.get("gbifAcceptedName")))
        out[rec["id"]] = r
    titles = []
    for rec in cur:
        r = out[rec["id"]]
        titles += [rec["scientificName"], r.get("gbifAcceptedName"), r.get("inatName"),
                   (r.get("inatWiki") or "").rsplit("/", 1)[-1].replace("_", " ") or None]
    pages = wiki_pages([t for t in titles if t])
    for i, rec in enumerate(cur):
        r = out[rec["id"]]
        w = wiki_for(rec, r, pages)
        text = w.pop("wikiText", "")
        if text:
            text = re.sub(r"\n{3,}", "\n\n", text)
            with open(os.path.join(CACHE, "wiki_text", rec["id"] + ".txt"), "w", encoding="utf-8") as fh:
                fh.write(text)
        r.update(w)
        r["wikiChars"] = len(text)
        out[rec["id"]] = r
        if i % 20 == 0:
            print(i, rec["id"], (r.get("iucn") or {}).get("code"), r.get("inatTaxonId"), r.get("wikiTitle"), flush=True)
    save_json(os.path.join(CACHE, "resolved.json"), out)
    # GBIF's backbone returns no class for ray-finned fishes, so only flag a *non-fish* class.
    bad = [k for k, v in out.items() if v.get("gbifClass") and v.get("gbifClass") not in FISH_CLASSES]
    print("done", len(out), "non-fish-class or unmatched:", bad)


if __name__ == "__main__":
    main()
