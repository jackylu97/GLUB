"""Stage 1: screen the wide pool (pool.txt) before any range work is hand-authored.

For each name:   GBIF match -> usage key + IUCN code
Then, for each name whose IUCN code is not LC/EX:
                 iNaturalist taxon -> default photo licence + # of openly licensed observation photos
                 Wikipedia (batched, 50 titles/request) -> page + lead image; Commons licence of that image

Output: data/.cache/prescreen.json (one object per name). Re-running is cheap: every API call is cached.

usage: python -I scripts/data/01_prescreen.py [gbif|all]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, HERE, get_json, q, read_pipe_table, save_json  # noqa: E402
from wm import commons_files, wiki_pages  # noqa: E402

GBIF = "https://api.gbif.org/v1"
INAT = "https://api.inaturalist.org/v1"
OPEN_INAT = "cc0,cc-by,cc-by-sa"
OPEN_RE = ("cc0", "cc-by", "cc-by-sa")


def gbif_lookup(name):
    m = get_json(f"{GBIF}/species/match?name={q(name)}&kingdom=Animalia&strict=true", "gbif_match") or {}
    out = {
        "gbifKey": m.get("usageKey"), "gbifStatus": m.get("status"), "matchType": m.get("matchType"),
        "gbifRank": m.get("rank"), "gbifCanonical": m.get("canonicalName"), "family": m.get("family"),
        "class": m.get("class"), "acceptedKey": m.get("acceptedUsageKey"), "gbifAccepted": None,
    }
    key = out["acceptedKey"] or out["gbifKey"]
    if out["acceptedKey"]:
        out["gbifAccepted"] = m.get("species") or m.get("scientificName")
    out["iucn"] = None
    if key and out["matchType"] == "EXACT":
        r = get_json(f"{GBIF}/species/{key}/iucnRedListCategory", "gbif_iucn")
        if r:
            out["iucn"] = r.get("code")
            out["iucnTaxonId"] = r.get("iucnTaxonID")
            out["iucnCategory"] = r.get("category")
    return out


def inat_lookup(name):
    r = get_json(f"{INAT}/taxa?q={q(name)}&rank=species&per_page=5", "inat_taxa") or {}
    taxon = None
    for t in r.get("results", []):
        if (t.get("name") or "").lower() == name.lower():
            taxon = t
            break
    if taxon is None:
        return {"inatTaxonId": None}
    out = {
        "inatTaxonId": taxon["id"], "inatObs": taxon.get("observations_count"),
        "inatWiki": taxon.get("wikipedia_url"),
        "inatDefaultLicense": (taxon.get("default_photo") or {}).get("license_code"),
    }
    o = get_json(
        f"{INAT}/observations?taxon_id={taxon['id']}&photo_license={OPEN_INAT}"
        f"&quality_grade=research&photos=true&per_page=0",
        "inat_obs_count",
    ) or {}
    out["inatOpenObs"] = o.get("total_results")
    return out


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    rows = [r for r in read_pipe_table(os.path.join(HERE, "pool.txt")) if "skip" not in r[0]]
    out = {}
    for i, (name, common, region, water) in enumerate(rows):
        rec = {"name": name, "common": common, "region": region, "water": water}
        rec.update(gbif_lookup(name))
        if mode == "all" and rec.get("iucn") not in ("LC", "EX"):
            rec.update(inat_lookup(name))
        out[name] = rec
        if i % 25 == 0:
            print(i, name, rec.get("iucn"), flush=True)
            save_json(os.path.join(CACHE, "prescreen.json"), out)
    if mode == "all":
        # Batched Wikipedia lookup by scientific name (redirects resolve common/synonym titles),
        # then the lead image's Commons licence.
        live = [r for r in out.values() if r.get("iucn") not in ("LC", "EX")]
        titles = [r["name"] for r in live] + [r["gbifAccepted"] for r in live if r.get("gbifAccepted")]
        pages = wiki_pages(titles)
        files = []
        for r in live:
            p = pages.get(r["name"]) or {}
            if p.get("missing") and r.get("gbifAccepted"):
                p = pages.get(r["gbifAccepted"]) or {}
            r["wikiTitle"] = p.get("title")
            r["wikiImage"] = p.get("pageimage")
            r["wikiChars"] = len(p.get("wikitext") or "")
            if r["wikiImage"]:
                files.append("File:" + r["wikiImage"])
        info = commons_files(files)
        for r in live:
            if r.get("wikiImage"):
                ii = info.get("File:" + r["wikiImage"]) or {}
                md = ii.get("extmetadata") or {}
                r["wikiImageLicense"] = (md.get("LicenseShortName") or {}).get("value")
                r["wikiImageSize"] = [ii.get("width"), ii.get("height")]
    save_json(os.path.join(CACHE, "prescreen.json"), out)
    print("done", len(out))


if __name__ == "__main__":
    main()
