#!/usr/bin/env python3
"""RADIUS SELECTION SIZING (fidelity follow-up; the surviving candidate).

FL1 measured the human's rounding radius bimodal — 20 tight (261-340u) /
5 wide (472-644u) — and hypothesized "the choice reads the exit route through
the field." Before building radius selection into the bot's rounding, answer:

  1. WHAT distinguishes her 5 wide roundings from her 20 tight ones?
     Candidate signals, computed per rounding at ring-entry time:
       - ice occupancy in the TIGHT BAND (annulus 150-450u around the mark),
         total and in the entry/exit quadrants
       - approach bearing, exit bearing (the turn's shape)
  2. What do the two modes COST her (ring time tight vs wide)?
  3. What radius do the BOTS take in the same races, and does their ring time
     correlate with (radius chosen vs what the ice demanded)?

Floe caveat: the recorder captures floes near the PLAYER only — player
roundings always have ice context; rival roundings only when they round near
her. Coverage is printed; conclusions lean on player rows + covered rivals.

  python3 _arc_radius.py            all arctic schema-2 recordings
"""
import json, math, os, glob, statistics

TRAJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'traj')
RING = 1000.0   # FIXED reference well outside both radius modes (rule 19b: a 587u orbit barely enters a 600u ring — the old metric shrank with radius)

def med(v): return statistics.median(v) if v else float('nan')

def norm(a):
    while a > math.pi: a -= 2 * math.pi
    while a < -math.pi: a += 2 * math.pi
    return a

rows = []
for path in sorted(glob.glob(os.path.join(TRAJ, 'traj_arctic_*.json'))):
    d = json.load(open(path))
    F = d['format']
    hasRiv = 'rivalsX' in F
    hasFloes = 'floes' in F
    ix = {k: F.index(k) for k in ('t', 'x', 'y', 'phase', 'leg', 'spd') if k in F}
    for k in ('rivals', 'rivalsX', 'floes'):
        if k in F: ix[k] = F.index(k)
    course = d.get('course') or {}
    rm = course.get('roundMark')
    if not rm: continue
    rmx, rmy = (rm['x'], rm['y']) if isinstance(rm, dict) else (rm[0], rm[1])
    S = [s for s in d['samples'] if s[ix['phase']] == 1]
    if len(S) < 100: continue

    tracks = {None: []}
    for si, s in enumerate(S):
        tracks[None].append((si, s[ix['t']], s[ix['x']], s[ix['y']], s[ix['leg']]))
        if hasRiv:
            for rv, rx in zip(s[ix['rivals']] or [], s[ix['rivalsX']] or []):
                tracks.setdefault(rx[0], []).append((si, s[ix['t']], rv[0], rv[1], rx[1]))

    for key, tr in tracks.items():
        flip = None
        for i in range(1, len(tr)):
            if tr[i - 1][4] == 1 and tr[i][4] == 2: flip = i; break
        if flip is None: continue
        # The leg flip registers when the sweep completes — often OUTSIDE the
        # 600u ring (measured 858u on a clean lap). Anchor the window on the
        # last in-ring visit at or before the flip.
        k = flip
        while k > 0 and math.hypot(tr[k][2] - rmx, tr[k][3] - rmy) >= RING: k -= 1
        if math.hypot(tr[k][2] - rmx, tr[k][3] - rmy) >= RING: continue
        j0 = k
        while j0 > 0 and math.hypot(tr[j0 - 1][2] - rmx, tr[j0 - 1][3] - rmy) < RING: j0 -= 1
        j1 = k
        while j1 < len(tr) - 1 and math.hypot(tr[j1 + 1][2] - rmx, tr[j1 + 1][3] - rmy) < RING: j1 += 1
        if j1 <= j0: continue
        dmin = min(math.hypot(p[2] - rmx, p[3] - rmy) for p in tr[j0:j1 + 1])
        tRing = tr[flip][1] - tr[j0][1]   # ring entry -> flip, the established metric
        entB = math.degrees(math.atan2(tr[j0][2] - rmx, -(tr[j0][3] - rmy))) % 360
        extB = math.degrees(math.atan2(tr[j1][2] - rmx, -(tr[j1][3] - rmy))) % 360
        # ice context at ring entry, from the PLAYER's floe capture at that sample
        sEnt = S[tr[j0][0]]
        floes = (sEnt[ix['floes']] or []) if hasFloes else []
        bx, by = tr[j0][2], tr[j0][3]
        # coverage: floe capture is player-centric; require the boat within 900u of the player
        px, py = sEnt[ix['x']], sEnt[ix['y']]
        covered = hasFloes and (math.hypot(bx - px, by - py) < 900 or key is None)
        nBand = nBandEnt = nBandExt = 0
        if covered:
            for f in floes:
                fx, fy, fr = f[1], f[2], (f[3] if len(f) > 3 else 60)
                dM = math.hypot(fx - rmx, fy - rmy)
                if 150 - fr < dM < 450 + fr:
                    nBand += 1
                    fb = math.degrees(math.atan2(fx - rmx, -(fy - rmy))) % 360
                    if abs(norm(math.radians(fb - entB))) < math.radians(60): nBandEnt += 1
                    if abs(norm(math.radians(fb - extB))) < math.radians(60): nBandExt += 1
        rows.append({'who': 'human' if key is None else 'bot', 'file': os.path.basename(path)[-10:-5],
                     'dmin': dmin, 'tRing': tRing, 'cov': covered,
                     'nBand': nBand if covered else None,
                     'nEnt': nBandEnt if covered else None, 'nExt': nBandExt if covered else None})

hum = [r for r in rows if r['who'] == 'human']
bot = [r for r in rows if r['who'] == 'bot']
botC = [r for r in bot if r['cov']]
print(f"rounding events: human {len(hum)}  bot {len(bot)} (ice-covered {len(botC)})")
for name, pop in (('HUMAN', hum), ('BOT(all)', bot), ('BOT(covered)', botC)):
    if not pop: continue
    tight = [r for r in pop if r['dmin'] < 400]
    wide = [r for r in pop if r['dmin'] >= 400]
    print(f"\n{name}: n={len(pop)} dmin med {med([r['dmin'] for r in pop]):.0f}  "
          f"tight(<400u) {len(tight)}  wide(>=400u) {len(wide)}")
    for lbl, grp in (('tight', tight), ('wide', wide)):
        if not grp: continue
        print(f"  {lbl:5s}: dmin {med([r['dmin'] for r in grp]):.0f}  tRing med {med([r['tRing'] for r in grp]):.1f}s  "
              f"band-ice med {med([r['nBand'] for r in grp if r['nBand'] is not None])}  "
              f"ent-sector {med([r['nEnt'] for r in grp if r['nEnt'] is not None])}  "
              f"exit-sector {med([r['nExt'] for r in grp if r['nExt'] is not None])}")
print("\nper-event (human):")
for r in sorted(hum, key=lambda r: r['dmin']):
    print(f"  {r['file']}  dmin {r['dmin']:5.0f}  tRing {r['tRing']:5.1f}s  band {r['nBand']}  ent {r['nEnt']}  exit {r['nExt']}")
