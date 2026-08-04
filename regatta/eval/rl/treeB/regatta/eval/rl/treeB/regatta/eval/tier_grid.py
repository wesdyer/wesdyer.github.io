#!/usr/bin/env python3
"""Two tier rankings for the current roster, and the grid between them.

TODAY  — measured. 1,200 races on Sea Trial Bay, leave-one-out fleet delta.
         This is what the game is, and every venue races windward-leeward.

FUTURE — modelled. The same stat lines re-priced for the course shapes specced in
         guidelines/venues.md. NOT a prediction of what characters will be after
         the roster rework: it deliberately uses each character's CURRENT seven
         stats, so the difference between the two columns isolates one thing —
         who is propped up by a W/L-only game, and who is suppressed by it.
         Those are the characters step 3 should touch first.

The future model has two grounded parts and one judgement call, kept separate:

  grounded   point-of-sail re-pricing. Course shapes are specced and the speed
             multipliers are in code. Upwind time share 55%->40%, downwind
             45%->29.5%, reach 0%->30.5%. Reach has no measurable value today to
             rescale, so it is priced from upwind's value per unit of time on that
             point of sail, times reach's larger multiplier (0.018 vs 0.012).

  grounded   conditions re-pricing. lightAir/heavyAir are keyed to the day's base
             wind, so their value depends on the VENUE WIND DISTRIBUTION, not the
             course shape. Sea Trial Bay draws 8-18kn, which sits almost entirely
             inside the 10-16 neutral band: expected exposure 0.017 for both. Across
             the ten venues it is 0.101 and 0.076 — so these stats are worth ~6.0x
             and ~4.5x more in the real venue set than on the benchmark that measures
             them. Concentrated, too: swamp carries lightAir (0.722) and arctic
             carries heavyAir (0.556); four venues touch neither.

  judgement  how much the four non-point-of-sail stats rise as hazards, gates and
             drag zones arrive. Bracketed rather than guessed at a point value:
               CONSERVATIVE  they do not rise at all
               AGGRESSIVE    they rise 50%
             A character whose tier is the same under both is solid; one that
             moves between them is flagged uncertain.
"""

import json, re, sys
import numpy as np

STATS = ['acceleration', 'momentum', 'handling', 'upwind', 'reach', 'downwind', 'pressure']
TIER_SHAPE = [('S', 0.12), ('A', 0.21), ('B', 0.33), ('C', 0.21), ('D', 0.13)]

# Coefficients are FIT FROM THE CURRENT REPORT, never hardcoded — a stale constant
# is how a ranking quietly starts describing a build that no longer exists.
import importlib.util as _il
_spec = _il.spec_from_file_location('tier_model', 'regatta/eval/tier_model.py')
_tm = _il.module_from_spec(_spec); _spec.loader.exec_module(_tm)

# Venue wind exposure for the conditions stats: E[t^2] over each venue's wind range,
# t = normalised depth into the light (<10kn) or heavy (>16kn) band.
# lightAir/heavyAir CANNOT be fitted from seatrials data — the benchmark's 8-18kn
# range sits inside the 10-16 neutral band, so exposure there is 0.017 and any
# regression coefficient would be noise. They are MODELLED instead, straight from the
# mechanic: effect per point = perPoint(0.012) * E[t^2] * race time (~205s).
GROOVE_PER_POINT = 0.012
RACE_SECONDS = 205.0
EXPOSURE_TODAY = dict(lightAir=0.017, heavyAir=0.017)   # seatrials, 8-18kn
EXPOSURE_FUTURE = dict(lightAir=0.101, heavyAir=0.076)  # mean over the ten venues
def groove_coef(exposure):
    return -GROOVE_PER_POINT * exposure * RACE_SECONDS
COND_STATS = ['lightAir', 'heavyAir']

# Time share on each point of sail, from the ten planned course shapes
UP_TODAY, DOWN_TODAY = 0.55, 0.45
UP_FUT, REACH_FUT, DOWN_FUT = 0.40, 0.305, 0.295
SOFT = ['acceleration', 'momentum', 'handling', 'pressure']   # the judgement call


def load_config():
    src = open('regatta/js/script.js').read()
    blk = re.search(r'const AI_CONFIG = \[([\s\S]*?)\n\];', src).group(1)
    out = {}
    for line in blk.split('\n'):
        if 'name:' not in line:
            continue
        name = re.search(r"name: '([^']+)'", line).group(1)
        arch = re.search(r"archetype: '([^']+)'", line).group(1)
        raw = re.search(r'stats: \{([^}]+)\}', line).group(1)
        stats = {k.strip(): float(v) for k, v in (p.split(':') for p in raw.split(','))}
        out[name] = dict(archetype=arch, stats=stats)
    return out


def fit_today(rows, cfg):
    """Stat prices, pinned at measurement time — NOT re-fitted here.

    Re-deriving coefficients from the CURRENT stats against a STORED measurement is
    invalid the moment any stat changes: the deltas were produced by the stats as
    they were when the races ran. Regressing new inputs on old outputs quietly
    corrupts every coefficient (observed: R^2 collapsing 0.953 -> 0.703 after eleven
    characters were reworked, which then appeared to move them off targets they had
    actually hit). Prices are a property of the game's mechanics, not of who
    currently holds which number, so they live in stat_prices.json and are refreshed
    only by a fresh measure -> fit -> overwrite cycle.
    """
    pin = json.load(open('regatta/eval/stat_prices.json'))
    today = dict(pin['stats'])
    arch = dict(pin['archetypes'])
    for k in COND_STATS:
        today[k] = groove_coef(EXPOSURE_TODAY[k])
    today['memory'] = 0.0          # plumbed, no mechanic yet — priced honestly at zero
    return today, arch, float(pin['intercept']), float(pin['r2'])


def future_coefs(today, soft_mult):
    c = dict(today)
    per_pct_up = today['upwind'] / UP_TODAY
    c['upwind'] = today['upwind'] * (UP_FUT / UP_TODAY)
    c['downwind'] = today['downwind'] * (DOWN_FUT / DOWN_TODAY)
    c['reach'] = per_pct_up * (0.018 / 0.012) * REACH_FUT
    for k in COND_STATS:
        c[k] = groove_coef(EXPOSURE_FUTURE[k])
    for s in SOFT:
        c[s] = today[s] * soft_mult
    return c


ALL_STATS = STATS + COND_STATS + ['memory']


def score(stats, arch, coefs, arch_tbl, intercept):
    return intercept + sum(coefs[s] * stats.get(s, 0) for s in ALL_STATS) + arch_tbl.get(arch, 0.0)


def assign_tiers(order):
    """order: list of (name, delta) sorted fastest first -> {name: tier}"""
    n, i, out = len(order), 0, {}
    for tier, frac in TIER_SHAPE:
        for _ in range(round(frac * n)):
            if i < n:
                out[order[i][0]] = tier
                i += 1
    while i < n:
        out[order[i][0]] = 'D'
        i += 1
    return out


def main():
    cfg = load_config()
    report = json.load(open('regatta/eval/tier_report.json'))
    measured = {r['name']: r['delta'] for r in report['rows']}

    TODAY, ARCH, INTERCEPT, r2 = fit_today(report['rows'], cfg)
    print(f"fitted from {report['trials']} races on {report.get('venue','?')}, "
          f"weighted R^2 {r2:.3f}")
    # speedScale is gone from the code, so the measured archetype table already
    # reflects the fix — no adjustment, unlike the previous version of this script.
    arch_future = dict(ARCH)

    today_order = sorted(measured.items(), key=lambda kv: kv[1])
    today_tier = assign_tiers(today_order)

    scen = {}
    for label, mult in (('cons', 1.0), ('aggr', 1.5)):
        c = future_coefs(TODAY, mult)
        board = sorted(((n, score(cfg[n]['stats'], cfg[n]['archetype'], c, arch_future, INTERCEPT))
                        for n in cfg if n in measured), key=lambda kv: kv[1])
        scen[label] = dict(order=board, tier=assign_tiers(board), delta=dict(board))

    fut_tier = scen['cons']['tier']
    uncertain = {n for n in fut_tier if fut_tier[n] != scen['aggr']['tier'][n]}

    # Decompose the move. The future model changes two things at once — the course
    # mix and the speedScale removal — and shift characters get both. Without this
    # split, "reaching legs lift the shift archetype" would be an artefact.
    cons_c = future_coefs(TODAY, 1.0)
    order_i = {t: i for i, (t, _) in enumerate(TIER_SHAPE)}
    rows = []
    for n in cfg:
        if n not in measured:
            continue
        st, ar = cfg[n]['stats'], cfg[n]['archetype']
        pred_today = score(st, ar, TODAY, ARCH, INTERCEPT)
        pred_course = score(st, ar, cons_c, ARCH, INTERCEPT)
        rows.append(dict(name=n, archetype=ar, reach=st['reach'],
                         today_delta=measured[n], today=today_tier[n],
                         future=fut_tier[n], future_aggr=scen['aggr']['tier'][n],
                         future_delta=scen['cons']['delta'][n],
                         d_course=pred_course - pred_today,
                         uncertain=n in uncertain,
                         move=order_i[today_tier[n]] - order_i[fut_tier[n]]))

    # ---- the grid
    print("\n=== TIER GRID — today (measured) x future (modelled) ===")
    print("rows = today, columns = future. * = tier differs between the")
    print("conservative and aggressive readings of the model.\n")
    grid = {}
    for r in rows:
        grid.setdefault((r['today'], r['future']), []).append(
            r['name'] + ('*' if r['uncertain'] else ''))
    header = '        ' + ''.join(f"{t:<14}" for t, _ in TIER_SHAPE)
    print(header)
    print('        ' + '-' * 70)
    for t, _ in TIER_SHAPE:
        cells = [grid.get((t, f), []) for f, _ in TIER_SHAPE]
        depth = max((len(c) for c in cells), default=0)
        for d in range(max(depth, 1)):
            lead = f"  {t}  |  " if d == 0 else "     |  "
            print(lead + ''.join(f"{(c[d] if d < len(c) else ''):<14}" for c in cells))
        print('     |')

    # ---- movers
    print("\n=== BIGGEST MOVERS ===")
    up = sorted([r for r in rows if r['move'] > 0], key=lambda r: -r['move'])
    dn = sorted([r for r in rows if r['move'] < 0], key=lambda r: r['move'])
    def show(r):
        return (f"    {r['name']:<12} {r['today']}->{r['future']} "
                f"({r['move']:+d})  today {r['today_delta']:+6.2f}s  "
                f"reach {r['reach']:+.0f}  {r['archetype']:<10} "
                f"course {r['d_course']:+5.2f}s")

    print("\n  SUPPRESSED by a W/L-only game — they gain when courses vary:")
    for r in up[:14]:
        print(show(r))
    print("\n  PROPPED UP by W/L-only — they fade as courses vary:")
    for r in dn[:14]:
        print(show(r))

    stable = sum(1 for r in rows if r['move'] == 0)
    print(f"\n  unchanged: {stable}/{len(rows)}    "
          f"uncertain (model-bracket sensitive): {len(uncertain)}")

    json.dump(rows, open('regatta/eval/tier_grid.json', 'w'), indent=2)
    print("\nSaved to regatta/eval/tier_grid.json")


if __name__ == '__main__':
    main()
