"""Stage 4: find openly licensed photo options for every curated candidate.

Sources (each response cached):
  * Wikipedia lead image  -> Commons imageinfo + extmetadata (real licence/author)
  * Commons file search   -> "<scientific name>" filetype:bitmap
  * iNaturalist taxon photos (per-photo licence)
  * iNaturalist research-grade observations filtered to photo_license=cc0,cc-by,cc-by-sa

Licence allowlist: CC0, Public Domain (Mark / Commons PD tags), CC BY, CC BY-SA. Anything NC/ND/ARR/GFDL-only
is dropped here and counted, so the backlog can say "only NC photos exist".

Writes data/.cache/photo_options.json: {id: {"options": [...ranked...], "rejectedLicences": {...}}}

usage: python -I scripts/data/04_photos_find.py
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, get_json, load_json, q, save_json  # noqa: E402
from curated import load_curated  # noqa: E402
from wm import commons_files, commons_search  # noqa: E402

INAT = "https://api.inaturalist.org/v1"
BAD_WORDS = re.compile(r"(preserv|museum|specimen|holotype|paratype|skeleton|skull|fossil|map|distribution|range|"
                       r"stamp|coin|banknote|logo|jar|ethanol|formalin|x-ray|xray|radiograph|fillet|market|"
                       r"\bdish\b|cooked|sushi|caviar|drawing|plate|illustration|lithograph|engraving|figure|fig\.|"
                       r"diagram|sign|poster|svg)", re.I)
ILLUS_WORDS = re.compile(r"(drawing|plate|illustration|lithograph|engraving|painting|figure|fig\.|"
                         r"\b1[6-8]\d\d\b|\b19[0-3]\d\b)", re.I)

INAT_LIC = {
    "cc0": ("CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"),
    "cc-by": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    "cc-by-sa": ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
    # iNat "pd" = photo marked public domain by the uploader (often US-government work).
    "pd": ("Public domain", "https://creativecommons.org/publicdomain/mark/1.0/"),
}


def strip_html(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def commons_licence_ok(short, lic_code):
    """Return normalised licence name or None if not allowlisted."""
    s = (short or "").strip()
    low = s.lower()
    code = (lic_code or "").lower()
    if not s and not code:
        return None
    if "nc" in re.split(r"[\s\-]", low) or "-nc" in low or "nd" in re.split(r"[\s\-]", low) or "-nd" in low:
        return None
    if low.startswith("cc0") or code.startswith("cc0"):
        return "CC0 1.0"
    if low in ("public domain", "pdm-owner", "pd") or code.startswith("pd") or "public domain" in low:
        return "Public domain"
    m = re.match(r"cc[ -]by(-sa)?[ -]?(\d\.\d)?(.*)$", low)
    if m:
        sa = "-SA" if m.group(1) else ""
        ver = m.group(2) or ""
        return f"CC BY{sa} {ver}".strip() + (m.group(3).upper().replace(" ", " ") if m.group(3) else "")
    return None


def commons_option(title, ii, via):
    md = ii.get("extmetadata") or {}
    g = lambda k: (md.get(k) or {}).get("value")  # noqa: E731
    lic = commons_licence_ok(g("LicenseShortName"), g("License"))
    mime = ii.get("mime", "")
    if mime not in ("image/jpeg", "image/png", "image/webp", "image/tiff"):
        return None, "mime:" + mime
    if lic is None:
        return None, "licence:" + str(g("LicenseShortName"))
    desc = strip_html(g("ImageDescription"))[:300]
    cats = strip_html(g("Categories"))[:300]
    return {
        "source": "wikimedia", "via": via, "title": title,
        "sourceUrl": ii.get("url"), "thumbUrl": ii.get("thumburl"), "pageUrl": ii.get("descriptionurl"),
        "license": lic, "licenseUrl": g("LicenseUrl"), "author": strip_html(g("Artist"))[:200] or None,
        "credit": strip_html(g("Credit"))[:200], "width": ii.get("width"), "height": ii.get("height"),
        "desc": desc, "cats": cats,
    }, None


def inat_photo_option(photo, via, obs=None):
    code = photo.get("license_code")
    if code not in INAT_LIC:
        return None, "licence:" + str(code)
    lic, lic_url = INAT_LIC[code]
    attr = (photo.get("attribution") or "").strip()
    m = re.match(r"\(c\)\s*(.+?),\s*(some|no) rights reserved", attr)
    author = m.group(1).strip() if m else None
    if author is None and attr:
        m = re.match(r"(.+?),\s*no known copyright restrictions", attr, re.I) or re.match(r"(?:\(c\)\s*)?(.+?)(?:,|$)", attr)
        author = m.group(1).strip() if m else None
    if author is None and attr.lower().startswith("no rights reserved"):
        author = None
    url = photo.get("url") or ""
    dims = photo.get("original_dimensions") or {}
    opt = {
        "source": "inaturalist", "via": via, "photoId": photo.get("id"),
        "sourceUrl": re.sub(r"/(square|small|medium|thumb|large)\.", "/original.", url),
        "thumbUrl": re.sub(r"/(square|small|thumb|large|original)\.", "/medium.", url),
        "pageUrl": f"https://www.inaturalist.org/photos/{photo.get('id')}",
        "license": lic, "licenseUrl": lic_url, "author": author, "attribution": attr,
        "width": dims.get("width"), "height": dims.get("height"),
    }
    if obs is not None:
        opt["obsId"] = obs.get("id")
        opt["obsUrl"] = f"https://www.inaturalist.org/observations/{obs.get('id')}"
        opt["captive"] = obs.get("captive")
        opt["faves"] = obs.get("faves_count")
    return opt, None


def score(opt):
    s = {"wiki-lead": 3.0, "inat-taxon": 2.4, "commons-search": 2.0, "inat-obs": 2.0}.get(opt["via"], 1)
    w, h = opt.get("width") or 0, opt.get("height") or 0
    long_edge = max(w, h)
    if long_edge >= 1000:
        s += 1
    elif long_edge >= 640:
        s += 0.5
    elif long_edge and long_edge < 400:
        s -= 3
    text = " ".join(str(opt.get(k) or "") for k in ("title", "desc", "cats"))
    if BAD_WORDS.search(text):
        s -= 1.5
    if ILLUS_WORDS.search(text):
        opt["maybeIllustration"] = True
    s += min((opt.get("faves") or 0) / 10.0, 0.5)
    return round(s, 2)


FORCE_SEARCH = set(os.environ.get("FORCE_SEARCH", "").split(","))


def main():
    cur = load_curated()
    resolved = load_json(os.path.join(CACHE, "resolved.json"), {})
    out = {}
    lead_info = commons_files(["File:" + r["wikiPageImage"] for r in resolved.values() if r.get("wikiPageImage")])
    for i, rec in enumerate(cur):
        cid, sci = rec["id"], rec["scientificName"]
        res = resolved.get(cid, {})
        names = {sci}
        if res.get("gbifAcceptedName"):
            names.add(res["gbifAcceptedName"])
        opts, rej = [], {}

        def add(o, why):
            if o:
                key = o.get("sourceUrl")
                if key and all(x.get("sourceUrl") != key for x in opts):
                    opts.append(o)
            elif why:
                rej[why] = rej.get(why, 0) + 1

        # 1: Wikipedia lead image (batched lookup done up-front)
        lead = res.get("wikiPageImage")
        if lead and not lead_info.get("File:" + lead, {}).get("missing"):
            add(*commons_option("File:" + lead, lead_info["File:" + lead], "wiki-lead"))
        # 3: iNat taxon photos
        tid = res.get("inatTaxonId")
        if tid:
            full = get_json(f"{INAT}/taxa/{tid}", "inat_taxon") or {}
            for tp in ((full.get("results") or [{}])[0].get("taxon_photos") or [])[:12]:
                add(*inat_photo_option(tp.get("photo") or {}, "inat-taxon"))
            # 4: open-licensed observation photos
            r = get_json(f"{INAT}/observations?taxon_id={tid}&photo_license=cc0,cc-by,cc-by-sa&quality_grade=research"
                         f"&photos=true&per_page=12&order_by=votes", "inat_obs_open") or {}
            for ob in r.get("results", []):
                for ph in (ob.get("photos") or [])[:2]:
                    add(*inat_photo_option(ph, "inat-obs", ob))
        # 2: Commons search (one generator=search request per name), only when options are thin --
        #    keeps us inside Wikimedia's anonymous rate limit. FORCE_SEARCH ids always search.
        if len(opts) < 4 or cid in FORCE_SEARCH:
            for n in sorted(names):
                for ii in commons_search(chr(34) + n + chr(34) + " filetype:bitmap", limit=10):
                    add(*commons_option(ii["title"], ii, "commons-search"))
        for o in opts:
            o["score"] = score(o)
        opts.sort(key=lambda o: -o["score"])
        out[cid] = {"options": opts[:10], "nOptions": len(opts), "rejected": rej}
        if i % 20 == 0:
            print(i, cid, len(opts), rej, flush=True)
            save_json(os.path.join(CACHE, "photo_options.json"), out)
    save_json(os.path.join(CACHE, "photo_options.json"), out)
    none = [k for k, v in out.items() if not v["options"]]
    print("done", len(out), "no allowlisted option:", len(none), none)


if __name__ == "__main__":
    main()
