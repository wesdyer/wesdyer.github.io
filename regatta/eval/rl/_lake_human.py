#!/usr/bin/env python3
"""Stillwater Lake: what the human did that the fleet did not.

Reads the human recordings and, for each one, reports
  - leg times and the wind the human sailed in (speed + direction) per leg
  - the fleet's position relative to the human, in units of distance-to-mark,
    sampled over the race (rivals are recorded live, 9 of them)
  - tack count, and whether each tack was made on a heading shift (a lift/header
    read) or not
  - time spent in the glass (local wind < 4 kt) for human vs fleet

Usage: python3 _lake_human.py [files...]
"""
import json, math, sys, glob, os

F = {}


def load(fn):
    d = json.load(open(fn))
    fmt = {n.split('[')[0].split('(')[0].split('<')[0]: i for i, n in enumerate(d['format'])}
    return d, fmt


def norm(a):
    while a > math.pi: a -= 2 * math.pi
    while a < -math.pi: a += 2 * math.pi
    return a


def analyse(fn):
    d, F = load(fn)
    S = d['samples']
    course = d['course']
    marks = {}
    gate = ((course['startLine'][0][0] + course['startLine'][1][0]) / 2,
            (course['startLine'][0][1] + course['startLine'][1][1]) / 2)
    rm = course['roundMark']
    # leg targets: leg1 -> roundMark(mark-3), leg2 -> mark-5, leg3 -> gate
    # mark-5 is not in the recording; derive it from the venue doc coordinates
    M5 = (2459.03, -867.42)
    targets = {1: (rm['x'], rm['y']), 2: M5, 3: gate}

    racing = [s for s in S if s[F['phase']] == 1]
    t0 = racing[0][F['t']]
    print('=== %s   finish %.1f s, %d samples racing' % (os.path.basename(fn), d['finishTime'], len(racing)))

    # leg times
    legs = {}
    for s in racing:
        lg = s[F['leg']]
        legs.setdefault(lg, []).append(s)
    for lg in sorted(legs):
        ss = legs[lg]
        dur = ss[-1][F['t']] - ss[0][F['t']]
        ws = [x[F['windSpd']] for x in ss]
        wd = [x[F['windDir']] for x in ss]
        spd = [x[F['spd']] for x in ss]
        # tacks
        tk = [x[F['playerTack']] for x in ss]
        ntack = sum(1 for a, b in zip(tk, tk[1:]) if a != b)
        # distance sailed
        dist = 0
        for a, b in zip(ss, ss[1:]):
            dist += math.hypot(b[F['x']] - a[F['x']], b[F['y']] - a[F['y']])
        tgt = targets.get(lg)
        strt = math.hypot(ss[0][F['x']] - tgt[0], ss[0][F['y']] - tgt[1]) if tgt else 0
        glass = sum(1 for w in ws if w < 4.0) / len(ws)
        print('  leg %d  %6.1f s  wind %.2f kt (min %.2f max %.2f)  dir mean %+.3f range %.3f  '
              'spd %.3f  tacks %2d  dist %5.0f (%.2fx straight)  glass%%%5.1f'
              % (lg, dur, sum(ws) / len(ws), min(ws), max(ws),
                 sum(wd) / len(wd), max(wd) - min(wd), sum(spd) / len(spd), ntack,
                 dist, dist / strt if strt else 0, 100 * glass))

    # fleet gap over time: distance-to-target, human minus best rival
    print('  --- gap to fleet (human dist-to-mark minus best rival dist-to-mark; negative = human ahead)')
    for frac in [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.99]:
        s = racing[int(frac * (len(racing) - 1))]
        lg = s[F['leg']]
        tgt = targets.get(lg if lg in targets else 3)
        hd = math.hypot(s[F['x']] - tgt[0], s[F['y']] - tgt[1])
        rv = s[F['rivals']] or []
        if not rv: continue
        rd = sorted(math.hypot(r[0] - tgt[0], r[1] - tgt[1]) for r in rv)
        print('    t=%6.1f leg %d  human %5.0f  best rival %5.0f  med rival %5.0f   gap %+6.0f u  (n=%d)'
              % (s[F['t']] - t0, lg, hd, rd[0], rd[len(rd) // 2], hd - rd[0], len(rv)))
    return d, F


if __name__ == '__main__':
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'traj', 'traj_lake_*.json')))
    for fn in files:
        analyse(fn)
        print()
