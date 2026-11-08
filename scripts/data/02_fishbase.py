"""Stage 2: FishBase verification tables (Hugging Face dataset cboettig/fishbase, v25.04).

Downloads a handful of parquet tables into data/.cache/fishbase/ (a downloads-only folder) and
extracts, for every name in pool.txt + curated.txt, the native/endemic country list, ecosystem
names, habitat flags and size/depth fields into data/.cache/fishbase_subset.json.

FishBase content is CC BY-NC: it is used here only to *verify* our own curated ranges and to
sanity-check hint values; the tables are not redistributed.

usage: python -I scripts/data/02_fishbase.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, HERE, get_bytes, read_pipe_table, save_json  # noqa: E402

import pyarrow.compute as pc  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402

VERSION = "v25.04"
BASE = f"https://huggingface.co/datasets/cboettig/fishbase/resolve/main/data/fb/{VERSION}/parquet"
TABLES = ["species", "country", "countref", "ecosystem", "ecosystemref", "synonyms", "families"]
DL = os.path.join(CACHE, "fishbase")


def names_wanted():
    names = set()
    for r in read_pipe_table(os.path.join(HERE, "pool.txt")):
        names.add(r[0])
    cur = os.path.join(HERE, "curated.txt")
    if os.path.exists(cur):
        for r in read_pipe_table(cur):
            names.add(r[1])
    return {n for n in names if "skip" not in n}


def col(table, name):
    return table.column(name).to_pylist() if name in table.column_names else [None] * table.num_rows


def main():
    for t in TABLES:
        ok = get_bytes(f"{BASE}/{t}.parquet", os.path.join(DL, f"{t}.parquet"))
        print(t, "ok" if ok else "FAILED", flush=True)

    sp = pq.read_table(os.path.join(DL, "species.parquet"))
    print("species columns:", sp.column_names[:60])
    genus, species, code = col(sp, "Genus"), col(sp, "Species"), col(sp, "SpecCode")
    by_name = {f"{g} {s}": c for g, s, c in zip(genus, species, code) if g and s}

    wanted = names_wanted()
    # Synonym fallback: FishBase may file a species under an older/newer name.
    syn = pq.read_table(os.path.join(DL, "synonyms.parquet"),
                        columns=["SynGenus", "SynSpecies", "SpecCode", "Status"])
    syn_map = {}
    for g, s, c, st in zip(*(col(syn, n) for n in ("SynGenus", "SynSpecies", "SpecCode", "Status"))):
        if g and s:
            syn_map.setdefault(f"{g} {s}", c)
    resolved = {}
    for n in wanted:
        if n in by_name:
            resolved[n] = (by_name[n], "accepted")
        elif n in syn_map:
            resolved[n] = (syn_map[n], "synonym")
    codes = {c for c, _ in resolved.values()}
    print(f"resolved {len(resolved)}/{len(wanted)} names")

    # species fields
    keep = ["SpecCode", "Genus", "Species", "FBname", "FamCode", "Fresh", "Brack", "Saltwater",
            "DemersPelag", "DepthRangeShallow", "DepthRangeDeep", "Length", "LTypeMaxM", "CommonLength",
            "Weight", "Dangerous", "Electrogenic", "Comments", "Vulnerability"]
    keep = [k for k in keep if k in sp.column_names]
    sp_sub = sp.select(keep).filter(pc.is_in(sp.column("SpecCode"), value_set=__import__("pyarrow").array(list(codes))))
    sp_rows = {r["SpecCode"]: r for r in sp_sub.to_pylist()}

    fam = pq.read_table(os.path.join(DL, "families.parquet"))
    fam_rows = {r["FamCode"]: r.get("Family") for r in fam.select(["FamCode", "Family"]).to_pylist()}

    cref = pq.read_table(os.path.join(DL, "countref.parquet"))
    print("countref columns:", cref.column_names[:40])
    iso_col = next((c for c in ("ABB", "ISO3166a2", "ISOCode") if c in cref.column_names), None)
    cref_rows = {}
    for r in cref.to_pylist():
        cref_rows[r["C_Code"]] = {"name": r.get("PAESE"), "iso2": r.get("ISO2Alpha"),
                                  "iso3": r.get("ISO3Alpha"), "admin": r.get("AdminCountry")}

    # Sub-territories (Hawaii, Galapagos Is., Cocos I. (C.R.), Clipperton I., Madeira Is., ...) carry no ISO2
    # code: inherit the administering country's code, except where ISO 3166 has its own code.
    own_iso = {"826F": "IO", "826E": "SH"}  # Chagos Is. -> British Indian Ocean Territory; Ascension I. -> SH
    num_to_iso = {k: v["iso2"] for k, v in cref_rows.items() if v.get("iso2")}
    for k, v in cref_rows.items():
        if not v.get("iso2"):
            digits = "".join(ch for ch in str(k) if ch.isdigit())[:3]  # e.g. 826A -> 826, I188 -> 188
            v["iso2"] = own_iso.get(k) or num_to_iso.get(v.get("admin")) or num_to_iso.get(digits)
            v["subunit"] = True

    ct = pq.read_table(os.path.join(DL, "country.parquet"))
    print("country columns:", ct.column_names[:40])
    ct_sub = ct.filter(pc.is_in(ct.column("SpecCode"), value_set=__import__("pyarrow").array(list(codes))))
    countries = {}
    for r in ct_sub.to_pylist():
        cc = cref_rows.get(r.get("C_Code"), {})
        countries.setdefault(r["SpecCode"], []).append({
            "c_code": r.get("C_Code"), "country": cc.get("name"), "iso2": cc.get("iso2"),
            "status": r.get("Status"), "currentPresence": r.get("CurrentPresence"),
        })

    eco = pq.read_table(os.path.join(DL, "ecosystem.parquet"))
    print("ecosystem columns:", eco.column_names[:30])
    eref = pq.read_table(os.path.join(DL, "ecosystemref.parquet"))
    print("ecosystemref columns:", eref.column_names[:30])
    eref_rows = {r["E_CODE"]: r for r in eref.to_pylist()}
    eco_sub = eco.filter(pc.is_in(eco.column("Speccode"), value_set=__import__("pyarrow").array(list(codes))))
    ecos = {}
    for r in eco_sub.to_pylist():
        e = eref_rows.get(r.get("E_CODE"), {})
        ecos.setdefault(r["Speccode"], []).append({
            "name": e.get("EcosystemName"), "type": e.get("EcosystemType"),
            "status": r.get("Status"), "location": e.get("Location"),
        })

    out = {}
    for n, (c, how) in sorted(resolved.items()):
        s = sp_rows.get(c, {})
        out[n] = {
            "specCode": c, "matchedVia": how, "fbName": f"{s.get('Genus')} {s.get('Species')}",
            "family": fam_rows.get(s.get("FamCode")), "commonName": s.get("FBname"),
            "fresh": s.get("Fresh"), "brack": s.get("Brack"), "salt": s.get("Saltwater"),
            "demersPelag": s.get("DemersPelag"), "depthShallow": s.get("DepthRangeShallow"),
            "depthDeep": s.get("DepthRangeDeep"), "length": s.get("Length"), "lengthType": s.get("LTypeMaxM"),
            "weight": s.get("Weight"), "comments": (s.get("Comments") or "")[:1500],
            "countries": countries.get(c, []), "ecosystems": ecos.get(c, []),
        }
    save_json(os.path.join(CACHE, "fishbase_subset.json"), out)
    print("wrote", len(out), "missing:", sorted(wanted - set(resolved))[:80])


if __name__ == "__main__":
    main()
