"""Bin the gust layer's luma delta by puff intensity, averaged over several frame pairs.

Run eval/_puff_tone.js first; this differences what it wrote.
  python3 eval/_puff_tone.py
"""
import json
from PIL import Image
import numpy as np

OUT = "/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad"
meta = json.load(open(f"{OUT}/_puff_meta.json"))
mask = np.array(json.load(open(f"{OUT}/_puff_mask.json")))
xs = mask[:, 0].astype(int); ys = mask[:, 1].astype(int); vs = mask[:, 2]
# ⚠️ SINGLE-CELL PIXELS ONLY. The renderer draws cells independently, so where two overlap
# the pixel carries whichever was painted last — not the one the field calls strongest. On a
# venue with many lulls that mislabels most of the frame and inverts the reported sign.
solo = mask[:, 3] == 1

W = np.array([0.2126, 0.7152, 0.0722])
acc = None
for i in range(meta["pairs"]):
    on = np.asarray(Image.open(f"{OUT}/_puff_on_{i}.png").convert("RGB")).astype(float) @ W
    off = np.asarray(Image.open(f"{OUT}/_puff_off_{i}.png").convert("RGB")).astype(float) @ W
    d = (on - off)[ys, xs]
    acc = d if acc is None else acc + d
d = acc / meta["pairs"]

# ⚠️ SPLIT BY SIGN. A gust darkens and a lull brightens, so binning on |intensity| averages
# the two together and reports the mix — which on a venue with 11 lulls to 3 gusts came out
# POSITIVE and looked like gusts were brightening the water. They are not; the bins were.
a = np.abs(vs)
bins = {}
for nm, sel in (("GUST", (vs > 0) & solo), ("LULL", (vs < 0) & solo)):
    bins[f"{nm} core >0.6"] = sel & (a > 0.6)
    bins[f"{nm} mid .3-.6"] = sel & (a > 0.3) & (a <= 0.6)
    bins[f"{nm} edge .05-.3"] = sel & (a > 0.05) & (a <= 0.3)
bins["clear <0.05"] = (a <= 0.05) & (mask[:, 3] == 0)
print(f"  {meta['venue']}  framed cell {meta['cell']['type']} delta {meta['cell']['delta']} kt   "
      f"averaged over {meta['pairs']} frame pairs")
print("  WATER TONE — luma delta caused by the gust layer (0-255 scale; - is darker)")
base = float(d[bins["clear <0.05"]].mean())
for k, sel in bins.items():
    n = int(sel.sum())
    if n < 200:
        continue
    m = float(d[sel].mean())
    print(f"    {k:16} {m:+7.2f}   ({abs(m - base) / 255 * 100:4.1f}% of full scale)   n={n}")
cov = float((a > 0.05).mean())
print(f"  the layer covers {cov*100:.0f}% of the frame")
print("  guide: ~1-2% of full scale is 'just perceptible'; 5%+ reads as an overlay")
