#!/usr/bin/env python3
"""Human ice exposure along track, from the 19 shipping-format arctic recordings.

The question P2 hangs on: does the human sail through thinner ice (a ROUTING
difference) or the same ice with cleaner steering (an AVOIDANCE difference)?

Definition (must match any fleet-side probe exactly):
  at each racing-phase sample, clearance = distance from player (x,y) to the
  nearest floe EDGE among floes recorded within 1200u, each floe's localHull
  rotated by its per-sample `spin` (orientation — the recorder's comment says
  the pair gives exact extents) and translated to its per-sample (x,y).
  Negative clearance = inside the hull polygon.

⚠️ Schema: ONLY files whose floes format is [hullId,x,y,spin,vx,vy] AND which
carry floeHulls. The 3 old-format files [x,y,r,vx,vy] are excluded — mixing the
two produced the retracted "negative radius" nonsense on 2026-08-06.
"""
import json, math, os, sys, glob

TRAJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'traj')

def pt_seg_d2(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    ex, ey = ax + t * dx, ay + t * dy
    return (px - ex) ** 2 + (py - ey) ** 2

def poly_clearance(px, py, poly):
    """Signed distance to polygon edge: negative inside."""
    d2 = min(pt_seg_d2(px, py, poly[i][0], poly[i][1],
                       poly[(i + 1) % len(poly)][0], poly[(i + 1) % len(poly)][1])
             for i in range(len(poly)))
    d = math.sqrt(d2)
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        if (poly[i][1] > py) != (poly[j][1] > py):
            xin = (poly[j][0] - poly[i][0]) * (py - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]
            if px < xin:
                inside = not inside
        j = i
    return -d if inside else d

def analyze(path):
    d = json.load(open(path))
    fmt = d['format']
    # Column names are BARE post-5350cae and DECORATED before it; the floes
    # shape hint lives in the decorated name or in formatNotes. Accept both.
    def col(name):
        return next(i for i, x in enumerate(fmt) if x == name or x.startswith(name))
    fdesc = fmt[col('floes')] + (d.get('formatNotes') or {}).get('floes', '')
    if 'hullId' not in fdesc or not d.get('floeHulls'):
        return None
    hulls = {int(k): v for k, v in d['floeHulls'].items()}
    iF = col('floes'); iX = col('x'); iY = col('y')
    iPh = col('phase'); iT = col('t'); iLeg = col('leg')
    clr = []
    for s in d['samples']:
        if s[iPh] != 1:
            continue
        px, py = s[iX], s[iY]
        best = None
        for fl in s[iF]:
            hid, fx, fy, spin = fl[0], fl[1], fl[2], fl[3]
            h = hulls.get(int(hid))
            if not h:
                continue
            # cheap reject on bounding radius before the exact test
            maxr = max(math.hypot(p[0], p[1]) for p in h)
            cd = math.hypot(px - fx, py - fy)
            if best is not None and cd - maxr > best + 1:
                continue
            c, sn = math.cos(spin), math.sin(spin)
            poly = [(fx + p[0] * c - p[1] * sn, fy + p[0] * sn + p[1] * c) for p in h]
            v = poly_clearance(px, py, poly)
            if best is None or v < best:
                best = v
        if best is not None:
            clr.append((s[iT], s[iLeg], best))
    ev = [e for e in d.get('events', []) if len(e) > 2 and e[1] == 'collision_island' and e[2] == 'floe']
    return dict(file=os.path.basename(path), finished=d.get('finished'),
                fin=d.get('finishTime'), n=len(clr), clr=[c[2] for c in clr],
                floeHits=len(ev))

def pct(v, p):
    if not v: return float('nan')
    s = sorted(v); k = (len(s) - 1) * p / 100.0
    f = int(k); c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)

if __name__ == '__main__':
    rows = []
    for f in sorted(glob.glob(os.path.join(TRAJ, 'traj_arctic_*.json'))):
        r = analyze(f)
        if r: rows.append(r)
    print(f"{len(rows)} shipping-format arctic recordings")
    allc = [c for r in rows for c in r['clr']]
    print(f"pooled racing samples: {len(allc)}")
    for lab, v in [('ALL', allc)]:
        print(f"  clearance {lab}: min {min(v):.0f}  p5 {pct(v,5):.0f}  p25 {pct(v,25):.0f}  "
              f"med {pct(v,50):.0f}  p75 {pct(v,75):.0f}")
        for th in (0, 50, 100, 200, 400):
            share = sum(1 for c in v if c < th) / len(v)
            print(f"    share of race < {th:>3}u from a floe edge: {share*100:5.1f}%")
    print("\nper-race:")
    for r in rows:
        v = r['clr']
        print(f"  {r['file'][:36]:38} fin={str(r['fin'])[:6]:>7} hits={r['floeHits']:2d} "
              f"min={min(v):5.0f} p5={pct(v,5):5.0f} med={pct(v,50):6.0f}")
