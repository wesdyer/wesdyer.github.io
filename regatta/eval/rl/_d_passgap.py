#!/usr/bin/env python3
"""D-sizing (fidelity push): the HUMAN's minimum-pass-gap distribution vs the
bot's scalar refusal thresholds (110u rule-19 gap, 80u NEED, 400u parked-rival).

Per player-rival encounter (rival < 600u, schema-2 corpus): the minimum
center-to-center distance over the encounter, plus the rival's speed at that
moment (parked = spd < 0.25 game speed = 1 kt). If the human routinely passes
inside the bot's refusal distances, the point-boat model is costing routes.

Usage: python3 _d_passgap.py traj/traj_*.json
"""
import json, math, sys, glob
from collections import defaultdict

RANGE = 600.0

def pct(a, p):
    if not a: return float('nan')
    s = sorted(a); k = (len(s) - 1) * p / 100.0
    f = int(k); c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)

by_venue = defaultdict(lambda: {'gaps': [], 'parked': [], 'moving': []})

files = []
for pat in sys.argv[1:]: files += glob.glob(pat)
for fn in sorted(files):
    try: d = json.load(open(fn))
    except Exception: continue
    if d.get('schema') != 2: continue
    venue = d.get('venue', '?')
    F = {n: i for i, n in enumerate(d['format'])}
    if 'rivalsX' not in F: continue
    S = [s for s in d['samples'] if s[F['phase']] == 1]
    if len(S) < 60: continue
    series = defaultdict(list)
    for i, s in enumerate(S):
        rv, rx = s[F['rivals']] or [], s[F['rivalsX']] or []
        for k, r in enumerate(rv):
            if k >= len(rx): break
            series[rx[k][0]].append((i, r[0], r[1], r[3]))
    for idx, rows in series.items():
        open_e = None
        prev_i = None
        for (i, rx_, ry_, rs_) in rows:
            px, py = S[i][F['x']], S[i][F['y']]
            dist = math.hypot(rx_ - px, ry_ - py)
            # break encounter on sampling gap (rival left capture range)
            if prev_i is not None and i - prev_i > 30 and open_e:
                g, rspd = open_e
                by_venue[venue]['gaps'].append(g)
                by_venue[venue]['parked' if rspd < 0.25 else 'moving'].append(g)
                open_e = None
            prev_i = i
            if dist < RANGE:
                if open_e is None or dist < open_e[0]:
                    open_e = (dist, rs_)
            elif open_e:
                g, rspd = open_e
                by_venue[venue]['gaps'].append(g)
                by_venue[venue]['parked' if rspd < 0.25 else 'moving'].append(g)
                open_e = None
        if open_e:
            g, rspd = open_e
            by_venue[venue]['gaps'].append(g)
            by_venue[venue]['parked' if rspd < 0.25 else 'moving'].append(g)

print(f"{'venue':10s} {'n':>4s} {'p10':>6s} {'p25':>6s} {'p50':>6s} "
      f"{'<55u':>5s} {'<80u':>5s} {'<110u':>6s}  parked(n, p50, <400u)")
for v, d in sorted(by_venue.items()):
    g = d['gaps']
    if not g: continue
    lt = lambda a, x: (100.0 * sum(1 for q in a if q < x) / len(a)) if a else float('nan')
    pk = d['parked']
    pks = f"({len(pk)}, {pct(pk,50):.0f}, {lt(pk,400):.0f}%)" if pk else "(0)"
    print(f"{v:10s} {len(g):4d} {pct(g,10):6.0f} {pct(g,25):6.0f} {pct(g,50):6.0f} "
          f"{lt(g,55):4.0f}% {lt(g,80):4.0f}% {lt(g,110):5.0f}%  {pks}")
