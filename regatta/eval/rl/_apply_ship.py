#!/usr/bin/env python3
"""Apply the benched candidate to the live js file, taken VERBATIM from the tree
that was benched — so what ships is what was measured, not a retyping of it.

  python3 _apply_ship.py [tree=treeSHIP] [--check] [--file js/<path>.js]

--check only reports whether the target regions match; it writes nothing.
--file  names the js file the ship edits, relative to regatta/ (default
        js/script.js). Since the 2026-08-24 refactor the game is split across
        js/{ai,sim,game,render,ui}/*.js — the AI lives in js/ai/*.js, physics
        in js/sim/physics.js, etc. — so most ships now target one of those.
        The edits list below is rewritten per ship; keep its anchors in the
        SAME file --file names.
"""
import sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TREE = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'treeSHIP2'
CHECK = '--check' in sys.argv
JSFILE = 'js/script.js'
if '--file' in sys.argv:
    JSFILE = sys.argv[sys.argv.index('--file') + 1]

MASTER = os.path.join(ROOT, 'regatta', JSFILE)
CAND = os.path.join(ROOT, 'regatta/eval/rl', TREE, 'regatta', JSFILE)


def block(text, start, end):
    i = text.index(start)
    j = text.index(end, i) + len(end)
    return text[i:j]


master = open(MASTER).read()
cand = open(CAND).read()

edits = []

# 0. the gate both changes share, declared once
edits.append(("""        const speed = Math.max(2.0, boat.speed * 60); // Minimum speed for projection
""",
              block(cand, """        const speed = Math.max(2.0, boat.speed * 60); // Minimum speed for projection
""", "const openWaterAv = !(state.course._floeObjs && state.course._floeObjs.length);\n")))

# 1. the escape fan (candidate list)
edits.append((block(master, '        // Candidates: more granular to find gaps', '        ];'),
              block(cand, '        // Candidates: more granular to find gaps', '        ];')))

# 2. the land probe: a distance, not a duration — in open water only
edits.append((block(master, '            const gAv = this._trajFloe',
                    '                const segLen = Math.hypot(futureX - boat.x, futureY - boat.y);'),
              block(cand, '            const gAv = this._trajFloe',
                    '                    ? landLen : Math.hypot(futureX - boat.x, futureY - boat.y);')))

# 3+4. the two sample points inside that block now walk the land ray
edits.append(("""                    const cc = gAv.cell(boat.x + (futureX - boat.x) * frac,
                                        boat.y + (futureY - boat.y) * frac);""",
              """                    const cc = gAv.cell(boat.x + (landFX - boat.x) * frac,
                                        boat.y + (landFY - boat.y) * frac);"""))
edits.append(("""                if (!staticCollision && gAv._clear) {
                    const ce = gAv.cell(futureX, futureY);""",
              """                if (!staticCollision && gAv._clear) {
                    const ce = gAv.cell(landFX, landFY);"""))

out = master
for old, new in edits:
    if old not in out:
        print('MISS: a target region is not present verbatim:\n' + old[:200])
        sys.exit(1)
    out = out.replace(old, new, 1)

print('all %d regions matched' % len(edits))
if CHECK:
    sys.exit(0)
open(MASTER, 'w').write(out)
print('wrote %s from %s' % (MASTER, TREE))
