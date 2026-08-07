#!/usr/bin/env python3
"""Schema-2 per-encounter give-way ledger — BOTH sides of every encounter.

Needs recordings with `rivalsX` (identity + rule-21 flags, landed ba536eb).
For every player-rival encounter (rival inside RANGE and closing, tracked by
boatIdx, closed on leaving RANGE):

  role       who is give-way at onset, from the pair geometry the rules use:
             opposite tacks -> port gives way; same tack -> windward gives way
             (relative bearing vs the local wind). Cross-checked with giveWayN.
  ucpa       UNMODIFIED CPA: both hulls projected straight at their onset
             heading/speed — the owner's criterion ("change enough to not have
             a collision if they maintain a proper course"): a deviation
             against ucpa >= NEED was not required.
  player     deflection at CPA vs her 5s pre-onset heading trend, tacked flag
  rival      same, from the rival's own tracked heading series; plus ONSET
             RANGE (distance at which its deviation first exceeded 10 deg and
             stayed) and rule-21 flags (penalty/spiral) at onset.

Usage: python3 _gw_ledger2.py traj/traj_redrock_*.json
"""
import json, math, sys, glob, statistics as st

RANGE = 600.0
NEED = 80.0          # the open-water keep-clear gap the AI itself uses
DEV_ON = math.radians(10)

def norm(a):
    while a > math.pi: a -= 2 * math.pi
    while a < -math.pi: a += 2 * math.pi
    return a

def circ_mean(hs):
    return math.atan2(sum(math.sin(h) for h in hs), sum(math.cos(h) for h in hs))

def analyze(fn):
    d = json.load(open(fn))
    if d.get('schema') != 2: return None
    F = {n: i for i, n in enumerate(d['format'])}
    S = [s for s in d['samples'] if s[F['phase']] == 1]
    if len(S) < 60: return []
    t = [s[F['t']] for s in S]

    # per-rival series keyed by boatIdx
    series = {}       # idx -> list of (i, x, y, hdg, spd, tack, flags)
    for i, s in enumerate(S):
        rv, rx = s[F['rivals']] or [], s[F['rivalsX']] or []
        for k, r in enumerate(rv):
            if k >= len(rx): break
            idx, leg, flags = rx[k]
            series.setdefault(idx, []).append((i, r[0], r[1], r[2], r[3], r[4], flags))

    def trend(hs, j, i):   # circular mean over [j, i]
        return circ_mean(hs[j:i + 1]) if j < i else hs[i]

    out = []
    for idx, rows in series.items():
        # contiguous encounter windows against the player
        by_i = {row[0]: row for row in rows}
        hs = {row[0]: row[3] for row in rows}
        open_e = None
        prev_d = None
        for row in rows:
            i, rx_, ry_, rh, rs_, rtack, rflags = row
            px, py = S[i][F['x']], S[i][F['y']]
            dist = math.hypot(rx_ - px, ry_ - py)
            closing = prev_d is not None and dist < prev_d - 0.5
            prev_d = dist
            if open_e is None and dist < RANGE and closing:
                # onset: player trend, rival trend over prior 5s
                j = i
                while j > 0 and t[i] - t[j] < 5.0: j -= 1
                ph0 = circ_mean([S[q][F['hdg']] for q in range(j, i + 1)])
                rpast = [hs[q] for q in range(j, i + 1) if q in hs]
                rh0 = circ_mean(rpast) if rpast else rh
                pspd, ptack = S[i][F['spd']], S[i][F['playerTack']]
                wd = S[i][F['windDir']]
                # pair role: opposite tacks -> port(-1) gives way; same tack ->
                # windward gives way (the boat further upwind along -wind axis)
                if ptack != rtack:
                    role = 'rival_gw' if rtack == -1 else 'player_gw'
                else:
                    upP = -(px * math.sin(wd) - py * math.cos(wd))
                    upR = -(rx_ * math.sin(wd) - ry_ * math.cos(wd))
                    role = 'rival_gw' if upR > upP else 'player_gw'
                # unmodified straight-line CPA from onset states (u/s: spd*15)
                pvx, pvy = math.sin(ph0) * pspd * 15, -math.cos(ph0) * pspd * 15
                rvx, rvy = math.sin(rh0) * rs_ * 15, -math.cos(rh0) * rs_ * 15
                dx, dy, dvx, dvy = rx_ - px, ry_ - py, rvx - pvx, rvy - pvy
                v2 = dvx * dvx + dvy * dvy
                tc = max(0.0, -(dx * dvx + dy * dvy) / v2) if v2 > 1e-9 else 0.0
                ucpa = math.hypot(dx + dvx * tc, dy + dvy * tc)
                open_e = dict(i0=i, d0=dist, ph0=ph0, rh0=rh0, role=role,
                              flags0=rflags, ucpa=ucpa, cpa=dist,
                              pdefl=0.0, rdefl=0.0, ptacked=0,
                              ronset=None, tack0=ptack)
            elif open_e is not None:
                e = open_e
                if dist < e['cpa']:
                    e['cpa'] = dist
                    e['pdefl'] = abs(norm(S[i][F['hdg']] - e['ph0']))
                    e['rdefl'] = abs(norm(rh - e['rh0']))
                if S[i][F['playerTack']] != e['tack0']: e['ptacked'] = 1
                if e['ronset'] is None and abs(norm(rh - e['rh0'])) > DEV_ON:
                    e['ronset'] = dist
                if dist > RANGE:
                    out.append(e); open_e = None
        if open_e is not None: out.append(open_e)
    return out

def deg(r): return r * 180 / math.pi

def report(encs, label):
    print(f'\n== {label}: {len(encs)} encounters ==')
    for role in ('rival_gw', 'player_gw'):
        sub = [e for e in encs if e['role'] == role]
        if not sub: continue
        clean = [e for e in sub if not (e['flags0'] & 3)]
        print(f'  {role:10s} n={len(sub):3d} (clean of rule-21 {len(clean)})')
        for name, grp in (('all', sub), ('no-tack', [e for e in sub if not e['ptacked']])):
            if not grp: continue
            pd = [deg(e['pdefl']) for e in grp]
            rd = [deg(e['rdefl']) for e in grp]
            cp = [e['cpa'] for e in grp]
            uc = [e['ucpa'] for e in grp]
            unneeded = [e for e in grp if e['ucpa'] >= NEED]
            print(f'    {name:8s} playerDefl@CPA med {st.median(pd):5.1f}  '
                  f'rivalDefl@CPA med {st.median(rd):5.1f} p90 {sorted(rd)[int(len(rd)*.9)]:5.1f}  '
                  f'cpa med {st.median(cp):4.0f}  ucpa med {st.median(uc):4.0f}  '
                  f'ucpa>={NEED:.0f}u: {100*len(unneeded)//len(grp)}%')
        ons = [e['ronset'] for e in sub if e['ronset'] is not None]
        if ons:
            print(f'    rival deviation onset: fired in {100*len(ons)//len(sub)}% of encounters, '
                  f'at range med {st.median(ons):4.0f}u')

if __name__ == '__main__':
    files = []
    for a in sys.argv[1:]: files += glob.glob(a)
    all_e = []
    for fn in files:
        e = analyze(fn)
        if e is None:
            print(f'{fn}: not schema 2, skipped'); continue
        print(f'{fn}: {len(e)} encounters')
        all_e += e
    if all_e: report(all_e, 'ALL FILES')
