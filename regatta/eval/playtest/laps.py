#!/usr/bin/env python3
"""regatta/eval/playtest/laps.py — what the six playtest laps say, on the video clock.

  python3 laps.py <tests_dir> [bundle] > laps.md

Per lap: leg splits, manoeuvres, hits (sudden speed loss) with their video time.
Races add the fleet: tack at the gun, OCS/penalties, leg-by-leg gaps, mark roundings
(time from zone entry to leg change, player vs fleet), rival hits, rival speed.
"""
import sys, math
from align import load_laps, sample_video_t, iso, mmss, bundle

HIT_DROP, HIT_WIN = 0.40, 0.5   # a 40% speed loss inside 0.5 s that isn't a tack/gybe

def hits(ts, sp, hd):
    out, j = [], 0
    for i in range(len(ts)):
        while ts[i] - ts[j] > HIT_WIN: j += 1
        hi = max(sp[j:i + 1])
        turn = abs(math.atan2(math.sin(hd[i] - hd[j]), math.cos(hd[i] - hd[j])))
        if hi > 0.4 and sp[i] < hi * (1 - HIT_DROP) and turn < 0.6:
            if not out or ts[i] - out[-1][0] > 3: out.append((ts[i], hi, sp[i]))
    return out

def lap_report(L):
    F, S = L['F'], L['S']
    race = [s for s in S if s[F['phase']] == 1]
    col = lambda k, rows=race: [r[F[k]] for r in rows]
    t, leg = col('t'), col('leg')
    pfin = L['j'].get('finishTime')
    print('\n## %s — %s, finish %s (video %s–%s)\n' % (L['name'], L['file'], mmss(pfin) if pfin else '**DID NOT FINISH**', mmss(L['v0']), mmss(L['v1'])))
    if not pfin: pfin = race[-1][F['t']]   # an unfinished race: use the last sample
    # leg splits
    marks, prev = [], leg[0]
    for i in range(len(t)):
        if leg[i] != prev: marks.append((leg[i], t[i], race[i])); prev = leg[i]
    last = 0
    splits = []
    for lg, tt, s in marks:
        splits.append('L%d %s' % (lg - 1, mmss(tt - last))); last = tt
    splits.append('L%d %s' % (leg[-1], mmss(pfin - last)))
    print('- legs: ' + ' · '.join(splits))
    tk = col('playerTack'); flips = sum(1 for i in range(1, len(tk)) if tk[i] != tk[i - 1])
    sp = col('spd')
    print('- tack/gybe count %d · mean speed %.2f · ocs at gun %s' % (flips, sum(sp) / len(sp), S[[i for i, s in enumerate(S) if s[F['phase']] == 1][0]][F['ocs']]))
    pos0 = [s for s in S if s[F['phase']] == 1][0]
    print('- player at gun: tack %s, %.0f u from line mid' % ('stbd' if pos0[F['playerTack']] == 1 else 'port',
          math.hypot(pos0[F['x']] - sum(p[0] for p in L['j']['course']['startLine']) / 2, pos0[F['y']] - sum(p[1] for p in L['j']['course']['startLine']) / 2)))
    for tt, a, b in hits(t, sp, col('hdg')):
        s = race[t.index(tt)]
        print('- **hit?** t=%s (video %s) speed %.2f → %.2f, leg %d' % (mmss(tt), mmss(sample_video_t(L, s)), a, b, s[F['leg']]))
    ev = L['j'].get('events') or []
    if ev:   # group repeats (a grind logs every 0.5 s) into episodes: type × n, time span, where
        eps = []
        for e in ev:
            key = (e[1], e[2] if len(e) > 2 and isinstance(e[2], str) else '')
            if eps and eps[-1]['key'] == key and e[0] - eps[-1]['t1'] <= 1.5:
                eps[-1]['t1'] = e[0]; eps[-1]['n'] += 1
            else:
                eps.append(dict(key=key, t0=e[0], t1=e[0], n=1, at=tuple(e[-2:]) if len(e) >= 4 else None))
        print('- events: ' + ' · '.join('%s%s ×%d %.1f–%.1fs%s' % (p['key'][0], (' ' + p['key'][1]) if p['key'][1] else '', p['n'], p['t0'], p['t1'],
              ' @%s' % (p['at'],) if p['at'] else '') for p in eps))
    if L['mode'] != 'competitive': return
    fleet = L['j']['fleet']
    # rival identity per sample
    def rivals(s):
        return {x[0]: (r, x) for r, x in zip(s[F['rivals']], s[F['rivalsX']])}
    gun = rivals(race[0])
    port = [fleet[i - 1] for i, (r, x) in gun.items() if r[4] == -1]
    print('- fleet at gun: %d/%d on PORT (%s); ocs %s' % (len(port), len(gun), ', '.join(port),
          [fleet[i - 1] for i, (r, x) in gun.items() if x[2] & 4] or 'none'))
    # leg change times per rival; finish = drop out of list
    first = {}; fin = {}; pens = set(); rhits = {}
    series = {}
    for s in race:
        R = rivals(s)
        for i, (r, x) in R.items():
            first.setdefault((i, x[1]), s[F['t']])
            if x[2] & 1: pens.add(fleet[i - 1])
            series.setdefault(i, []).append((s[F['t']], r[3], r[2], s))
        for i in list(series):
            if i not in R and i not in fin: fin[i] = s[F['t']]
    for i, rows in series.items():
        h = hits([a for a, b, c, d in rows], [b for a, b, c, d in rows], [c for a, b, c, d in rows])
        if h: rhits[fleet[i - 1]] = ['%s(v%s)' % (mmss(a), mmss(sample_video_t(L, rows[[r[0] for r in rows].index(a)][3]))) for a, _, _ in h]
    order = sorted(fin.items(), key=lambda kv: kv[1])
    pt = pfin
    place = 1 + sum(1 for i, ft in fin.items() if ft < pt)
    print('- player place %d; finishers: %s' % (place, ', '.join('%s %s(%+.0fs)' % (fleet[i - 1], mmss(ft), ft - pt) for i, ft in order)))
    # the file ends at HIS finish, so boats still racing have no time — give their course-progress gap
    # instead (units; 1 u = 10 cm) and a rough seconds estimate at their speed then. The spd column is
    # units per FRAME at 60 fps (Scuttle, CP R3: 771 u at 2.0 → 6.4 s; results screen said +5.58 s)
    from engagement import progress_fn
    prog, _ = progress_fn(L['j']['course'])
    last = race[-1]; me = prog(last[F['leg']], last[F['x']], last[F['y']])
    behind = sorted((me - prog(x[1], r[0], r[1]), fleet[x[0] - 1], r[3]) for r, x in zip(last[F['rivals']], last[F['rivalsX']]))
    if behind:
        print('- still racing at your finish: ' + ', '.join('%s %.0fu (~%.0fs)' % (n, g, g / (60 * max(sp, 0.3))) for g, n, sp in behind[:4])
              + (' …' if len(behind) > 4 else ''))
    # gap at each mark: player time − best rival time to reach that leg
    rows = []
    for lg, tt, s in marks:
        rt = sorted((first[(i, lg)], fleet[i - 1]) for i in range(1, len(fleet) + 1) if (i, lg) in first)
        if rt: rows.append('M%d %+.0fs vs %s' % (lg - 1, tt - rt[0][0], rt[0][1]) if rt[0][0] < tt else 'M%d lead by %.0fs over %s' % (lg - 1, rt[0][0] - tt, rt[0][1]))
    print('- at each mark: ' + ' · '.join(rows))
    if pens: print('- rivals penalised: %s' % ', '.join(sorted(pens)))
    for n, h in rhits.items(): print('- rival hit? %s at %s' % (n, ', '.join(h)))
    # speed: player vs fleet mean over the race, by leg
    by = {}
    for s in race:
        lg = s[F['leg']]
        by.setdefault(lg, [[], []])[0].append(s[F['spd']])
        for r in s[F['rivals']]: by[lg][1].append(r[3])
    print('- mean speed by player-leg (player / fleet): ' + ' · '.join('L%d %.2f/%.2f' % (lg, sum(a) / len(a), sum(b) / max(1, len(b))) for lg, (a, b) in sorted(by.items())))
    # roundings: seconds inside the zone (per boat, per rounding leg)
    lr = L['j']['course']['legRounds']
    gates = not any(lr)
    _, target = progress_fn(L['j']['course'])
    def zone_secs(track):   # track: list of (t, x, y, leg)
        out = {}
        for k in range(1, len(track)):
            t0, x, y, lg = track[k]
            m = lr[lg] if lg < len(lr) else None
            if gates and lg >= 1:                       # gate course: the zone is 165 u around the gate LINE
                gx, gy = target(lg, x, y)
                if math.hypot(x - gx, y - gy) < 165: out[lg] = out.get(lg, 0) + (t0 - track[k - 1][0])
                continue
            if m and math.hypot(x - m['x'], y - m['y']) < m['zone']:
                out[lg] = out.get(lg, 0) + (t0 - track[k - 1][0])
        return out
    ptr = zone_secs([(s[F['t']], s[F['x']], s[F['y']], s[F['leg']]) for s in race])
    rz = {}
    for i, rws in series.items():
        tr = [(a, d[F['rivals']][[x[0] for x in d[F['rivalsX']]].index(i)][0], d[F['rivals']][[x[0] for x in d[F['rivalsX']]].index(i)][1],
               d[F['rivalsX']][[x[0] for x in d[F['rivalsX']]].index(i)][1]) for a, b, c, d in rws]
        for lg, v in zone_secs(tr).items(): rz.setdefault(lg, []).append((v, fleet[i - 1]))
    out = []
    for lg in sorted(set(ptr) | set(rz)):
        r = sorted(rz.get(lg, []))
        if not r and gates: continue               # the last gate is the finish line: nothing to round
        med = r[len(r) // 2][0] if r else float('nan')
        worst = '%s %.0fs' % (r[-1][1], r[-1][0]) if r else '-'
        out.append('M%d you %.0fs / fleet median %.0fs / worst %s' % (lg, ptr.get(lg, float('nan')), med, worst))
    print('- seconds in the %s: ' % ('165u gate zone' if gates else '%du mark zone' % lr[1]['zone']) + ' · '.join(out))

def main():
    laps = load_laps(sys.argv[1], bundle(sys.argv[2] if len(sys.argv) > 2 else sys.argv[1])['clock'])
    print('# Laps — %s' % sys.argv[1].rstrip('/').split('/')[-1])
    for L in laps: lap_report(L)

if __name__ == '__main__':
    main()
