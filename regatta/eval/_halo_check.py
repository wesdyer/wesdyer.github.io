# Probe: white HALOS round painted sprites. For each PNG: the edge ring (alpha 20-235) vs the solid pixels just inside it
# (alpha > 235, within 3 px of the edge). A halo = an edge clearly LIGHTER than the body it borders. Reports the
# lightness gap and the share of edge pixels that are near-white (luma > 200) where the body beside them is dark.
#   python3 regatta/eval/_halo_check.py <png or dir>...
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage
files = []
for a in sys.argv[1:]: files += sorted(glob.glob(os.path.join(a, '*.png'))) if os.path.isdir(a) else [a]
for f in files:
    im = np.array(Image.open(f).convert('RGBA')).astype(float); al = im[:, :, 3]; lum = im[:, :, :3] @ [0.299, 0.587, 0.114]
    solid = al > 235
    if solid.sum() < 50: continue
    edge = (al > 20) & (al <= 235)
    near = solid & ~ndimage.binary_erosion(solid, iterations=3)
    if edge.sum() < 20: continue
    # the solid lightness next to each edge pixel
    # the MEAN solid lightness within 3 px of each edge pixel (a max would hide a light fringe on a dark animal)
    sm = ndimage.uniform_filter(np.where(near, lum, 0), size=7); cnt = ndimage.uniform_filter(near.astype(float), size=7)
    e_l = lum[edge]; b_l = np.where(cnt[edge] > 1e-3, sm[edge] / np.maximum(cnt[edge], 1e-3), np.nan)
    gap = np.nanmedian(e_l - b_l)
    white = np.mean((e_l > 200) & (b_l < 120))
    flag = 'HALO?' if gap > 25 or white > 0.08 else ''
    print(f'{os.path.relpath(f):60s} edge-body lightness {gap:+6.1f}  white-on-dark edge {100*white:5.1f}%  {flag}')
