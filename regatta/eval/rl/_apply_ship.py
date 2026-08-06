#!/usr/bin/env python3
"""Apply the benched candidate to regatta/js/script.js, taken VERBATIM from the tree
that was benched — so what ships is what was measured, not a retyping of it.

  python3 _apply_ship.py [tree=treeSHIP] [--check]

--check only reports whether the target regions match; it writes nothing.
"""
import sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TREE = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'treeSHIP'
CHECK = '--check' in sys.argv

MASTER = os.path.join(ROOT, 'regatta/js/script.js')
CAND = os.path.join(ROOT, 'regatta/eval/rl', TREE, 'regatta/js/script.js')


def block(text, start, end):
    i = text.index(start)
    j = text.index(end, i) + len(end)
    return text[i:j]


master = open(MASTER).read()
cand = open(CAND).read()

edits = []

# 1. the escape fan (candidate list), floe-gated
edits.append((block(master, '        // Candidates: more granular to find gaps', '        ];'),
              block(cand, '        // Candidates: more granular to find gaps', '        ];')))

# 2. the land probe: a distance, not a duration
edits.append((block(master, '            const gAv = this._trajFloe',
                    '                const segLen = Math.hypot(futureX - boat.x, futureY - boat.y);'),
              block(cand, '            const gAv = this._trajFloe',
                    '                const segLen = landLen;')))

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
