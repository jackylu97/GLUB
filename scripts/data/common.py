"""Shared helpers for the Fishlocator data pipeline.

All network access goes through `get_json` / `get_bytes`, which
  * send a descriptive User-Agent (no personal contact details),
  * throttle per host,
  * honour 429/503 + Retry-After,
  * cache every response under data/.cache/<namespace>/ (including 404s), so
    re-running the pipeline never re-hits an API unless the cache is deleted.

Run scripts with `python -I`; each script inserts its own directory on sys.path
explicitly, so nothing is ever imported from a data or download directory.
"""
import hashlib
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(DATA, ".cache")
UA = "Fishlocator-data/0.1 (daily fish geography game; data assembly)"

# Seconds between requests, per throttle group.
# Wikimedia: our UA deliberately carries no contact e-mail/URL, which puts us in Wikimedia's
# anonymous tier (10 requests/minute across ALL Wikimedia sites, see
# https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits). All Wikimedia hosts therefore share one
# throttle at 6.5 s, and the pipeline batches Action API calls (50 titles per request) to stay inside it.
HOST_GROUP = {
    "en.wikipedia.org": "wikimedia",
    "commons.wikimedia.org": "wikimedia",
    "upload.wikimedia.org": "wikimedia",
    # thumb.wikimedia.org advertises its own generous budget (x-ratelimit-limit: 600000;w=60) and did not
    # 429 us; it gets a separate, still polite, 2 s throttle.
    "thumb.wikimedia.org": "wikimedia-thumb",
}
MIN_INTERVAL = {
    "api.inaturalist.org": 1.1,  # owner's limit: <= 1 req/s
    "api.gbif.org": 0.2,
    "wikimedia": 6.5,
    "wikimedia-thumb": 2.0,
    "inaturalist-open-data.s3.amazonaws.com": 0.5,
    "static.inaturalist.org": 1.0,
    "huggingface.co": 0.5,
}
_last = {}


def _throttle(host):
    group = HOST_GROUP.get(host, host)
    gap = MIN_INTERVAL.get(group, 1.0)
    wait = _last.get(group, 0) + gap - time.time()
    if wait > 0:
        time.sleep(wait)
    _last[group] = time.time()


def _fetch(url, retries=7, timeout=90):
    """Return (status, bytes, content_type). Retries on 429/5xx/network errors."""
    host = urllib.parse.urlparse(url).netloc
    delay = 5.0
    last_err = None
    for _attempt in range(retries):
        _throttle(host)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, resp.read(), resp.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                ra = e.headers.get("Retry-After")
                try:
                    pause = float(ra) if ra else delay
                except ValueError:
                    pause = delay
                pause = min(pause, 300) + random.random()
                print(f"  [{e.code}] {host}: sleeping {pause:.0f}s", file=sys.stderr)
                time.sleep(pause)
                delay = min(delay * 2, 120)
                last_err = e
                continue
            return e.code, b"", ""
        except Exception as e:  # network hiccup
            last_err = e
            time.sleep(delay)
            delay = min(delay * 2, 120)
    raise RuntimeError(f"giving up on {url}: {last_err}")


def _key(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()


def get_json(url, ns, refresh=False):
    """GET JSON through the cache. Returns parsed body, or None for a non-200."""
    folder = os.path.join(CACHE, ns)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, _key(url) + ".json")
    if os.path.exists(path) and not refresh:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh).get("body")
    status, raw, _ct = _fetch(url)
    body = None
    if status == 200:
        try:
            body = json.loads(raw.decode("utf-8"))
        except ValueError:
            body = None
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"url": url, "status": status, "fetched": time.time(), "body": body}, fh)
    os.replace(tmp, path)
    return body


def get_bytes(url, dest, refresh=False, retries=7):
    """Download a binary file to `dest` (a path inside a downloads-only directory).

    Returns True on success. A failed status is remembered in `<dest>.status` so the
    pipeline does not hammer a dead URL.
    """
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    marker = dest + ".status"
    if not refresh:
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            return True
        if os.path.exists(marker):
            return False
    try:
        status, raw, _ct = _fetch(url, retries=retries)
    except RuntimeError as e:  # persistent 429/5xx: do not mark as dead, a later run will retry
        print(f"  deferred: {e}", file=sys.stderr)
        return False
    if status != 200 or not raw:
        with open(marker, "w") as fh:
            fh.write(str(status))
        return False
    tmp = dest + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(raw)
    os.replace(tmp, dest)
    return True


def q(value):
    return urllib.parse.quote(str(value), safe="")


def read_pipe_table(path):
    """Read a '|' separated hand-curated file: '#' comments and blank lines skipped."""
    rows = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            rows.append([c.strip() for c in line.split("|")])
    return rows


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path, obj, indent=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=indent)
    os.replace(tmp, path)
