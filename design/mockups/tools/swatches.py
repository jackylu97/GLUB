"""Sample a small named-swatch palette from a fish photo by median-cut quantising.

Usage: python3 -I swatches.py <photo.jpg>
"""
import sys

from PIL import Image

img = Image.open(sys.argv[1]).convert("RGB")
img.thumbnail((240, 240))
pal = img.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
counts = sorted(pal.getcolors(), reverse=True)
flat = pal.getpalette()
for count, idx in counts:
    r, g, b = flat[idx * 3 : idx * 3 + 3]
    print(f"#{r:02X}{g:02X}{b:02X}", count)
