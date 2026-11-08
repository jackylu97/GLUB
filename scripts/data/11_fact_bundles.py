"""Stage 11 (writing aid): source bundles for hand-written facts, plus the leak/schema checker.

  python -I scripts/data/11_fact_bundles.py bundle <ids_file> <out_dir> [per_file]
      Writes <out_dir>/bundle_NN.txt: for each id the Wikipedia plain text (trimmed), FishBase size/depth
      fields and comments, source URLs, the reveal-side range summary, and the FORBIDDEN terms that must not
      appear in funFact or hints (countries, water bodies and place names of the native range).

  python -I scripts/data/11_fact_bundles.py check <facts.json>
      Validates a facts file: schema, sources, sentence counts, and that funFact + hints contain none of the
      forbidden terms for that fish. Exit code 1 on any error.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, load_json  # noqa: E402
from curated import load_curated  # noqa: E402

STOP = {"The", "A", "An", "And", "Of", "In", "On", "At", "To", "Its", "It", "From", "With", "Today", "Once",
        "Only", "Rivers", "River", "Lake", "Lakes", "Sea", "Island", "Islands", "Basin", "Mountains", "National",
        "Park", "Reserve", "Plateau", "Peninsula", "Gulf", "Bay", "Valley", "Springs", "Spring", "Coast",
        "North", "South", "East", "West", "Central", "Upper", "Lower", "Northern", "Southern", "Eastern",
        "Western", "Great", "Big", "Little", "New", "Old", "Mount", "Province", "County", "State", "Region",
        "Rocky", "Deep", "Shelf", "System", "Drainage", "Delta", "Creek", "Stream", "Streams", "Harbour"}
GENERIC = ["Africa", "African", "Asia", "Asian", "Europe", "European", "America", "American", "Americas",
           "Atlantic", "Pacific", "Indian Ocean", "Arctic", "Antarctic", "Antarctica", "Mediterranean",
           "Caribbean", "Amazon", "Amazonian", "Andes", "Andean", "Himalaya", "Himalayan", "Siberia", "Siberian",
           "Sahara", "Balkan", "Balkans", "Iberian", "Scandinavian", "Patagonia", "Patagonian", "Polynesia",
           "Melanesia", "Micronesia", "Oceania", "Australasia", "Indochina", "Mesoamerica", "Orient", "Oriental",
           "Arabian", "Persian", "Celtic", "Nordic", "tropical Asia", "Southeast Asia", "Middle East"]
COUNTRY_EXTRA = {
    "US": ["United States", "USA", "U.S.", "American", "Texas", "California", "Nevada", "Hawaii", "Hawaiian",
           "Alabama", "Arizona", "Colorado", "Utah", "Virginia", "Tennessee", "Florida", "Alaska", "Oregon"],
    "GB": ["Britain", "British", "Wales", "Welsh", "England", "English", "Scotland", "Scottish", "UK"],
    "AU": ["Australia", "Australian", "Tasmania", "Tasmanian", "Queensland", "Aussie"],
    "NZ": ["New Zealand", "Kiwi", "Maori", "Māori"], "MX": ["Mexico", "Mexican"], "CN": ["China", "Chinese"],
    "JP": ["Japan", "Japanese"], "IN": ["India", "Indian"], "LK": ["Sri Lanka", "Sri Lankan", "Ceylon"],
    "MG": ["Madagascar", "Malagasy"], "BR": ["Brazil", "Brazilian"], "ZA": ["South Africa", "South African"],
    "ID": ["Indonesia", "Indonesian"], "PG": ["Papua New Guinea", "New Guinea", "Papuan"],
    "RU": ["Russia", "Russian"], "IR": ["Iran", "Iranian", "Persian"], "CU": ["Cuba", "Cuban"],
    "EC": ["Ecuador", "Ecuadorian", "Galápagos", "Galapagos"], "SH": ["St Helena", "Saint Helena", "Ascension"],
    "TH": ["Thailand", "Thai"], "MM": ["Myanmar", "Burma", "Burmese"], "PH": ["Philippines", "Filipino"],
    "CA": ["Canada", "Canadian"], "FR": ["France", "French"], "IT": ["Italy", "Italian"], "GR": ["Greece", "Greek"],
    "TR": ["Turkey", "Turkish", "Türkiye"], "CM": ["Cameroon"], "KE": ["Kenya", "Kenyan"], "TZ": ["Tanzania"],
    "CL": ["Chile", "Chilean"], "AR": ["Argentina", "Argentine", "Argentinian"], "ES": ["Spain", "Spanish"],
    "PT": ["Portugal", "Portuguese"], "DE": ["Germany", "German"], "AT": ["Austria", "Austrian"],
    "KR": ["Korea", "Korean"], "TW": ["Taiwan", "Taiwanese"], "VN": ["Vietnam", "Vietnamese"],
    "KH": ["Cambodia", "Cambodian", "Khmer"], "LA": ["Laos", "Lao"], "MY": ["Malaysia", "Malaysian"],
    "IQ": ["Iraq", "Iraqi"], "IL": ["Israel", "Israeli"], "JO": ["Jordan", "Jordanian"], "OM": ["Oman", "Omani"],
    "MN": ["Mongolia", "Mongolian"], "BS": ["Bahamas"], "HT": ["Haiti", "Haitian"], "DO": ["Dominican"],
    "NI": ["Nicaragua"], "CO": ["Colombia", "Colombian"], "CR": ["Costa Rica"], "NC": ["New Caledonia"],
    "PE": ["Peru", "Peruvian"], "BO": ["Bolivia"], "KZ": ["Kazakhstan"], "UZ": ["Uzbekistan"],
    "IE": ["Ireland", "Irish"], "RO": ["Romania", "Romanian"], "HR": ["Croatia", "Croatian"],
    "NA": ["Namibia", "Namibian"], "LS": ["Lesotho"], "MA": ["Morocco", "Moroccan"], "SO": ["Somalia", "Somali"],
    "MW": ["Malawi"], "SC": ["Seychelles"], "GS": ["South Georgia"], "GL": ["Greenland"], "IS": ["Iceland"],
    "NO": ["Norway", "Norwegian"], "BM": ["Bermuda"], "HN": ["Honduras"], "BZ": ["Belize"], "UY": ["Uruguay"],
}


def country_names():
    names = {}
    fb = load_json(os.path.join(CACHE, "fishbase_subset.json"), {})
    for rec in fb.values():
        for c in rec.get("countries", []):
            if c.get("iso2") and c.get("country"):
                names.setdefault(c["iso2"], set()).add(re.sub(r"\s*\(.*\)", "", c["country"]).strip())
    for k, v in COUNTRY_EXTRA.items():
        names.setdefault(k, set()).update(v)
    return names


def forbidden(rec, cnames):
    terms = set(GENERIC)
    for c in rec["countries"]:
        terms |= set(cnames.get(c, []))
    for wb in rec["waterBodies"]:
        for part in re.split(r"[;,()]", wb):
            part = part.strip()
            if len(part) > 3:
                terms.add(part)
            terms |= {t for t in re.findall(r"[A-ZÀ-Ý][\w'’\-À-ÿ]{3,}", part) if t not in STOP}
    terms |= {t for t in re.findall(r"[A-ZÀ-Ý][\w'’\-À-ÿ]{3,}", rec["summary"]) if t not in STOP}
    return sorted(t for t in terms if t and t not in STOP)


def wiki_text(cid, limit):
    p = os.path.join(CACHE, "wiki_text", cid + ".txt")
    if not os.path.exists(p):
        return ""
    with open(p, encoding="utf-8") as fh:
        t = fh.read()
    t = re.split(r"\n==\s*(References|External links|See also|Further reading|Notes|Bibliography)\s*==", t)[0]
    t = re.sub(r"&nbsp;", " ", t)
    t = re.sub(r"\n{2,}", "\n", t)
    return t[:limit]


def bundle(ids_file, out_dir, per_file=40):
    with open(ids_file) as fh:
        ids = [ln.strip() for ln in fh if ln.strip() and not ln.startswith("#")]
    cur = {r["id"]: r for r in load_curated()}
    res = load_json(os.path.join(CACHE, "resolved.json"), {})
    fb = load_json(os.path.join(CACHE, "fishbase_subset.json"), {})
    cnames = country_names()
    os.makedirs(out_dir, exist_ok=True)
    blocks = []
    for cid in ids:
        r, rs = cur[cid], res.get(cid, {})
        f = fb.get(r["scientificName"]) or fb.get(rs.get("gbifAcceptedName") or "~") or fb.get(rs.get("inatName") or "~") or {}
        fb_url = f"https://www.fishbase.se/summary/{f['specCode']}" if f.get("specCode") else None
        size = f"{f.get('length')} cm {f.get('lengthType') or ''}".strip() if f.get("length") else None
        depth = (f"{f.get('depthShallow')}-{f.get('depthDeep')} m" if f.get("depthDeep") is not None else None)
        blocks.append("\n".join([
            f"=== ID: {cid}",
            f"NAME: {r['commonName']} ({r['scientificName']}); water: {r['waterType']}; IUCN: {(rs.get('iucn') or {}).get('code')}",
            f"SOURCES: wikipedia={rs.get('wikiUrl')} fishbase={fb_url}",
            f"FISHBASE FIELDS: maxLength={size}; depthRange={depth}; habitat={f.get('demersPelag')}; "
            f"fresh={f.get('fresh')} brack={f.get('brack')} salt={f.get('salt')}",
            f"FISHBASE COMMENTS: {(f.get('comments') or '')[:700]}",
            f"RANGE (reveal side only): {r['summary']}",
            f"FORBIDDEN in funFact/hints: {'; '.join(forbidden(r, cnames))}",
            f"WIKIPEDIA TEXT:\n{wiki_text(cid, 3200) or '(none)'}",
        ]))
    for i in range(0, len(blocks), per_file):
        with open(os.path.join(out_dir, f"bundle_{i // per_file + 1:02d}.txt"), "w", encoding="utf-8") as fh:
            fh.write("\n\n".join(blocks[i:i + per_file]))
    print(f"{len(blocks)} fish -> {out_dir}")


def check(path):
    facts = load_json(path, {})
    cur = {r["id"]: r for r in load_curated()}
    cnames = country_names()
    errs = []
    for cid, f in facts.items():
        if cid not in cur:
            errs.append(f"{cid}: unknown id")
            continue
        for k in ("funFact", "revealFact", "factSources", "hints"):
            if k not in f:
                errs.append(f"{cid}: missing {k}")
        if not f.get("funFact") or not f.get("revealFact"):
            errs.append(f"{cid}: empty funFact/revealFact")
        h = f.get("hints") or {}
        if set(h) != {"habitat", "size", "depth", "diet"}:
            errs.append(f"{cid}: hints must have exactly habitat,size,depth,diet")
        if not f.get("factSources") or not all(str(u).startswith("https://") for u in f["factSources"]):
            errs.append(f"{cid}: factSources must be https URLs")
        for k in ("funFact", "revealFact"):
            n = len(re.findall(r"[.!?](\s|$)", f.get(k) or ""))
            if n > 3:
                errs.append(f"{cid}: {k} has {n} sentences (max 2-3)")
        pre = " ".join([f.get("funFact") or ""] + [str(v) for v in h.values() if v])
        for t in forbidden(cur[cid], cnames):
            if re.search(r"(?<![\w])" + re.escape(t) + r"(?![\w])", pre):
                errs.append(f"{cid}: funFact/hints mention forbidden term '{t}'")
    print(f"{len(facts)} records, {len(errs)} problems")
    for e in errs:
        print(" ", e)
    return 1 if errs else 0


if __name__ == "__main__":
    if sys.argv[1] == "bundle":
        bundle(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 40)
    else:
        sys.exit(check(sys.argv[2]))
