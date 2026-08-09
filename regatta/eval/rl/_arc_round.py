#!/usr/bin/env python3
"""THE ARCTIC ROUNDING, HUMAN VS BOT, FROM THE SAME RACES (owner lead, 2026-08-08).

The owner watched his son race arctic (the 313.9 outlier lap): well back in the
pack until the ROUNDING, where he passed the whole AI fleet. The schema-2
recordings carry all 9 rivals at 10Hz with stable identity and per-rival leg
(rivalsX), plus course.roundMark — so every recording contains up to TEN
roundings of the SAME mark in the SAME water, zero seed noise. Distill what each
boat does around ITS OWN rounding and compare the two populations.

Per boat (player + each rival), around the leg 1→2 flip:
  tIn      — seconds from first entering RING (600u of the round mark) to the flip
  tOut     — seconds from the flip to leaving RING
  vRing    — mean speed inside the ring (u/s), and vMin
  slow     — seconds under 40 u/s (~2.7 kt) inside the ring
  odoRing  — distance sailed inside the ring vs 2*RING (a straight in-and-out)
  dMin     — closest approach to the mark
  entry/exit bearing — angle from mark to boat at ring entry and exit (deg,
             0=N), so the SHAPE of the turn is visible
And for the player only: fleet RANK at flip−60s, at the flip, and at flip+60s
(rank = boats ahead by (leg, distance-to-next-objective)), to test the owner's
"passed them all at the rounding" observation directly.

  python3 _arc_round.py            all arctic schema-2 recordings
  python3 _arc_round.py <file>     one recording, per-boat detail
"""
import json, math, os, sys, glob, statistics

TRAJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'traj')
RING = 600.0
SLOW = 40.0    # u/s ≈ 2.7 kt

def med(v): return statistics.median(v) if v else float('nan')

def analyze(path, verbose=False):
    d = json.load(open(path))
    F = d['format']
    if 'rivalsX' not in F:
        return None
    iT, iX, iY, iPh, iLeg = (F.index(k) for k in ('t', 'x', 'y', 'phase', 'leg'))
    iSpd, iRiv, iRivX = F.index('spd'), F.index('rivals'), F.index('rivalsX')
    course = d.get('course') or {}
    rm = course.get('roundMark')
    if not rm:
        return None
    rmx, rmy = (rm['x'], rm['y']) if isinstance(rm, dict) else (rm[0], rm[1])
    S = [s for s in d['samples'] if s[iPh] == 1]
    if len(S) < 100:
        return None

    # ── per-boat tracks: key None = player, else boatIdx ────────────────────
    tracks = {None: []}
    for s in S:
        tracks[None].append((s[iT], s[iX], s[iY], s[iLeg], s[iSpd] * 60.0))
        for rv, rx in zip(s[iRiv], s[iRivX]):
            tracks.setdefault(rx[0], []).append((s[iT], rv[0], rv[1], rx[1], rv[3] * 60.0))

    def round_stats(tr):
        # the leg 1→2 flip
        flip = None
        for a, b in zip(tr, tr[1:]):
            if a[3] == 1 and b[3] == 2:
                flip = b[0]
                break
        if flip is None:
            return None
        inR = [p for p in tr if math.hypot(p[1] - rmx, p[2] - rmy) < RING
               and abs(p[0] - flip) < 240]
        if len(inR) < 5:
            return None
        t0, t1 = inR[0][0], inR[-1][0]
        spds = [p[4] for p in inR]
        odo = sum(math.hypot(b[1] - a[1], b[2] - a[2])
                  for a, b in zip(inR, inR[1:]) if b[0] - a[0] < 2)
        dmin = min(math.hypot(p[1] - rmx, p[2] - rmy) for p in inR)
        brg = lambda p: (math.degrees(math.atan2(p[1] - rmx, -(p[2] - rmy))) + 360) % 360
        return dict(flip=flip, tIn=flip - t0, tOut=t1 - flip,
                    vMean=statistics.mean(spds), vMin=min(spds),
                    slow=sum(0.1 for v in spds if v < SLOW),
                    odoRing=odo, dMin=dmin, brgIn=brg(inR[0]), brgOut=brg(inR[-1]))

    player = round_stats(tracks[None])
    rivals = []
    for k, tr in tracks.items():
        if k is None:
            continue
        r = round_stats(tr)
        if r:
            rivals.append((k, r))

    # ── player fleet rank near his flip ─────────────────────────────────────
    ranks = {}
    if player:
        for lab, tq in (('-60s', player['flip'] - 60), ('flip', player['flip']),
                        ('+60s', player['flip'] + 60)):
            s = min(S, key=lambda s: abs(s[iT] - tq))
            if abs(s[iT] - tq) > 5:
                continue
            pl, px, py = s[iLeg], s[iX], s[iY]
            pd = math.hypot(px - rmx, py - rmy)
            ahead = 0
            for rv, rx in zip(s[iRiv], s[iRivX]):
                rl = rx[1]
                if rl > pl:
                    ahead += 1
                elif rl == pl:
                    rd = math.hypot(rv[0] - rmx, rv[1] - rmy)
                    # leg 1 races TOWARD the mark; leg 2 races AWAY from it
                    if (pl <= 1 and rd < pd) or (pl >= 2 and rd > pd):
                        ahead += 1
            ranks[lab] = ahead + 1
    return dict(file=os.path.basename(path), fin=d.get('finishTime'),
                player=player, rivals=rivals, ranks=ranks)

def show(r, verbose):
    p = r['player']
    rv = [x[1] for x in r['rivals']]
    print(f"\n{r['file'][:40]}  fin {str(r['fin'])[:6]}  "
          f"rank {r['ranks'].get('-60s','?')} → {r['ranks'].get('flip','?')} → {r['ranks'].get('+60s','?')} (of 10)")
    if p:
        print(f"  PLAYER  tIn {p['tIn']:5.1f}  tOut {p['tOut']:5.1f}  vMean {p['vMean']:5.0f}  vMin {p['vMin']:4.0f}"
              f"  slow {p['slow']:4.1f}s  odo/2R {p['odoRing']/(2*RING):4.2f}  dMin {p['dMin']:4.0f}"
              f"  brg {p['brgIn']:3.0f}°→{p['brgOut']:3.0f}°")
    if rv:
        print(f"  RIVALS  tIn {med([x['tIn'] for x in rv]):5.1f}  tOut {med([x['tOut'] for x in rv]):5.1f}"
              f"  vMean {med([x['vMean'] for x in rv]):5.0f}  vMin {med([x['vMin'] for x in rv]):4.0f}"
              f"  slow {med([x['slow'] for x in rv]):4.1f}s  odo/2R {med([x['odoRing'] for x in rv])/(2*RING):4.2f}"
              f"  dMin {med([x['dMin'] for x in rv]):4.0f}   (n={len(rv)} rounded)")
    if verbose:
        for k, x in sorted(r['rivals']):
            print(f"    rival{k:2d}  tIn {x['tIn']:5.1f}  tOut {x['tOut']:5.1f}  vMean {x['vMean']:5.0f}"
                  f"  vMin {x['vMin']:4.0f}  slow {x['slow']:4.1f}s  odo/2R {x['odoRing']/(2*RING):4.2f}"
                  f"  dMin {x['dMin']:4.0f}  brg {x['brgIn']:3.0f}°→{x['brgOut']:3.0f}°")

if __name__ == '__main__':
    if len(sys.argv) > 1 and not sys.argv[1].isdigit():
        r = analyze(sys.argv[1], True)
        if r: show(r, True)
        sys.exit(0)
    P, R = [], []
    for f in sorted(glob.glob(os.path.join(TRAJ, 'traj_arctic_*.json'))):
        r = analyze(f)
        if not r:
            continue
        show(r, False)
        if r['player']:
            P.append(r['player'])
        R += [x[1] for x in r['rivals']]
    if P and R:
        print(f"\n══ POOLED: {len(P)} human roundings vs {len(R)} bot roundings (same races) ══")
        for k, lab in (('tIn', 'ring entry→flip s'), ('tOut', 'flip→ring exit s'),
                       ('vMean', 'mean speed u/s'), ('vMin', 'min speed u/s'),
                       ('slow', 'sec under 2.7kt'), ('dMin', 'closest to mark u')):
            print(f"  {lab:20} human {med([p[k] for p in P]):7.1f}   bot {med([x[k] for x in R]):7.1f}")
        print(f"  {'ring odo / straight':20} human {med([p['odoRing'] for p in P])/(2*RING):7.2f}"
              f"   bot {med([x['odoRing'] for x in R])/(2*RING):7.2f}")
