#!/usr/bin/env python3
"""HOW MUCH OF A PAIRED BENCH'S NOISE IS THE ROSTER? (2026-08-08)

The methodology question: should the AI benchmark race CHARACTER-STATTED bots
(as it does) or a neutral fleet? The argument for stats is that the differences
wash out over many observations. That is testable on data already collected,
because a paired bench holds the character FIXED across the pair — the same seed
puts the same character in the same boat on both trees — so every paired delta is
already character-matched.

What stats can still do is inflate the SPREAD: if a change helps a high-handling
boat and hurts a low-handling one, the deltas fan out and the estimator needs more
seeds to see through it. So decompose the paired deltas by character:

    between-character variance  — do different characters respond DIFFERENTLY to
                                  the change? (this is what a neutral fleet removes)
    within-character variance   — race-to-race chaos: traffic, bifurcations, ice
                                  draw (this is what a neutral fleet does NOT remove)

If between/total is small, the roster genuinely washes out and a neutral fleet buys
nothing on this axis. If it is large, a neutral fleet buys real resolution.

    python3 _stat_var.py <base_label> <cand_label> [more label pairs...]
    e.g. python3 _stat_var.py bp2rr9400 cc1rr9400 bp2rr9500 cc1rr9500 ...
"""
import json, os, sys, statistics
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

def load(label):
    p = os.path.join(HERE, f'ocean_bench_{label}.json')
    if not os.path.exists(p):
        p = os.path.join(HERE, f'fleet_leg2_{label}.json')
    return json.load(open(p)) if os.path.exists(p) else None

def deltas(base_label, cand_label):
    A, B = load(base_label), load(cand_label)
    if not A or not B:
        print(f'  (missing {base_label} or {cand_label})')
        return []
    bA = {t['seed']: t for t in A}
    bB = {t['seed']: t for t in B}
    out = []
    for seed in bA:
        if seed not in bB:
            continue
        mb = {x['name']: x for x in bB[seed]['info']}
        for a in bA[seed]['info']:
            b = mb.get(a['name'])
            if not b or a.get('fin') is None or b.get('fin') is None:
                continue
            out.append((a['name'], b['fin'] - a['fin']))
    return out

pairs = sys.argv[1:]
if len(pairs) < 2 or len(pairs) % 2:
    print(__doc__)
    sys.exit(1)

allrows = []
for i in range(0, len(pairs), 2):
    allrows += deltas(pairs[i], pairs[i + 1])

if not allrows:
    print('no paired rows found')
    sys.exit(1)

by = defaultdict(list)
for name, d in allrows:
    by[name].append(d)

vals = [d for _, d in allrows]
grand = statistics.mean(vals)
total_var = statistics.pvariance(vals)

# ⚠️ PROBE AUDIT (standing rule 18). The NAIVE between-group variance is badly
# biased upward when groups are small: with ~98 characters over ~365 boats most
# groups hold 1-4 races, and a group of one reproduces its own race noise as
# "between-character" signal. On the redrock set the naive figure read 30.5% and
# almost all of it was that bias. Use the one-way random-effects estimator, which
# subtracts the within mean square before attributing anything to the roster:
#     sigma2_between = (MSB - MSW) / n0
# with n0 the effective group size. Negative means the data cannot distinguish
# the roster from zero, and that is reported as zero, not as a small positive.
n_tot = len(vals)
k = len(by)
ssb = sum(len(v) * (statistics.mean(v) - grand) ** 2 for v in by.values())
ssw = sum(sum((x - statistics.mean(v)) ** 2 for x in v) for v in by.values())
naive_between = ssb / n_tot
if k > 1 and n_tot > k:
    msb = ssb / (k - 1)
    msw = ssw / (n_tot - k)
    n0 = (n_tot - sum(len(v) ** 2 for v in by.values()) / n_tot) / (k - 1)
    between = max(0.0, (msb - msw) / n0) if n0 > 0 else 0.0
    within = max(0.0, total_var - between)
else:
    msb = msw = float('nan')
    between, within = naive_between, total_var - naive_between
print(f'  [naive between-group share would read {100*naive_between/total_var:.1f}% —'
      f' small-group bias; corrected below]')
print(f'  [MSB {msb:.0f} vs MSW {msw:.0f} over {k} characters, effective group size {n0:.1f}]')

print(f'{len(allrows)} paired boats over {len(by)} characters')
print(f'  grand mean delta   {grand:+8.2f} s      median {statistics.median(vals):+8.2f} s')
print(f'  TOTAL variance     {total_var:10.1f}   (sd {total_var**0.5:.1f} s)')
print(f'  between-character  {between:10.1f}   ({100*between/total_var:5.1f}% — what a NEUTRAL fleet removes)')
print(f'  within-character   {within:10.1f}   ({100*within/total_var:5.1f}% — race chaos; a neutral fleet keeps this)')
print()
print('  per-character mean delta (n):')
for name in sorted(by, key=lambda k: statistics.mean(by[k])):
    v = by[name]
    print(f'    {name:10} {statistics.mean(v):+8.1f}  (n={len(v):3d}, sd {statistics.pstdev(v):6.1f})')
print()
# What the between-share implies for how many seeds a verdict needs.
if between / total_var < 0.05:
    print('  READ: the roster washes out — a neutral fleet buys <5% of the variance.')
else:
    shrink = (within / total_var) ** 0.5
    print(f'  READ: a neutral fleet would cut the sd to ~{100*shrink:.0f}% of current,')
    print(f'        i.e. the same resolution from ~{(shrink**2)*100:.0f}% of the seeds.')
