"""Stage 12 (QA): land/sea sanity check of the scoring geometry.

Downloads Natural Earth land polygons (world-atlas@2.0.2 land-50m TopoJSON, public domain) into
data/.cache/geo/ and tests every cell centre / anchor centre:
  * freshwater species: most points should be on land (cell centres of coastal cells may fall at sea)
  * marine species: most points should be at sea (island and coastal anchors may sit on land)
Prints species whose share looks wrong, for manual review.

usage: python -I scripts/data/12_landsea_qa.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, DATA, get_bytes, load_json  # noqa: E402

URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json"


def decode(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idx):
        out = []
        for i in idx:
            pts = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(pts if not out else pts[1:])
        return out

    polys = []
    for geom in topo["objects"]["land"]["geometries"]:
        groups = geom["arcs"] if geom["type"] == "MultiPolygon" else [geom["arcs"]]
        for poly in groups:
            rings = [ring(r) for r in poly]
            xs = [p[0] for p in rings[0]]
            ys = [p[1] for p in rings[0]]
            polys.append(((min(xs), min(ys), max(xs), max(ys)), rings))
    return polys


def inside(ring, x, y):
    c = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            c = not c
        j = i
    return c


def on_land(polys, lat, lng):
    for (x0, y0, x1, y1), rings in polys:
        if x0 <= lng <= x1 and y0 <= lat <= y1 and inside(rings[0], lng, lat):
            if not any(inside(h, lng, lat) for h in rings[1:]):
                return True
    return False


def main():
    dest = os.path.join(CACHE, "geo", "land-50m.json")
    if not get_bytes(URL, dest):
        print("could not fetch land polygons")
        return
    with open(dest, encoding="utf-8") as fh:
        polys = decode(json.load(fh))
    fish = load_json(os.path.join(DATA, "fish.json"), [])
    flagged = 0
    for f in fish:
        r = f["range"]
        pts = [(c[0], c[1]) for c in r["cells"]] + [(a["lat"], a["lng"]) for a in r["anchors"]]
        land = sum(on_land(polys, lat, lng) for lat, lng in pts)
        share = land / len(pts)
        fw = f["waterType"] == "freshwater"
        if (fw and share < 0.5) or (f["waterType"] == "marine" and share > 0.5):
            flagged += 1
            print(f"CHECK {f['id']}: {f['waterType']} {land}/{len(pts)} points on land ({r['method']})")
    print(f"{len(fish)} records checked, {flagged} flagged for review")


if __name__ == "__main__":
    main()
