"""Stage 7: download the reviewed photo choice for each fish and write data/photos/<id>.jpg.

Input: scripts/data/photo_review.txt  (id | option | kind | spoilerRisk | note)
   option  index into photo_options.json[id].options, or "reject"
   kind    live-wild | aquarium | specimen | illustration
Raw downloads go to data/.cache/photos_raw/ (downloads only). Output images are re-encoded with Pillow:
EXIF-orientation applied, converted to RGB, long edge <= 1280 px, all metadata stripped (no EXIF GPS can
leak a location), JPEG quality 85.

Writes data/.cache/photos_final.json with the attribution record for every processed photo.
usage: python -I scripts/data/07_photos_final.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, DATA, HERE, get_bytes, load_json, read_pipe_table, save_json  # noqa: E402

from PIL import Image, ImageOps  # noqa: E402

Image.MAX_IMAGE_PIXELS = 90_000_000
RAW = os.path.join(CACHE, "photos_raw")
OUT = os.path.join(DATA, "photos")
MAX_EDGE = 1280


STD_WIDTHS = (330, 500, 960, 1280, 1920)


def commons_thumb(source_url, width):
    """Standard-size Commons thumbnail on the thumbnail host. upload.wikimedia.org throttles anonymous
    original-file downloads far harder (repeated 429 / Retry-After 300 s), so originals are avoided."""
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/([0-9a-f])/([0-9a-f]{2})/([^?]+)", source_url)
    if not m:
        return None
    a, b, name = m.groups()
    suffix = name
    if name.lower().endswith((".tif", ".tiff")):
        suffix = "lossy-page1-" + name + ".jpg"
    elif name.lower().endswith(".webp"):
        suffix = name + ".png"
    return f"https://thumb.wikimedia.org/wikipedia/commons/thumb/{a}/{b}/{name}/{width}px-{suffix}"


def wanted_width(opt):
    """Native width capped so the long edge is <= MAX_EDGE."""
    w, h = opt.get("width") or 0, opt.get("height") or 0
    if not w or not h:
        return None
    return min(w, MAX_EDGE if w >= h else int(MAX_EDGE * w / h))


def download_url(opt):
    """Commons: smallest standard thumbnail width >= the width we need. The thumbnail host upscales oversize
    requests, so the result is resized back down to the native width in main(); originals on
    upload.wikimedia.org are never requested (they are throttled hard for anonymous clients)."""
    if opt["source"] == "wikimedia":
        dw = wanted_width(opt)
        if dw:
            std = next((s for s in STD_WIDTHS if s >= dw), STD_WIDTHS[-1])
            url = commons_thumb(opt["sourceUrl"], std)
            if url:
                return url
        return opt["sourceUrl"].split("?")[0]
    return opt["sourceUrl"]  # iNat original (<= 2048 px) from the open-data bucket


def main():
    opts = load_json(os.path.join(CACHE, "photo_options.json"), {})
    review = read_pipe_table(os.path.join(HERE, "photo_review.txt"))
    os.makedirs(OUT, exist_ok=True)
    done = {}
    for row in review:
        cid, choice, kind, spoiler, note = (row + [""] * 5)[:5]
        if choice == "reject":
            continue
        opt = opts[cid]["options"][int(choice)]
        url = download_url(opt)
        ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
        raw = os.path.join(RAW, f"{cid}{ext}")
        if not get_bytes(url, raw):
            print("download failed", cid, url)
            continue
        dest = os.path.join(OUT, f"{cid}.jpg")
        with Image.open(raw) as im:
            im = ImageOps.exif_transpose(im)
            if im.mode in ("RGBA", "LA", "P"):
                im = im.convert("RGBA")
                bg = Image.new("RGB", im.size, (255, 255, 255))
                bg.paste(im, mask=im.split()[-1])
                im = bg
            im = im.convert("RGB")
            dw = wanted_width(opt) if opt["source"] == "wikimedia" else None
            if dw and im.width > dw:  # undo thumbnail-host upscaling: back to native resolution
                im = im.resize((dw, round(im.height * dw / im.width)), Image.LANCZOS)
            im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
            im.save(dest, "JPEG", quality=85, optimize=True, progressive=True)
            w, h = im.size
        done[cid] = {
            "file": f"photos/{cid}.jpg", "sourceUrl": opt["sourceUrl"], "pageUrl": opt["pageUrl"],
            "source": opt["source"], "license": opt["license"], "licenseUrl": opt.get("licenseUrl"),
            "author": opt.get("author"), "kind": kind, "width": w, "height": h,
            "spoilerRisk": spoiler.lower() == "true", "reviewNote": note, "optionIndex": int(choice),
            "downloadedFrom": url,
        }
    save_json(os.path.join(CACHE, "photos_final.json"), done)
    print("processed", len(done))


if __name__ == "__main__":
    main()
