"""Batched, per-item-cached Wikimedia helpers (see the rate-limit note in common.py).

  wiki_pages(titles)      -> {requested title: {"title", "wikitext", "pageimage", "missing"}}   50 per request
  commons_files(files)    -> {"File:..": imageinfo dict (url, size, mime, extmetadata, thumburl)}   50 per request
  commons_search(query)   -> [imageinfo dicts] for the top bitmap hits (one generator=search request)

Per-item results are stored under data/.cache/wiki_pages/ and data/.cache/commons_files/ so that adding
candidates later only fetches what is new.
"""
import hashlib
import json
import os

from common import CACHE, get_json, q

WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
IIPROPS = ("iiprop=url|size|mime|extmetadata&iiurlwidth=500&iiextmetadatafilter=LicenseShortName|LicenseUrl|"
           "License|Artist|Credit|ImageDescription|Categories|AttributionRequired|UsageTerms|ObjectName")


def _item_path(ns, key):
    d = os.path.join(CACHE, ns)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, hashlib.sha1(key.encode("utf-8")).hexdigest() + ".json")


def _load(ns, key):
    p = _item_path(ns, key)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    return None


def _store(ns, key, val):
    p = _item_path(ns, key)
    with open(p + ".tmp", "w", encoding="utf-8") as fh:
        json.dump(val, fh, ensure_ascii=False)
    os.replace(p + ".tmp", p)


def wiki_pages(titles):
    titles = [t for t in dict.fromkeys(titles) if t]
    out, todo = {}, []
    for t in titles:
        v = _load("wiki_pages", t)
        if v is None:
            todo.append(t)
        else:
            out[t] = v
    for i in range(0, len(todo), 50):
        chunk = todo[i:i + 50]
        url = (f"{WIKI_API}?action=query&format=json&formatversion=2&redirects=1&prop=revisions|pageimages"
               f"&rvprop=content&rvslots=main&piprop=name&titles={q('|'.join(chunk))}")
        r = get_json(url, "wiki_batch") or {}
        qy = r.get("query") or {}
        alias = {}
        for kind in ("normalized", "redirects"):
            for m in qy.get(kind, []) or []:
                alias[m["from"]] = m["to"]
        pages = {p["title"]: p for p in qy.get("pages", [])}
        for t in chunk:
            final = t
            for _ in range(3):
                final = alias.get(final, final)
            p = pages.get(final)
            if not p or p.get("missing") or p.get("invalid"):
                val = {"title": None, "missing": True}
            else:
                revs = p.get("revisions") or [{}]
                text = ((revs[0].get("slots") or {}).get("main") or {}).get("content", "")
                val = {"title": p["title"], "wikitext": text, "pageimage": p.get("pageimage"), "missing": False}
            if r:  # never cache an item from a failed batch
                _store("wiki_pages", t, val)
            out[t] = val
    return out


def commons_files(files):
    files = [f if f.startswith("File:") else "File:" + f for f in dict.fromkeys(files) if f]
    out, todo = {}, []
    for f in files:
        v = _load("commons_files", f)
        if v is None:
            todo.append(f)
        else:
            out[f] = v
    for i in range(0, len(todo), 50):
        chunk = todo[i:i + 50]
        url = (f"{COMMONS_API}?action=query&format=json&formatversion=2&redirects=1&prop=imageinfo&{IIPROPS}"
               f"&titles={q('|'.join(chunk))}")
        r = get_json(url, "commons_batch") or {}
        qy = r.get("query") or {}
        alias = {m["from"]: m["to"] for k in ("normalized", "redirects") for m in (qy.get(k) or [])}
        pages = {p["title"]: p for p in qy.get("pages", [])}
        for f in chunk:
            p = pages.get(alias.get(f, f))
            val = None
            if p and p.get("imageinfo"):
                val = dict(p["imageinfo"][0])
                val["title"] = p["title"]
            if r:
                _store("commons_files", f, val or {"missing": True})
            out[f] = val or {"missing": True}
    return out


def commons_search(query, limit=10):
    url = (f"{COMMONS_API}?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6"
           f"&gsrlimit={limit}&gsrsearch={q(query)}&prop=imageinfo&{IIPROPS}")
    r = get_json(url, "commons_gsearch") or {}
    res = []
    for p in sorted((r.get("query") or {}).get("pages", []), key=lambda p: p.get("index", 0)):
        if p.get("imageinfo"):
            v = dict(p["imageinfo"][0])
            v["title"] = p["title"]
            res.append(v)
    return res
