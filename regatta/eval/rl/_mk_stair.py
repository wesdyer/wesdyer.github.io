# Instrument the CLEARANCE STAIRCASE so its dose on the 0-rung can be counted.
#
# The staircase (script.js ~4433) is `proximityCost += cScale * (1 - clr/3)` with
# `clr` in integer CELLS gated 0<clr<3, so on a land venue it takes exactly two
# values, 6667 and 3333. `bandTrusted` (~4429) waives it for a candidate that is
# plan-aligned, in open water, not in an arc, not near irons — and that waiver is
# switched off venue-wide when `_avCurMax >= 2.0`, which on glowtide is true on the
# strength of five cells.
#
# This patch records, per decision and for the OFFSET-0 candidate only:
#   trusted   was the waiver in force
#   clr       the clearance cell count at the probe's far point
#   stair     what the staircase charged it
#   defeated  did the argmin end up somewhere other than 0
#   clean0    did the 0-rung carry no collision flag and no rule violation
# It writes to `window.__STAIR` and is read by `_glow_stair.js`. Zero cost when the
# flag is unset, so the tree still benches as itself.
#   python3 _mk_stair.py <treeName>
import io, sys, re

tree = sys.argv[1]
path = f'/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl/{tree}/regatta/js/script.js'
src = io.open(path, encoding='utf-8').read()

# 1. record the staircase dose and the trust verdict for the 0-rung
old = """                    if (!bandTrusted && clr > 0 && clr < 3) {"""
new = """                    if (window.__STAIR && offset === 0) {
                        window.__STAIR.n++;
                        if (bandTrusted) window.__STAIR.trusted++;
                        window.__STAIR.clr.push(clr);
                    }
                    if (!bandTrusted && clr > 0 && clr < 3) {"""
assert src.count(old) == 1, f'staircase anchor x{src.count(old)}'
src = src.replace(old, new)

# 2. record what the 0-rung paid and whether it was clean
old2 = """            if (offset === 0) this._costHold = cost;"""
new2 = """            if (offset === 0) {
                this._costHold = cost;
                if (window.__STAIR) {
                    window.__STAIR.prox.push(Math.round(proximityCost));
                    window.__STAIR.cost0.push(Math.round(cost));
                    window.__STAIR.clean0.push((!boatCollision && !staticCollision && !ruleViolation) ? 1 : 0);
                }
            }"""
assert src.count(old2) == 1, f'cost0 anchor x{src.count(old2)}'
src = src.replace(old2, new2)

# 3. record whether the argmin left the 0-rung, and by how much
old3 = """        this._lastAvoidChoice = bestHeading;"""
new3 = """        this._lastAvoidChoice = bestHeading;
        if (window.__STAIR) {
            const dv = Math.abs(normalizeAngle(bestHeading - desiredHeading));
            window.__STAIR.dev.push(+dv.toFixed(4));
            if (dv > 0.05) window.__STAIR.defeated++;
        }"""
assert src.count(old3) == 1, f'choice anchor x{src.count(old3)}'
src = src.replace(old3, new3)

io.open(path, 'w', encoding='utf-8').write(src)
print(f'{tree}: staircase instrumented (3 anchors)')
