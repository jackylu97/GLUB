"""Stage 9 (QA helper): compact per-candidate review text for manual range verification and spot checks.

usage: python -I scripts/data/09_review_dump.py <out_dir> [ids_file]
Writes <out_dir>/review_NN.txt, ~25 candidates per file:
  curated range | FishBase native/endemic diff | GBIF cell summary | Wikipedia sentences about range
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, load_json  # noqa: E402
from curated import load_curated  # noqa: E402

KEY = re.compile(r"(endemic|native|found (only )?in|occurs|known (only )?from|distribut|range|restricted|"
                 r"inhabit|lives? in|confined|population|river|lake|island|coast|sea\b|basin|spring|cave|"
                 r"introduc|translocat|extinct|extirpat)", re.I)


def wiki_sentences(cid, limit=900):
    p = os.path.join(CACHE, "wiki_text", cid + ".txt")
    if not os.path.exists(p):
        return "(no Wikipedia article)"
    with open(p, encoding="utf-8") as fh:
        text = fh.read()
    text = re.split(r"\n==\s*(References|External links|See also|Further reading)\s*==", text)[0]
    sents = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text))
    keep = [s for s in sents if KEY.search(s)]
    out = " ".join(keep)
    return out[:limit] + ("…" if len(out) > limit else "")


def main():
    out_dir = sys.argv[1]
    ids = None
    if len(sys.argv) > 2:
        with open(sys.argv[2]) as fh:
            ids = [ln.strip() for ln in fh if ln.strip() and not ln.startswith("#")]
    cur = {r["id"]: r for r in load_curated()}
    res = load_json(os.path.join(CACHE, "resolved.json"), {})
    fb = load_json(os.path.join(CACHE, "fishbase_subset.json"), {})
    rng = load_json(os.path.join(CACHE, "ranges.json"), {})
    os.makedirs(out_dir, exist_ok=True)
    blocks = []
    for cid in ids or list(cur):
        r = cur[cid]
        rs = res.get(cid, {})
        f = fb.get(r["scientificName"]) or fb.get(rs.get("gbifAcceptedName") or "~") or {}
        nat = sorted({f"{c['iso2']}:{c['status'][:3]}" for c in f.get("countries", []) if c.get("iso2") and c.get("status")})
        g = rng.get(cid, {})
        cells = g.get("cells", [])
        blocks.append("\n".join([
            f"## {cid} — {r['scientificName']} [{(rs.get('iucn') or {}).get('code')}] {r['region']} {r['waterType']}",
            f"CURATED: {r['summary']} | countries={','.join(r['countries'])} | bbox={r['bbox']} | anchors={[(a['lat'], a['lng'], a['radiusKm']) for a in r['anchors']]}",
            f"FISHBASE: {' '.join(nat) or '(none)'} | eco: {', '.join(sorted({e['name'] for e in f.get('ecosystems', []) if e.get('name')}))[:200]}",
            f"GBIF: method={g.get('method')} raw={g.get('gbifRaw')} used={g.get('gbifUsed')} cells={len(cells)} "
            f"extent={g.get('cellExtent')} countries={g.get('countries')} dropped={g.get('dropped')}",
            f"WIKI ({rs.get('wikiTitle')}): {wiki_sentences(cid)}",
        ]))
    for i in range(0, len(blocks), 25):
        with open(os.path.join(out_dir, f"review_{i // 25 + 1:02d}.txt"), "w", encoding="utf-8") as fh:
            fh.write("\n\n".join(blocks[i:i + 25]))
    print(len(blocks), "blocks")


if __name__ == "__main__":
    main()
