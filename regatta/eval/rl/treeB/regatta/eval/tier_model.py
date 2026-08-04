#!/usr/bin/env python3
"""Fit measured character speed to the stat line and archetype.

Reads regatta/eval/tier_report.json (produced by `tier_eval.js --merge`) and the
AI_CONFIG block in script.js, then regresses each character's measured fleet
delta on its seven stats plus its archetype.

    delta_i = b0 + sum_s (b_s * stat_is) + archetype_i + noise

Why regress instead of reading the multipliers out of the code: the code's
multipliers (upwind 1.2%/pt, pressure 5%/pt, ...) say how each stat changes an
instantaneous speed, not how many SECONDS it is worth over a whole race. A boat
spends most of its time on the beat, gusts only fire some of the time, and
handling only pays at the corners. The regression prices each stat in the unit
that matters — seconds of finish time — and folds in every interaction with the
AI's behaviour for free.

Observations are weighted by 1/se^2: characters measured more precisely
(more races, less luck) pull the fit harder than noisy ones.

    python3 regatta/eval/tier_model.py
    python3 regatta/eval/tier_model.py --design acceleration=3,pressure=4,...
"""

import json
import re
import sys
import numpy as np

STATS = ['acceleration', 'momentum', 'handling', 'upwind', 'reach', 'downwind', 'pressure']
REPORT = 'regatta/eval/tier_report.json'
SCRIPT = 'regatta/js/script.js'


def load_config():
    src = open(SCRIPT).read()
    blk = re.search(r'const AI_CONFIG = \[([\s\S]*?)\n\];', src).group(1)
    out = {}
    for line in blk.split('\n'):
        if 'name:' not in line:
            continue
        name = re.search(r"name: '([^']+)'", line).group(1)
        arch = re.search(r"archetype: '([^']+)'", line).group(1)
        raw = re.search(r'stats: \{([^}]+)\}', line).group(1)
        stats = {}
        for part in raw.split(','):
            k, v = part.split(':')
            stats[k.strip()] = int(v)
        out[name] = {'archetype': arch, 'stats': stats}
    return out


def fit(rows, cfg):
    names = [r['name'] for r in rows if r['name'] in cfg]
    archs = sorted({cfg[n]['archetype'] for n in names})
    ref = archs[0]                      # reference level, folded into the intercept
    others = [a for a in archs if a != ref]

    X, y, w = [], [], []
    for r in rows:
        n = r['name']
        if n not in cfg:
            continue
        row = [1.0] + [cfg[n]['stats'][s] for s in STATS]
        row += [1.0 if cfg[n]['archetype'] == a else 0.0 for a in others]
        X.append(row)
        y.append(r['delta'])
        se = max(r['se'], 1e-6)
        w.append(1.0 / (se * se))

    X = np.array(X); y = np.array(y); w = np.array(w)
    W = np.sqrt(w)
    Xw = X * W[:, None]; yw = y * W

    beta, *_ = np.linalg.lstsq(Xw, yw, rcond=None)
    resid = y - X @ beta

    # Weighted R^2
    ybar = np.sum(w * y) / np.sum(w)
    ss_res = np.sum(w * resid ** 2)
    ss_tot = np.sum(w * (y - ybar) ** 2)
    r2 = 1 - ss_res / ss_tot

    # Coefficient standard errors from the weighted normal equations
    dof = max(1, len(y) - X.shape[1])
    sigma2 = ss_res / dof
    cov = sigma2 * np.linalg.pinv(Xw.T @ Xw)
    se_beta = np.sqrt(np.maximum(np.diag(cov), 0))

    labels = ['(intercept)'] + STATS + [f'arch:{a}' for a in others]
    return {'beta': beta, 'se': se_beta, 'labels': labels, 'r2': r2, 'ref': ref,
            'others': others, 'resid': resid, 'names': names, 'X': X, 'y': y}


def main():
    rows = json.load(open(REPORT))['rows']
    cfg = load_config()
    m = fit(rows, cfg)

    print(f"\n=== WHAT EACH STAT IS WORTH ===")
    print(f"seconds of finish time per +1 stat point (negative = faster)")
    print(f"weighted R^2 = {m['r2']:.3f}   n = {len(m['names'])} characters")
    print(f"archetype reference level = {m['ref']}\n")
    print(f"{'term':<16} {'coef':>8} {'±se':>7}   {'t':>6}")
    print('-' * 44)
    for lab, b, s in zip(m['labels'], m['beta'], m['se']):
        t = b / s if s > 0 else 0
        star = ' *' if abs(t) >= 2 else ''
        print(f"{lab:<16} {b:>+8.3f} {s:>7.3f}   {t:>+6.2f}{star}")

    print("\n=== STAT LEVERAGE (seconds across the full -5..+5 range) ===")
    lev = sorted(
        ((abs(m['beta'][1 + i]) * 10, STATS[i], m['beta'][1 + i]) for i in range(len(STATS))),
        reverse=True)
    for span, name, b in lev:
        bar = '#' * int(round(span * 2))
        print(f"  {name:<13} {span:5.2f}s  {bar}")

    print("\n=== BIGGEST MODEL MISSES (measured minus predicted) ===")
    order = np.argsort(-np.abs(m['resid']))
    print("  a large negative residual = races faster than its stat line explains")
    for i in order[:8]:
        n = m['names'][i] if i < len(m['names']) else '?'
        print(f"  {n:<13} measured {m['y'][i]:+7.2f}s   residual {m['resid'][i]:+6.2f}s"
              f"   ({cfg[n]['archetype']})")

    if '--design' in sys.argv:
        spec = sys.argv[sys.argv.index('--design') + 1]
        stats = {s: 0 for s in STATS}
        arch = None
        for part in spec.split(','):
            k, v = part.split('=')
            if k.strip() == 'archetype':
                arch = v.strip()
            else:
                stats[k.strip()] = int(v)
        row = [1.0] + [stats[s] for s in STATS]
        row += [1.0 if arch == a else 0.0 for a in m['others']]
        pred = float(np.array(row) @ m['beta'])
        deltas = sorted(r['delta'] for r in rows)
        rank = sum(1 for d in deltas if d < pred) + 1
        print(f"\n=== DESIGN PREDICTION ===")
        print(f"  stats     {stats}")
        print(f"  archetype {arch}")
        print(f"  predicted delta {pred:+.2f}s  ->  rank {rank} of {len(deltas) + 1}")


if __name__ == '__main__':
    main()
