# Apply the venue-class current statistic to the REPO (not a tree).
#
# Adds `state.course._avCurP90` beside `_avCurMax` and switches the FOUR
# venue-class gates to read it, leaving the THREE local-manoeuvre gates on the max.
# See the comment it inserts for the measurement behind the split.
#   python3 _apply_curs.py [--check]
import io, sys

PATH = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/js/script.js'
CHECK = '--check' in sys.argv

OLD_COMPUTE = """                if (state.course._avCurMax === undefined) {
                    let mCJ = 0;
                    const gCJ = state.course.botGrid;
                    if (gCJ && (state.course.currentRegions || []).length) {
                        for (let yCJ = 0; yCJ < gCJ.n; yCJ += 4) for (let xCJ = 0; xCJ < gCJ.n; xCJ += 4) {
                            if (!gCJ.at(xCJ, yCJ)) continue;
                            const cwJ = getCurrentAt(gCJ.x0 + (xCJ + 0.5) * gCJ.res, gCJ.y0 + (yCJ + 0.5) * gCJ.res);
                            if (cwJ && cwJ.speed > mCJ) mCJ = cwJ.speed;
                        }
                    }
                    state.course._avCurMax = mCJ;
                }"""

NEW_COMPUTE = """                if (state.course._avCurMax === undefined) {
                    let mCJ = 0;
                    const sCJ = [];
                    const gCJ = state.course.botGrid;
                    if (gCJ && (state.course.currentRegions || []).length) {
                        for (let yCJ = 0; yCJ < gCJ.n; yCJ += 4) for (let xCJ = 0; xCJ < gCJ.n; xCJ += 4) {
                            if (!gCJ.at(xCJ, yCJ)) continue;
                            const cwJ = getCurrentAt(gCJ.x0 + (xCJ + 0.5) * gCJ.res, gCJ.y0 + (yCJ + 0.5) * gCJ.res);
                            const sJ = cwJ ? cwJ.speed : 0;
                            if (sJ > mCJ) mCJ = sJ;
                            sCJ.push(sJ);
                        }
                    }
                    state.course._avCurMax = mCJ;
                    // ⭐⭐ A MAXIMUM IS NOT A VENUE-CLASS STATISTIC (2026-08-13, THE
                    // GLOWTIDE PUSH). Seven gates read this scalar at a 2.0 kt knee,
                    // and they ask two DIFFERENT questions:
                    //
                    //  LOCAL MANOEUVRE — will this boat's real path follow the rollout
                    //    I am grading? (the stuck-state retreat line ~508, the
                    //    gybe-around ~1244, the armed rounding arc ~3274.) A rollout is
                    //    arc + set in ANY stream, so this asks about the water she is
                    //    actually in.
                    //  VENUE CLASS — is this a stream venue, whose water moves the
                    //    router's own line out from under it? (the jam stamps below,
                    //    the probe cap ~4205, the plan-aligned short probe ~4296/4301,
                    //    and `bandTrusted` ~4432 — the HZ3B clearance-staircase waiver
                    //    landed in 08f734a.)
                    //
                    // A MAX over ~900 sampled cells answers the second one dishonestly:
                    // one hot cell speaks for a whole map. Measured (`_curmax.js`,
                    // `_curhot.js`, `_curphase.js` — the authored regions are static,
                    // `period` and `speedVar` are 0, so this is a venue property and not
                    // a tidal snapshot):
                    //
                    //   glowtide   max 2.31   p90 1.79   p99 1.90    5 of 877 cells >= 2.0
                    //   river      max 4.96   p90 2.90   p99 4.28    113 of 477  (23.7%)
                    //   bay 1.84/0.50, lagoon 1.09/0.41, the five still venues 0
                    //
                    // Glowtide is a 1-1.8 kt tide with one 2.3 kt corner and it was
                    // paying river's entire scoping bill. The p90 leaves river OFF and
                    // every other venue exactly where it was, so the other NINE VENUES
                    // ARE BYTE-IDENTICAL BY CONSTRUCTION (redrock and lake benched
                    // `cmp`-identical). Nor is it a tuned number: glowtide is under the
                    // knee at every percentile through p99 and river is over it from
                    // p76.3, so ANY percentile in [p77, p99] gives the same ten-venue
                    // partition. Only the raw maximum separates them.
                    //
                    // ⚠️ THE MAX IS KEPT FOR THE THREE LOCAL GATES, AND THAT IS
                    // MEASURED. Moving those three to the p90 as well LOSES on glowtide:
                    // 16 seeds, med 297 -> 366, mean 324.0 -> 384.6, land contacts
                    // 22.3 -> 38.5 (+72%), a finisher lost, 1 of 8 seeds faster. They
                    // are off here for a good reason; only the venue-class four were
                    // wrong.
                    sCJ.sort((a, b) => a - b);
                    state.course._avCurP90 = sCJ.length
                        ? sCJ[Math.min(sCJ.length - 1, Math.floor(0.90 * sCJ.length))] : 0;
                }"""

# (line, old, new) — the four VENUE-CLASS gates only.
GATES = [
    (2080, 'state.course._avCurMax < 2.0', 'state.course._avCurP90 < 2.0'),
    (4205, '(state.course._avCurMax === undefined || state.course._avCurMax < 2.0)',
           '(state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0)'),
    (4296, '(state.course._avCurMax === undefined || state.course._avCurMax < 2.0)',
           '(state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0)'),
    (4301, '(state.course._avCurMax === undefined || state.course._avCurMax < 2.0)',
           '(state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0)'),
    (4432, '(state.course._avCurMax === undefined || state.course._avCurMax < 2.0)',
           '(state.course._avCurP90 === undefined || state.course._avCurP90 < 2.0)'),
]
KEEP_MAX = [508, 1244, 3274]   # the three local-manoeuvre gates — must NOT change

src = io.open(PATH, encoding='utf-8').read()
if src.count(OLD_COMPUTE) != 1:
    print(f'⛔ compute anchor found {src.count(OLD_COMPUTE)} times — aborting'); sys.exit(1)
lines = src.split('\n')
for ln, old, new in GATES:
    if old not in lines[ln - 1]:
        print(f'⛔ line {ln} does not contain the expected gate:\n    {lines[ln-1][:110]}'); sys.exit(1)
for ln in KEEP_MAX:
    if '_avCurMax' not in lines[ln - 1]:
        print(f'⛔ line {ln} was expected to keep _avCurMax:\n    {lines[ln-1][:110]}'); sys.exit(1)
print('all anchors verified:')
print(f'  compute block x1;  {len(GATES)} venue-class gates at {[g[0] for g in GATES]};'
      f'  {len(KEEP_MAX)} local gates kept on the max at {KEEP_MAX}')
if CHECK:
    print('(--check: nothing written)'); sys.exit(0)
for ln, old, new in GATES:
    lines[ln - 1] = lines[ln - 1].replace(old, new)
out = '\n'.join(lines).replace(OLD_COMPUTE, NEW_COMPUTE, 1)
io.open(PATH, 'w', encoding='utf-8').write(out)
print('WROTE regatta/js/script.js')
