# PT-096 analysis: per 8 px cell, how VISIBLE the ash is (mean |RGB diff| with vs without the veil, as a share
# of 255) against the wind the ash takes there (1 - windMul). Bins, the hidden-dead-air and empty-cloud shares,
# and a heat image per frame: red = dead air you cannot see, green = visible and dead, blue = visible and harmless.
import json, sys, os
from PIL import Image
D = sys.argv[1]
frames = json.load(open(os.path.join(D, 'frames.json')))
allv = []
for f in frames:
    k = f['k']; A = Image.open(os.path.join(D, f'f{k}_ash.png')).convert('RGB'); B = Image.open(os.path.join(D, f'f{k}_bare.png')).convert('RGB')
    G = json.load(open(os.path.join(D, f'f{k}_mul.json'))); W, H = G['W'], G['H']; sx = A.size[0] / W
    pa, pb = A.load(), B.load(); i = 0; heat = Image.new('RGB', (W // 8 + 1, H // 8 + 1)); hp = heat.load()
    for y in range(4, H, 8):
        for x in range(4, W, 8):
            m = G['g'][i]; i += 1
            s = 0; n = 0
            for dy in range(-3, 4, 2):
                for dx in range(-3, 4, 2):
                    X, Y = int((x + dx) * sx), int((y + dy) * sx)
                    if 0 <= X < A.size[0] and 0 <= Y < A.size[1]:
                        a, b = pa[X, Y], pb[X, Y]; s += (abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2])) / 3 / 255; n += 1
            vis = s / max(1, n); dead = 1 - m
            allv.append((vis, dead, k))
            hp[x // 8, y // 8] = (int(255 * min(1, dead * 2)) if vis < 0.06 else 0, int(255 * min(1, dead * 2)) if vis >= 0.06 else 0, int(255 * min(1, vis * 4)) if dead < 0.05 else 0)
    heat.resize((heat.size[0] * 4, heat.size[1] * 4), Image.NEAREST).save(os.path.join(D, f'f{k}_heat.png'))
def report(rows, label):
    print(f'== {label}: {len(rows)} cells')
    bins = [(0.0, 0.05, 'untouched (<5%)'), (0.05, 0.2, 'light 5-20%'), (0.2, 0.4, 'moderate 20-40%'), (0.4, 0.6, 'heavy 40-60%'), (0.6, 0.9, 'dead 60-88%')]
    for lo, hi, nm in bins:
        r = [v for v, d, _ in rows if lo <= d < hi]
        if not r: continue
        r.sort(); q = lambda p: r[min(len(r) - 1, int(p * len(r)))]
        hid = sum(1 for v in r if v < 0.06) / len(r)
        print(f'   wind taken {nm:16s} n {len(r):6d} | visibility p10 {q(0.1):.3f} med {q(0.5):.3f} p90 {q(0.9):.3f} | barely visible (<6%): {100*hid:5.1f}%')
    dead = [v for v, d, _ in rows if d >= 0.3]
    vis = [d for v, d, _ in rows if v >= 0.15]
    print(f'   HIDDEN DEAD AIR: {100*sum(1 for v in dead if v < 0.06)/max(1,len(dead)):.1f}% of cells losing >=30% of the wind are barely visible')
    print(f'   EMPTY CLOUD:     {100*sum(1 for d in vis if d < 0.05)/max(1,len(vis)):.1f}% of clearly visible ash cells lose <5% of the wind')
report(allv, 'all frames')
for f in frames: report([r for r in allv if r[2] == f['k']], f"f{f['k']} t{f['t']} age {f['ageMed']}")
