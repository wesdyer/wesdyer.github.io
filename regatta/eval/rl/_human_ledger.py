#!/usr/bin/env python3
"""THE HUMAN'S TRAFFIC LEDGER — the instrument this campaign has never had.

Every avoidance thread so far has re-priced what the FLEET does in traffic without a
human number to price it against, because the one probe that tried read a decorated
format name and got zeros ("the human sailed alone" — false, all 59 recordings carry
9 rivals). This mines the recordings per ENCOUNTER instead of per race.

An ENCOUNTER opens when a rival comes inside RANGE and is closing, and closes when it
opens back outside RANGE or stops closing for good. For each one:

    cpa        closest the two actually came, units
    defl       the human's heading change during it, measured against the heading
               trend of the 5 s BEFORE it opened (so a planned tack mid-encounter is
               visible as a tack, not as a deflection)
    dspd       her speed at CPA relative to her speed at onset
    gw         was she the give-way boat at onset (giveWayN > 0)
    tacked     did playerTack flip during the encounter

Reported per class, with the distribution of deflection — the fleet's own comparable
numbers are `rl/_defl_hist.js` (mean deviation 44-48 deg) and `_cpa_onset_probe.js`.

Usage: python3 _human_ledger.py [venue|all]
"""
import json, math, sys, glob, os, statistics, collections

RANGE = 600.0


def norm(a):
    while a > math.pi: a -= 2 * math.pi
    while a < -math.pi: a += 2 * math.pi
    return a


def encounters(fn):
    d = json.load(open(fn))
    F = {n.split('[')[0].split('(')[0].split('<')[0]: i for i, n in enumerate(d['format'])}
    if 'rivals' not in F:
        return None, []
    S = [s for s in d['samples'] if s[F['phase']] == 1]
    if len(S) < 60:
        return d, []
    # heading trend: mean heading over the 5 s before an index
    hdg = [s[F['hdg']] for s in S]
    t = [s[F['t']] for s in S]

    def trend(i):
        j = i
        while j > 0 and t[i] - t[j] < 5.0:
            j -= 1
        if j >= i:
            return hdg[i]
        # circular mean
        sx = sum(math.sin(h) for h in hdg[j:i + 1])
        sy = sum(math.cos(h) for h in hdg[j:i + 1])
        return math.atan2(sx, sy)

    # Track rivals by nearest-neighbour continuity across samples (no ids in the file).
    open_enc = {}    # key: rival slot index -> record
    out = []
    prev_r = None
    for i, s in enumerate(S):
        rv = s[F['rivals']] or []
        gw = s[F['giveWayN']] if 'giveWayN' in F and len(s) > F['giveWayN'] else 0
        x, y = s[F['x']], s[F['y']]
        rng = [math.hypot(r[0] - x, r[1] - y) for r in rv]
        for k, r in enumerate(rv):
            if k >= len(rng):
                continue
            dist = rng[k]
            was = open_enc.get(k)
            if dist < RANGE:
                closing = True
                if prev_r is not None and k < len(prev_r):
                    closing = dist < prev_r[k] - 0.5
                if was is None and closing:
                    open_enc[k] = dict(i0=i, t0=t[i], h0=trend(i), spd0=s[F['spd']],
                                       cpa=dist, gw=1 if gw else 0,
                                       tack0=s[F['playerTack']] if 'playerTack' in F else 0,
                                       maxdefl=0.0, deflAtCpa=0.0,
                                       spdAtCpa=s[F['spd']], tacked=0)
                elif was is not None:
                    if dist < was['cpa']:
                        was['cpa'] = dist
                        was['spdAtCpa'] = s[F['spd']]
                    dfl = abs(norm(hdg[i] - was['h0']))
                    if dfl > was['maxdefl']:
                        was['maxdefl'] = dfl
                    if dist <= was['cpa']:
                        was['deflAtCpa'] = dfl
                    if 'playerTack' in F and s[F['playerTack']] != was['tack0']:
                        was['tacked'] = 1
                    if gw:
                        was['gw'] = 1
            elif was is not None:
                was['t1'] = t[i]
                out.append(was)
                del open_enc[k]
        prev_r = rng
    for k, was in open_enc.items():
        was['t1'] = t[-1]
        out.append(was)
    return d, out


def report(files, label):
    allenc = []
    for fn in files:
        d, enc = encounters(fn)
        if d is None:
            continue
        allenc += [(fn, e) for e in enc]
    if not allenc:
        print('%s: no encounters' % label)
        return
    print('\n=== %s   %d recordings, %d encounters' % (label, len(files), len(allenc)))
    # ⚠️ A TACK IS NOT A DEFLECTION. The first cut of this instrument reported the
    # human deflecting a median 48-69 deg per encounter — LARGER than the fleet's
    # 44-48 — and the reason was that 26-69% of encounters contain a deliberate tack,
    # which is ~90 deg of heading change that had nothing to do with the rival. Every
    # class below is therefore split, and the no-tack rows are the ones that compare
    # with the fleet's avoidance numbers.
    for name, sel in [('ALL', lambda e: True),
                      ('  no tack', lambda e: not e['tacked']),
                      ('  no tack, give-way', lambda e: not e['tacked'] and e['gw']),
                      ('  no tack, stand-on', lambda e: not e['tacked'] and not e['gw']),
                      ('  no tack, cpa<150u', lambda e: not e['tacked'] and e['cpa'] < 150),
                      ('  no tack, cpa150-300', lambda e: not e['tacked'] and 150 <= e['cpa'] < 300),
                      ('  no tack, cpa>300u', lambda e: not e['tacked'] and e['cpa'] >= 300),
                      ('tacked during', lambda e: e['tacked'])]:
        E = [e for _, e in allenc if sel(e)]
        if not E:
            continue
        dfl = sorted(math.degrees(e['maxdefl']) for e in E)
        dcp = sorted(math.degrees(e.get('deflAtCpa', 0.0)) for e in E)
        q = lambda p: dfl[int(p * (len(dfl) - 1))]
        zero = 100 * sum(1 for x in dfl if x < 5) / len(dfl)
        tk = 100 * sum(1 for e in E if e['tacked']) / len(E)
        cpa = sorted(e['cpa'] for e in E)
        qc = lambda p: dcp[int(p * (len(dcp) - 1))]
        print('  %-22s n=%4d  maxdefl med %5.1f mean %5.1f | AT-CPA med %5.1f mean %5.1f '
              'p90 %5.1f  ZERO(<5) %3.0f%%  tacked %3.0f%%  cpa med %4.0f'
              % (name, len(E), q(.5), statistics.mean(dfl),
                 qc(.5), statistics.mean(dcp), qc(.9),
                 100 * sum(1 for x in dcp if x < 5) / len(dcp), tk, cpa[len(cpa) // 2]))


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'all'
    here = os.path.join(os.path.dirname(__file__), 'traj')
    byv = collections.defaultdict(list)
    for fn in sorted(glob.glob(os.path.join(here, 'traj_*.json'))):
        v = os.path.basename(fn).split('_')[1]
        byv[v].append(fn)
    if which == 'all':
        for v in sorted(byv):
            report(byv[v], v)
    else:
        report(byv.get(which, []), which)
