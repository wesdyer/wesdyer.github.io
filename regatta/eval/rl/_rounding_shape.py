#!/usr/bin/env python3
"""HOW THE HUMAN ROUNDS A MARK — the owner's requested comparison (2026-08-06):
"AI roundings are not at all like human roundings... go through all of my
trajectories and see how I round and compare to AI roundings."

Per armed-rounding window (the recorder's `armed` column), measured identically to
the fleet-side probe (_rounding_shape_fleet.js):
    approach speed   mean spd over the 3s before closest approach
    min dist         closest approach to the rounding mark
    spd@mark         speed at closest approach (ratio to approach = carried speed)
    exit speed       mean spd over the 3s after closest approach
    time near        seconds within 1.5x zone radius
    tacks            playerTack sign changes inside the window
    peak turn        max |dhdg/dt| in the window (deg/s)

Mark position: course.roundMark for single-rounding venues; for multi-rounding
venues (bay) the nearest venue-doc mark to the track's closest-approach point.
⚠️ redrock recordings BEFORE Aug 6 are the OLD document — excluded by started-date.
"""
import json, math, glob, os, sys, re, statistics as st

VENUES = sys.argv[1:] or ['bay', 'redrock', 'arctic', 'lake', 'seatrials', 'ocean']

def marks_from_doc(venue):
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
               '../../assets/venues/%s.venue.js' % venue)).read()
    pts = []
    for m in re.finditer(r'"id":\s*"mark-\d+",\s*"x":\s*(-?[\d.]+),\s*"y":\s*(-?[\d.]+)', src):
        pts.append((float(m.group(1)), float(m.group(2))))
    return pts

def analyze(path, doc_marks):
    d = json.load(open(path))
    fmt = d['format']
    col = lambda nm: next(i for i, x in enumerate(fmt) if x == nm or x.startswith(nm))
    iT, iPh, iX, iY, iHdg, iSpd, iLeg, iArm, iTk = map(col, 't phase x y hdg spd leg armed playerTack'.split())
    s = sorted((r for r in d['samples'] if r[iPh] == 1), key=lambda r: r[iT])
    rm = (d.get('course') or {}).get('roundMark')
    lr = (d.get('course') or {}).get('legRounds')
    rounds = []
    win = []
    for i, r in enumerate(s):
        if r[iArm]:
            win.append(r)
        elif win:
            if len(win) > 8: rounds.append(win)
            win = []
    if len(win) > 8: rounds.append(win)
    out = []
    for w in rounds:
        # mark: per-leg geometry if schema 2, else header roundMark, else nearest doc mark
        leg = w[len(w) // 2][iLeg]
        mk = None; zone = 150
        if lr and leg < len(lr) and lr[leg]:
            mk = (lr[leg]['x'], lr[leg]['y']); zone = lr[leg]['zone'] or 150
        elif rm:
            mk = (rm['x'], rm['y']); zone = rm.get('zone') or 150
        if mk is None or (doc_marks and min(math.hypot(w[len(w)//2][iX]-p[0], w[len(w)//2][iY]-p[1]) for p in doc_marks) + 400 < math.hypot(w[len(w)//2][iX]-mk[0], w[len(w)//2][iY]-mk[1])):
            # multi-rounding venue: nearest doc mark to the window midpoint
            if doc_marks:
                mid = w[len(w) // 2]
                mk = min(doc_marks, key=lambda p: math.hypot(mid[iX] - p[0], mid[iY] - p[1]))
        if mk is None: continue
        dists = [math.hypot(r[iX] - mk[0], r[iY] - mk[1]) for r in w]
        ci = dists.index(min(dists))
        if min(dists) > 400: continue     # armed but never came near: not a rounding pass
        t0 = w[ci][iT]
        pre = [r[iSpd] for r in w if -3.0 <= r[iT] - t0 < 0]
        post = [r[iSpd] for r in w if 0 < r[iT] - t0 <= 3.0]
        near = sum(1 for dd in dists if dd < zone * 1.5) * 0.1
        tks = sum(1 for a, b in zip(w, w[1:]) if a[iTk] and b[iTk] and a[iTk] != b[iTk])
        turns = []
        for a, b in zip(w, w[1:]):
            dt = b[iT] - a[iT]
            if 0.05 < dt < 0.3:
                dh = abs(math.remainder(b[iHdg] - a[iHdg], 2 * math.pi))
                turns.append(dh / dt * 57.3)
        out.append(dict(minD=min(dists), app=st.mean(pre) if pre else None,
                        atMark=w[ci][iSpd], exit=st.mean(post) if post else None,
                        near=near, tacks=tks, peakTurn=max(turns) if turns else 0))
    return out

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    for venue in VENUES:
        try: doc_marks = marks_from_doc(venue)
        except Exception: doc_marks = []
        rows = []
        for f in sorted(glob.glob(os.path.join(here, 'traj/traj_%s_*.json' % venue))):
            if venue == 'redrock' and 'traj_redrock_17858' in f: continue  # old document
            try: rows += analyze(f, doc_marks)
            except Exception as e: print('  !!', os.path.basename(f), e)
        if not rows: continue
        ok = [r for r in rows if r['app'] and r['app'] > 0.1]
        med = lambda k: st.median(r[k] for r in ok)
        print(f"{venue}: {len(ok)} roundings | minD med {med('minD'):.0f}u | "
              f"approach {med('app'):.2f} -> at-mark {med('atMark'):.2f} -> exit {med('exit'):.2f} kt "
              f"(carry {100 * med('atMark') / max(0.01, med('app')):.0f}%) | "
              f"near-zone {med('near'):.1f}s | tacks med {med('tacks'):.0f} | peak turn {med('peakTurn'):.0f} deg/s")
