#!/usr/bin/env python3
"""Summarise a bench json (bay_bench / ocean_bench / fleet_leg2 shape).

  python3 _med.py file.json [file2.json ...]

Prints finishers, finish-time quantiles, penalties, OCS, contacts, and per-leg
median durations. Bench files are lists of {seed, info:[{name, legT, fin, ...}]}.
"""
import json, sys, statistics, os


def summarise(fn):
    d = json.load(open(fn))
    fins, pens, ocs, cols, nboats = [], 0, 0, {}, 0
    legd = {}
    for r in d:
        for b in r.get('info', []):
            nboats += 1
            if b.get('fin'): fins.append(b['fin'])
            pens += b.get('pen', 0) or 0
            ocs += 1 if b.get('ocs') else 0
            for k, v in (b.get('col') or {}).items():
                cols[k] = cols.get(k, 0) + v
            lt = b.get('legT') or {}
            ks = sorted(int(k) for k in lt)
            for a, c in zip(ks, ks[1:]):
                legd.setdefault(c, []).append(lt[str(c)] - lt[str(a)])
    fins.sort()
    q = lambda f: fins[int(f * (len(fins) - 1))] if fins else float('nan')
    print('%-42s n=%d fin=%d (%.0f%%)  med %.1f  mean %.1f  p25 %.1f p75 %.1f  min %.1f max %.1f'
          % (os.path.basename(fn), nboats, len(fins), 100 * len(fins) / max(1, nboats),
             statistics.median(fins) if fins else float('nan'),
             statistics.mean(fins) if fins else float('nan'), q(.25), q(.75),
             fins[0] if fins else float('nan'), fins[-1] if fins else float('nan')))
    print('    pen/boat %.2f  OCS %.1f%%  contacts/boat %s'
          % (pens / max(1, nboats), 100 * ocs / max(1, nboats),
             ' '.join('%s %.2f' % (k, v / max(1, nboats)) for k, v in sorted(cols.items()))))
    if legd:
        print('    leg medians: ' + '  '.join('L%d %.0f' % (k, statistics.median(v))
                                              for k, v in sorted(legd.items())))


if __name__ == '__main__':
    for fn in sys.argv[1:]:
        summarise(fn)
