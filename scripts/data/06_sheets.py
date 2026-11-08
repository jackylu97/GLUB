"""Stage 6: contact sheets for visual review.

usage:
  python -I scripts/data/06_sheets.py top  [ids_file]   # option #0 for every candidate (or ids listed)
  python -I scripts/data/06_sheets.py alt  ids_file     # options #0..#5 for each listed id
  python -I scripts/data/06_sheets.py final             # the processed data/photos/*.jpg

Thumbnails go to data/.cache/thumbs/ (downloads only); sheets to data/.cache/sheets/.
Each tile is captioned "<id> #<option> <licence>" so the review file can refer to it.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, DATA, get_bytes, load_json  # noqa: E402

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

Image.MAX_IMAGE_PIXELS = 60_000_000
TW, TH, CAP = 320, 230, 34
COLS, ROWS = 6, 4
THUMBS = os.path.join(CACHE, "thumbs")
SHEETS = os.path.join(CACHE, "sheets")


def font(size):
    for p in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def tile(path, caption1, caption2):
    t = Image.new("RGB", (TW, TH + CAP), (30, 30, 30))
    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((TW, TH))
            t.paste(im, ((TW - im.width) // 2, (TH - im.height) // 2))
    except Exception as e:  # unreadable download
        ImageDraw.Draw(t).text((10, 10), f"unreadable: {e}"[:40], fill=(255, 80, 80), font=font(13))
    d = ImageDraw.Draw(t)
    d.text((4, TH + 1), caption1[:44], fill=(255, 255, 255), font=font(15))
    d.text((4, TH + 18), caption2[:52], fill=(190, 190, 190), font=font(12))
    return t


def sheets(tiles, prefix):
    os.makedirs(SHEETS, exist_ok=True)
    per = COLS * ROWS
    paths = []
    for s in range(0, len(tiles), per):
        chunk = tiles[s:s + per]
        sheet = Image.new("RGB", (COLS * TW, ROWS * (TH + CAP)), (0, 0, 0))
        for i, t in enumerate(chunk):
            sheet.paste(t, ((i % COLS) * TW, (i // COLS) * (TH + CAP)))
        p = os.path.join(SHEETS, f"{prefix}_{s // per + 1:02d}.jpg")
        sheet.save(p, quality=82)
        paths.append(p)
    return paths


def commons_thumb(source_url, width):
    """Standard-size Commons thumbnail URL on the thumbnail host (upload.wikimedia.org throttles original
    downloads for anonymous clients far harder than thumbnails)."""
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/([0-9a-f])/([0-9a-f]{2})/([^?]+)", source_url)
    if not m:
        return None
    a, b, name = m.groups()
    thumb_name = name if not name.lower().endswith((".tif", ".tiff")) else name + ".jpg"
    if name.lower().endswith((".tif", ".tiff")):
        thumb_name = "lossy-page1-" + name + ".jpg"
    return f"https://thumb.wikimedia.org/wikipedia/commons/thumb/{a}/{b}/{name}/{width}px-{thumb_name}"


def thumb_for(cid, n, opt):
    dest = os.path.join(THUMBS, f"{cid}__{n}.jpg")
    url = opt.get("thumbUrl") or opt.get("sourceUrl")
    if opt["source"] == "wikimedia":
        w = opt.get("width") or 0
        if "/thumb/" not in (opt.get("thumbUrl") or ""):
            url = commons_thumb(opt["sourceUrl"], 330) if w > 330 else None
            if url is None:
                return None
    ok = get_bytes(url, dest)
    return dest if ok else None


def main():
    mode = sys.argv[1]
    opts = load_json(os.path.join(CACHE, "photo_options.json"), {})
    ids = None
    if len(sys.argv) > 2:
        with open(sys.argv[2]) as fh:
            ids = [ln.strip() for ln in fh if ln.strip() and not ln.startswith("#")]
    tiles = []
    if mode == "final":
        folder = os.path.join(DATA, "photos")
        for f in sorted(os.listdir(folder)):
            if f.endswith(".jpg"):
                with Image.open(os.path.join(folder, f)) as im:
                    dims = f"{im.width}x{im.height}"
                tiles.append(tile(os.path.join(folder, f), f[:-4], dims))
        print("\n".join(sheets(tiles, "final")))
        return
    for cid in (ids or list(opts)):
        o = opts.get(cid, {}).get("options", [])
        rng = range(1, min(len(o), 6)) if mode == "alt" else range(min(len(o), 1))
        for n in rng:
            p = thumb_for(cid, n, o[n])
            lic = o[n]["license"].replace("CC ", "")
            dims = f"{o[n].get('width')}x{o[n].get('height')}"
            tiles.append(tile(p, f"{cid} #{n}", f"{lic} {o[n]['via']} {dims}") if p else
                         tile("/nonexistent", f"{cid} #{n}", "download failed"))
    print("\n".join(sheets(tiles, mode)))


if __name__ == "__main__":
    main()
